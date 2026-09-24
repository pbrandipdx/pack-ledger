# Pack Ledger

Check off backpacking gear and see the total weight. Categories are Base, Clothing, Food & Cooking, and Misc. Weights can be shown in oz, g, or lb, and any weight can be overwritten with a real scale reading.

## Updating it from any device

Open the Claude app (phone, tablet, or browser), start a Claude Code session on this repository, and say what you want:

- "Add a Jetboil stove, 12 oz, to Food & Cooking."
- "I weighed the Rab jacket at 5.2 oz. Update it."
- "Swap the pad for the NeoAir XLite NXT, Regular."
- "Add a Sawyer Squeeze filter and a headlamp to Misc."

Claude edits `items.js`, commits to `main`, and the site updates in a minute or two. `CLAUDE.md` tells Claude how the files are laid out.

## What is saved where

Checkmarks, weights you type in, and items you add on the page are saved in that browser only. Another phone or laptop starts from the list in `items.js`. To make something permanent everywhere, ask Claude to put it in `items.js`.

## Files

- `index.html`: page, styles, and behavior
- `items.js`: the gear data
- `images/`: product photos
