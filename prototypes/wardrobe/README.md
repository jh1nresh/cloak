# Cloak sliding wardrobe prototype

A phone-first vertical feed of 12 pre-generated static try-on images: four distinct
products each from MUJI USA, MISHOW and Lavahut. Swipe up for the next garment and
down to return. The feed stops at item 12. The person and bottom product panel stay fixed; only the selected product changes.
The same black-camisole base stays fixed;
a masked upper-body layer reveals the selected result after a short dressing pause.

From the repository root, open `/prototypes/wardrobe/index.html` through the existing
Next server, or serve only the static export:

```sh
python3 -m http.server 8771 --directory public/prototypes/wardrobe
```

Open `http://localhost:8771` on the computer. For a phone on the same trusted Wi-Fi,
use the computer's LAN address and port 8771. Stop the server with Ctrl-C.

## Rebuild

```sh
cd prototypes/wardrobe
npm ci --ignore-scripts
npm run check
```

This standalone package pins UI SDK 0.1.0-beta.1, esbuild 0.25.12 and TypeScript
5.9.3. Its compiler scope is separate from the Next application. The committed HTML,
CSS and JS export works without installing this package. Assets are already
committed; rebuilding does not fetch products or generate more images.

## Provenance and limits

`catalog.json` is a public Shopify Global Catalog snapshot obtained on 2026-11-13.
Product links retain their selected variant and omit catalog tracking parameters.
Prices and availability are a snapshot. The merchant garment reference images and
pre-generated demonstration outputs are included to reproduce this prototype;
merchant imagery is not relicensed by the UI SDK license. There is no merchant
partnership or size/fit guarantee.

The demonstration uses one synthetic person, three existing results and nine
additional Decart Lucy Image 2 results. No customer photo, API key, generation
endpoint, private generation journal or automatic paid call is included. Browsing
uses local static assets; only explicitly opening a merchant link leaves the page.
Saved variant IDs remain in localStorage. The page CSP disables network connections.

The reveal is regional raster compositing, not physical cloth simulation or a
live inference API. The upper mask includes arms, waist and some upper-skirt pixels;
its exterior stays the base image. The first three results use a fixed alignment
transform. Exact prints, garment details and fit may differ. “底圖” shows the base;
“全身” changes the shared view. UI SDK's Apache 2.0 license is in the export folder.

The original prototype passed 74 Chromium UI checks and region pixel comparisons.
Packaging checks cover catalog uniqueness, local assets, embedded JSON and CSP;
rebuild and browser evidence are recorded in the PR. Physical iPhone/Safari and
VoiceOver remain untested. This route is an isolated prototype, separate from the
existing storefront, paid generation API and native app.
