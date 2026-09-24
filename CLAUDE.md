# Pack Ledger: notes for Claude

This repo is a static website (GitHub Pages) that lets the owner check off backpacking gear and see a live total weight. Nothing is built or bundled. Pushing to `main` publishes the site within a minute or two.

## Files

- `items.js` holds all gear data. Almost every update is an edit to this file.
- `index.html` holds the page layout, styles, and behavior. Change it only for design or feature requests.
- `images/` holds one product photo per item, JPG, about 420 px on the long side, under 60 KB.

## How to update the gear list

Edit `items.js`. Each item is one line in the `window.PACK_ITEMS` array:

```js
{id:"pad", cat:"base", role:"Sleep", name:"Ether Light XR Insulated, Large", brand:"Sea to Summit", oz:21.3, img:"images/pad.jpg", note:"Short helpful note.", on:true},
```

| Field | Meaning |
|---|---|
| `id` | Unique, lowercase, no spaces. Never reuse or rename an id of an existing item, because the owner's saved checkmarks and weights are keyed by it. |
| `cat` | One of `base`, `clothing`, `food`, `misc`. Base is pack, shelter, sleep system. Food includes cooking gear. |
| `role` | Small label above the name, such as Pack, Shelter, Sleep, Rain layer, Stove. |
| `name`, `brand` | Display text. |
| `oz` | Weight in ounces as a number, or `null` if unknown. Convert grams by dividing by 28.3495. |
| `img` | Path like `images/pad.jpg`. Omit it and the card shows a plain lettered tile. |
| `note` | One short line: what the weight includes, size caveats, and so on. |
| `on` | `true` if the item starts checked. |
| `group` | Items sharing a group are mutually exclusive. `tent` and `hammock` use `"shelter"`. |
| `alsoOff` | Ids to uncheck when this item is checked. The hammock unchecks `stakes`. |
| `fit` | Set to `"contain"` for product shots on a white background so they are not cropped. |

Rules of thumb:

- Use the manufacturer's published weight for the exact size when it exists and say so in `note`. If only another size is published, say that. Never invent a weight; use `null` instead.
- Items the owner has weighed themselves are entered in the page's own UI and live in that browser only, so do not overwrite them here.
- To remove an item, delete its line and its photo. To add one, add a line and a photo.
- Keep the file valid JavaScript (commas between items, no trailing syntax errors). Open the page after a change if a browser is available.

## Photos

Crop to the product, resize to about 420 px on the long side, save as JPG at quality about 78. Name the file after the item id.

## Style

The look is a clean white, image-forward product grid with dark navy text, condensed uppercase headings (Barlow Condensed), and Barlow body text. Colors are CSS variables at the top of `index.html`, with a dark theme block. Keep both themes working and keep the layout usable at phone width.

## Things to leave alone

Saved state lives in each browser's localStorage under the key `packledger.v1`. Do not change that key or the shape of the saved object without a migration.
