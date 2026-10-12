// Turns raw Brave web-search results into gear candidates:
//   { name, brand, weight_oz, confidence, weight_note, source_url, source_host }
//
// Pure functions only (no network, no Deno/Node APIs) so the same file runs in the
// Supabase edge function and in the Node tests (parse.test.mjs).
//
// Design rule: precision over recall. A missing weight is fine, because the UI lets the
// user type it in. A confidently wrong weight is not. So a number only counts when the
// text around it says it is a weight.

const G = 28.3495;

// Common backpacking brands. Longest names are matched first. Add more as needed.
const BRANDS = [
  "Zpacks", "Big Agnes", "Sea to Summit", "Therm-a-Rest", "Thermarest", "Osprey", "Gossamer Gear",
  "Hyperlite Mountain Gear", "Durston Gear", "Durston", "Six Moon Designs", "NEMO", "MSR", "Jetboil",
  "Black Diamond", "Patagonia", "Arc'teryx", "Outdoor Research", "Enlightened Equipment",
  "Katabatic Gear", "Western Mountaineering", "Feathered Friends", "Sawyer", "Katadyn", "Platypus",
  "HydraPak", "Garmin", "Petzl", "BioLite", "Soto", "Snow Peak", "Toaks", "Evernew", "Montbell",
  "Mountain Hardwear", "Marmot", "The North Face", "Salomon", "Altra", "Hoka", "Darn Tough",
  "Smartwool", "Injinji", "Cnoc", "LightHeart Gear", "Tarptent", "Mountain Laurel Designs",
  "ULA Equipment", "Granite Gear", "Exped", "Klymit", "Cumulus", "Sierra Designs", "Kelty",
  "Gregory", "Deuter", "Hydro Flask", "Nalgene", "COROS", "Suunto", "Anker", "Nitecore", "Fenix",
  "Pa'lante Packs", "Palante", "Rab", "Mountain Equipment", "Yeti", "Stanley", "Hennessy Hammock",
  "Warbonnet", "Eno", "Grand Trunk", "Dutchware", "Hammock Gear", "Underground Quilts",
  "Nunatak", "Loco Libre", "Gear Aid", "Sawyer", "LifeStraw", "Grayl", "Steripen", "Aquamira",
  "Frogg Toggs", "Cascade Designs", "Helinox", "Alite", "Flextail", "Lezyne", "Leki",
  "Gossamer", "Brooks-Range", "Brooks Range", "Mystery Ranch", "Arcteryx", "Columbia",
  "Fjallraven", "Fjällräven", "Kuiu", "Sitka", "Superior Wilderness Designs", "Seek Outside",
  "Elemental Horizons", "Waymark", "Atom Packs", "Bfamilie", "Ruffwear", "Garmin inReach",
  "Zoleo", "Spot", "Goal Zero", "Nitecore", "Black Diamond", "Petzl", "Princeton Tec",
  "Vargo", "Optimus", "Fire-Maple", "Fire Maple", "Kovea", "Primus", "Esbit", "GSI Outdoors",
  "GSI", "Sea To Summit", "Stoic", "REI Co-op", "Kula Cloth", "Trail Designs",
].filter(function (b, i, a) { return a.indexOf(b) === i; })
 .sort(function (a, b) { return b.length - a.length; });

// Hosts that are never a product page.
const BLOCKED_HOSTS = [
  "youtube.com", "youtu.be", "reddit.com", "pinterest.com", "facebook.com", "instagram.com",
  "tiktok.com", "quora.com", "twitter.com", "x.com",
];

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " ", "&apos;": "'" };

export function cleanText(s) {
  return String(s == null ? "" : s)
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp|apos);/g, function (m) { return ENTITIES[m]; })
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return (String(s).toLowerCase().match(/[a-z0-9]+/g) || []);
}

// Search-result titles look like "Zpacks Duplex Tent | REI Co-op" or "Duplex - Zpacks - Backcountry".
// Keep the segment that best matches what the user typed.
export function cleanTitle(title, query) {
  var t = cleanText(title);
  var parts = t.split(/\s+[|–—·]\s+|\s+-\s+|\s*::\s*/).map(function (p) { return p.trim(); }).filter(Boolean);
  if (parts.length <= 1) return t;
  var qt = tokens(query), best = parts[0], bestScore = -Infinity;
  parts.forEach(function (p, i) {
    var hits = tokens(p).filter(function (x) { return qt.indexOf(x) !== -1; }).length;
    var score = hits * 10 - i;
    if (score > bestScore) { best = p; bestScore = score; }
  });
  return best;
}

export function findBrand(text) {
  var hay = " " + cleanText(text).toLowerCase() + " ";
  for (var i = 0; i < BRANDS.length; i++) {
    var b = BRANDS[i].toLowerCase();
    var idx = hay.indexOf(b);
    while (idx !== -1) {
      var before = hay.charAt(idx - 1), after = hay.charAt(idx + b.length);
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return BRANDS[i];
      idx = hay.indexOf(b, idx + 1);
    }
  }
  return null;
}

// ---- weights ---------------------------------------------------------------------------

var NUM = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";
var RE_COMPOUND = new RegExp(NUM + "\\s*(?:lbs?\\.?|pounds?)\\s*(?:,|and|&)?\\s*" + NUM + "\\s*(?:oz\\.?|ounces?)\\b", "gi");
var RE_SINGLE = new RegExp(NUM + "\\s*(kg|kilograms?|grams?|g|lbs?|pounds?|oz|ounces?)(?![a-z\\/])", "gi");

function num(s) { return parseFloat(String(s).replace(/,/g, "")); }

function toOz(v, unit) {
  var u = unit.toLowerCase();
  if (u === "kg" || u.indexOf("kilogram") === 0) return v * 1000 / G;
  if (u === "g" || u.indexOf("gram") === 0) return v / G;
  if (u === "lb" || u === "lbs" || u.indexOf("pound") === 0) return v * 16;
  return v; // oz
}

// A number only counts when the words just before it say it is a weight.
var RE_WEIGHT_WORD = /(weigh(?:s|ing|t|ed)?|mass)\b[^.;\n]{0,45}$/i;
var RE_STRONG_WORD = /(packed|trail|total|listed|item|product|stuff sack|minimum|min\.?|peak)\s+weigh(?:t|s)?\b[^.;\n]{0,25}$/i;
var RE_BAD_BEFORE = /(?:(?:shipping|ships?|fabric|box(?:ed)?|carton)(?:\s+weigh(?:t|s)?)?|fill\s*power|capacity|volume|holds|load|carry|up to|rated|temp|denier|per\s+(?:sq|square)|fl\.?|fluid)\W{0,12}$/i;
var RE_BAD_AFTER = /^\s*(?:\/|per\b|sq|gsm|fl\b|fill)/i;

function inRange(oz) { return oz >= 0.2 && oz <= 800; }

export function extractWeights(text) {
  var out = [], used = [];
  function overlaps(a, b) { return used.some(function (r) { return a < r[1] && b > r[0]; }); }
  function consider(index, len, oz, raw, kind) {
    if (!isFinite(oz) || !inRange(oz)) return;
    var before = text.slice(Math.max(0, index - 70), index);
    var after = text.slice(index + len, index + len + 12);
    var strong = RE_STRONG_WORD.test(before);
    var ctx = strong || RE_WEIGHT_WORD.test(before);
    if (RE_BAD_BEFORE.test(before.slice(-30)) && !strong) return;
    if (RE_BAD_AFTER.test(after)) return;
    // Bare numbers without any weight wording are too ambiguous (water bottles, fuel, capacity).
    if (!ctx && kind !== "compound") return;
    out.push({ oz: oz, strong: strong, ctx: ctx, raw: raw, at: index });
  }
  var m;
  RE_COMPOUND.lastIndex = 0;
  while ((m = RE_COMPOUND.exec(text))) {
    used.push([m.index, m.index + m[0].length]);
    consider(m.index, m[0].length, num(m[1]) * 16 + num(m[2]), m[0], "compound");
  }
  RE_SINGLE.lastIndex = 0;
  while ((m = RE_SINGLE.exec(text))) {
    if (overlaps(m.index, m.index + m[0].length)) continue;
    consider(m.index, m[0].length, toOz(num(m[1]), m[2]), m[0], "single");
  }
  return out;
}

// Pick one weight out of everything found for a single search result.
export function pickWeight(fields) {
  var all = [];
  fields.forEach(function (f, fi) {
    extractWeights(cleanText(f)).forEach(function (w) { w.field = fi; all.push(w); });
  });
  if (!all.length) return { weight_oz: null, confidence: null, weight_note: null };

  // Group values that agree (a "19.4 oz" and a "550 g" are the same weight).
  var groups = [];
  all.forEach(function (w) {
    var g = groups.filter(function (x) { return Math.abs(x.oz - w.oz) <= Math.max(0.3, w.oz * 0.02); })[0];
    if (!g) { g = { oz: w.oz, items: [] }; groups.push(g); }
    g.items.push(w);
  });
  groups.forEach(function (g) {
    g.score = g.items.reduce(function (s, w) { return s + 1 + (w.strong ? 2 : 0); }, 0);
    g.fields = g.items.map(function (w) { return w.field; }).filter(function (f, i, a) { return a.indexOf(f) === i; }).length;
  });
  groups.sort(function (a, b) { return b.score - a.score || a.items[0].at - b.items[0].at; });
  var best = groups[0];
  var strong = best.items.some(function (w) { return w.strong; });
  var agreed = best.items.length >= 2;
  var confident = (strong || agreed) && groups.length === 1;
  var note = groups.length > 1 ? "Several weights found (sizes or versions vary)" : null;
  return {
    weight_oz: Math.round(best.oz * 10) / 10,
    confidence: confident ? "high" : "low",
    weight_note: note || best.items[0].raw.replace(/\s+/g, " ").trim(),
  };
}

// ---- results ---------------------------------------------------------------------------

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
}

function isBlocked(host) {
  return BLOCKED_HOSTS.some(function (b) { return host === b || host.slice(-(b.length + 1)) === "." + b; });
}

function safeUrl(u) {
  try { var x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : ""; } catch (e) { return ""; }
}

// braveJson is the parsed body from /res/v1/web/search.
export function rankResults(query, braveJson, limit) {
  var rows = (braveJson && braveJson.web && Array.isArray(braveJson.web.results)) ? braveJson.web.results : [];
  var qt = tokens(query), seen = {}, out = [];
  rows.forEach(function (r) {
    var url = safeUrl(r && r.url), host = hostOf(url);
    if (!url || isBlocked(host)) return;
    var name = cleanTitle(r.title, query);
    if (!name || name.length > 120) return;
    var key = name.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;

    var fields = [r.title, r.description].concat(Array.isArray(r.extra_snippets) ? r.extra_snippets : []);
    var w = pickWeight(fields);
    var brand = findBrand(name) || findBrand(query);
    var nt = tokens(name);
    var overlap = qt.length ? qt.filter(function (x) { return nt.indexOf(x) !== -1; }).length / qt.length : 0;
    var score = overlap + (w.weight_oz != null ? 0.5 : 0) + (w.confidence === "high" ? 0.2 : 0) + (brand ? 0.1 : 0);
    out.push({
      name: name, brand: brand, weight_oz: w.weight_oz, confidence: w.confidence, weight_note: w.weight_note,
      source_url: url, source_host: host, _score: score,
    });
  });
  out.sort(function (a, b) { return b._score - a._score; });
  return out.slice(0, limit || 5).map(function (x) { delete x._score; return x; });
}
