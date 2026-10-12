// Run with: node --test search-api/
import test from "node:test";
import assert from "node:assert/strict";
import { cleanTitle, findBrand, extractWeights, pickWeight, rankResults, cleanText } from "./parse.mjs";

test("cleanText strips tags and entities", () => {
  assert.equal(cleanText("<strong>Zpacks</strong> Duplex &amp; Tent&#39;s"), "Zpacks Duplex & Tent's");
});

test("cleanTitle drops retailer suffixes and keeps the segment matching the query", () => {
  assert.equal(cleanTitle("Zpacks Duplex Tent | REI Co-op", "zpacks duplex"), "Zpacks Duplex Tent");
  assert.equal(cleanTitle("Buy Online - Duplex Tent - Backcountry", "duplex tent"), "Duplex Tent");
  assert.equal(cleanTitle("Plain Title", "anything"), "Plain Title");
});

test("findBrand matches whole words, longest first", () => {
  assert.equal(findBrand("Sea to Summit Ether Light XR"), "Sea to Summit");
  assert.equal(findBrand("Big Agnes Copper Spur HV UL2"), "Big Agnes");
  assert.equal(findBrand("Therm-a-Rest NeoAir XLite"), "Therm-a-Rest");
  assert.equal(findBrand("Some Unknown Widget"), null);
  // "rab" inside another word must not match
  assert.equal(findBrand("Crabtree Cooler"), null);
});

test("weight in ounces with a weight word", () => {
  const w = pickWeight(["Weight: 19.4 oz"]);
  assert.equal(w.weight_oz, 19.4);
});

test("pounds plus ounces compound", () => {
  const w = pickWeight(["Packed weight 1 lb 3.2 oz for the pair."]);
  assert.equal(w.weight_oz, 19.2);
});

test("grams convert to ounces", () => {
  const w = pickWeight(["Trail weight: 550 g"]);
  assert.equal(w.weight_oz, 19.4);
});

test("kilograms convert to ounces", () => {
  const w = pickWeight(["Weight 1.2 kg including stuff sack"]);
  assert.equal(w.weight_oz, 42.3);
});

test("thousands separator in grams", () => {
  const w = pickWeight(["Weight: 1,360 g"]);
  assert.equal(w.weight_oz, 48);
});

test("two agreeing sources in different units give high confidence", () => {
  const w = pickWeight(["Packed weight: 19.4 oz", "Weighs 550 g on our scale."]);
  assert.equal(w.weight_oz, 19.4);
  assert.equal(w.confidence, "high");
});

test("a single loose 'weighs' mention is low confidence", () => {
  const w = pickWeight(["This tent weighs about 2 lb according to one reviewer."]);
  assert.equal(w.weight_oz, 32);
  assert.equal(w.confidence, "low");
});

test("different sizes mean low confidence with a note", () => {
  const w = pickWeight(["Regular weight 21 oz. Long weight 24 oz."]);
  assert.equal(w.confidence, "low");
  assert.match(w.weight_note, /Several weights/);
});

test("fluid ounces are never a weight", () => {
  assert.equal(pickWeight(["Holds 20 fl oz of water. Weight of the bottle is not listed."]).weight_oz, null);
  assert.equal(pickWeight(["Capacity 32 oz, wide mouth."]).weight_oz, null);
});

test("shipping weight is ignored", () => {
  assert.equal(pickWeight(["Shipping weight: 3 lb 2 oz"]).weight_oz, null);
});

test("fabric density is ignored", () => {
  assert.equal(pickWeight(["Fabric weight 30 g/m2 silnylon"]).weight_oz, null);
  assert.equal(pickWeight(["Weight 1.1 oz/yd2 fabric"]).weight_oz, null);
});

test("bare numbers with no weight wording are ignored", () => {
  assert.equal(pickWeight(["Fits 20 oz bottles and a 4 oz fuel can"]).weight_oz, null);
});

test("out-of-range values are dropped", () => {
  assert.equal(pickWeight(["Weight: 0.01 oz"]).weight_oz, null);
  assert.equal(pickWeight(["Weight: 5000 lb"]).weight_oz, null);
});

test("extractWeights does not double count a compound weight", () => {
  const found = extractWeights("Weight: 1 lb 3 oz");
  assert.equal(found.length, 1);
  assert.equal(found[0].oz, 19);
});

test("rankResults ranks, dedupes, blocks social hosts, and shapes output", () => {
  const brave = { web: { results: [
    { title: "Zpacks Duplex Tent | REI Co-op", url: "https://www.rei.com/product/1", description: "Packed weight: 19.4 oz (550 g)." },
    { title: "Zpacks Duplex Tent | REI Co-op", url: "https://www.rei.com/product/1b", description: "Duplicate title." },
    { title: "Duplex tent thread", url: "https://www.reddit.com/r/Ultralight/x", description: "Weight: 20 oz" },
    { title: "Unrelated Camp Chair", url: "https://example.com/chair", description: "Weight: 2 lb" },
    { title: "javascript trick", url: "javascript:alert(1)", description: "Weight: 3 oz" },
  ] } };
  const r = rankResults("zpacks duplex", brave, 5);
  assert.equal(r[0].name, "Zpacks Duplex Tent");
  assert.equal(r[0].brand, "Zpacks");
  assert.equal(r[0].weight_oz, 19.4);
  assert.equal(r[0].confidence, "high");
  assert.equal(r[0].source_host, "rei.com");
  assert.ok(!r.some((x) => x.source_host === "reddit.com"));
  assert.ok(!r.some((x) => x.source_url.startsWith("javascript:")));
  assert.equal(r.filter((x) => x.name === "Zpacks Duplex Tent").length, 1);
  assert.ok(!("_score" in r[0]));
});

test("rankResults tolerates empty or malformed responses", () => {
  assert.deepEqual(rankResults("x", {}), []);
  assert.deepEqual(rankResults("x", null), []);
  assert.deepEqual(rankResults("x", { web: { results: "nope" } }), []);
});

test("brand falls back to the query when the title omits it", () => {
  const brave = { web: { results: [{ title: "Ether Light XR Insulated Sleeping Pad", url: "https://example.com/p", description: "Weight: 21.3 oz" }] } };
  const r = rankResults("sea to summit ether light xr", brave);
  assert.equal(r[0].brand, "Sea to Summit");
});
