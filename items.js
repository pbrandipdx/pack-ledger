// Gear list data for Pack Ledger. Edit this file to add, remove or change items.
// Weights are in ounces (oz). See CLAUDE.md for the field guide.
window.PACK_ITEMS = [
  {id:"pack", cat:"base", role:"Pack", name:"Gorilla 50", brand:"Gossamer Gear", oz:31.9, img:"images/pack.jpg", note:"Published Medium weight. Size and year on your pack are unconfirmed.", on:true},
  {id:"tent", cat:"base", role:"Shelter", group:"shelter", fit:"contain", name:"Skyscape Trekker", brand:"Six Moon Designs", oz:28, img:"images/trekker.jpg", note:"Tent only. Needs two 45 in trekking poles, which are not counted here.", on:true},
  {id:"stakes", cat:"base", role:"Shelter", name:"6 Piece Stake Set", brand:"Six Moon Designs", oz:2.5, img:"images/stakes.jpg", note:"Six 7 in aluminum Y stakes with pull cords.", on:true},
  {id:"hammock", cat:"base", role:"Shelter", group:"shelter", alsoOff:["stakes"], name:"Mantis UL Hammock Tent", brand:"Kammok", oz:32, img:"images/mantis.jpg", note:"Includes rainfly, straps, bug net, and its own stakes. Checking it unchecks the tent and stake set.", on:false},
  {id:"bag", cat:"base", role:"Sleep", name:"Magma 30 (Men's Long)", brand:"REI Co-op", oz:22, img:"images/bag.jpg", note:"850-fill down, 30°F. Published weight is for the current version.", on:true},
  {id:"pad", cat:"base", role:"Sleep", name:"Ether Light XR Insulated, Large", brand:"Sea to Summit", oz:21.3, img:"images/pad.jpg", note:"Tapered version. The rectangular Large is 23.5 oz.", on:true},
  {id:"pillow", cat:"base", role:"Sleep", name:"Aeros Premium Pillow, XL", brand:"Sea to Summit", oz:8.8, img:"images/pillow.jpg", note:"Published weight, 250 g.", on:true},
  {id:"rab", cat:"clothing", role:"Rain layer", name:"Phantom Waterproof Jacket, XXL", brand:"Rab", oz:4.1, img:"images/rab.jpg", note:"Published weight is for size M. Your XXL is likely a little heavier, so weigh it.", on:true},
  {id:"stove", cat:"food", role:"Stove", fit:"contain", img:"images/stove.jpg", name:"Titanium Backpacking Stove", brand:"TOAKS", oz:1.7, note:"Stove only, 48 g. Uses isobutane-propane canisters (fuel not counted). Includes a storage bag.", on:true},
  {id:"pot", cat:"food", role:"Cook pot", fit:"contain", img:"images/pot.jpg", name:"Titanium 750 ml Pot", brand:"TOAKS", oz:3.6, note:"Listed at 3.6 oz. Sold as pot, lid, and mesh sack. Weigh it to confirm what that includes.", on:true},
  {id:"cup", cat:"food", role:"Cup", fit:"contain", img:"images/cup.jpg", name:"Light Titanium 450 ml Cup, Ultralight", brand:"TOAKS", oz:1.7, note:"48 g, no lid.", on:true},
  {id:"sleeves", cat:"clothing", role:"Compression", name:"Compression Leg Sleeves, L/XL", brand:"Zensah", oz:null, note:"Weight not published. Weigh the pair and enter it.", on:true}
];
