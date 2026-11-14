# Transparent mirror prototype

This standalone desktop prototype keeps a large try-on view, a transparent left
garment rail and a bottom-right original preview. It supplements the existing
phone-first sliding wardrobe; it does not change the storefront or native app.

## Run locally

Use Node 20.18.1 or later. From the repository root:

```sh
npm ci --ignore-scripts --prefix prototypes/mirror
npm run download-model --prefix prototypes/mirror
npm run build --prefix prototypes/mirror
npm run serve --prefix prototypes/mirror
```

Open `http://127.0.0.1:8781/`. The existing phone prototype is also served at
`http://127.0.0.1:8781/static/`. Set `PORT` to choose a different loopback port.
Stop the server with Ctrl-C.

The model download is an explicit, free download from Google's published model
storage, verified against the URL, byte length and SHA-256 in
`models/source.json`. A verified cached model is reused; a corrupt file is
reported without overwriting it. Model and WebAssembly binaries, dependencies,
generated output and QA artifacts are not committed. The build uses the existing
wardrobe catalog and public demo assets, and copies the installed MediaPipe
runtime into its local `dist/` output. No CDN is needed during camera use.

## Try the controls

- Click garments, use up/down keys, or scroll over the main view. Scrolling
  inside the left rail browses thumbnails without selecting them. The 12-item
  queue wraps.
- Leave **示範試穿** selected and press **手勢切換** to allow the local camera.
  Extend the index finger with the other three fingers curled; thumb position
  is unrestricted. Put the fingertip in the dashed region of the bottom-right
  original preview and wait for **已就緒**. Move the extended finger upward for
  the next garment or downward for the previous one.
- After each selection, fold the index finger briefly before returning and
  extending it again. A switch remains locked until an explicit fold has been
  observed for at least 220 ms and a one-second cooldown has elapsed. Tracking
  loss, leaving the region and holding an extended finger cannot reset it.
- **我的鏡頭** selects an original-camera layout. **開啟鏡頭** requests a local
  video-only stream. This mode is explicitly labelled as not AI transformed.
- **停止**, Escape, hiding/leaving the page or the three-minute preview limit
  releases the camera and detector. Another explicit Start can restart them.

## What the prototype demonstrates

Demonstration mode uses the existing synthetic person and 12 pre-generated
results from the three-store Shopify snapshot. It is not a live product feed.
Hand gestures navigate those demonstration results; they do not put garments
onto the camera image. Lucy 2.6 streaming, live Shopify refresh and backend
pre-generation are not connected here. The images do not establish garment
fidelity, body measurements or size/fit accuracy.

Camera frames and hand landmarks remain transient and local. There is no
microphone, recording, image upload, provider credential or paid inference.
Chrome is the verified browser route; physical-user gesture accuracy and other
browsers remain uncalibrated.

## Verify

With the server running, use another terminal:

```sh
npm run check --prefix prototypes/mirror
```

For a different server port, set both `PORT` on the server and
`CLOAK_MIRROR_PORT` on the check command. The check runs TypeScript, gesture and
model-download unit tests, the build, then browser checks using the pinned
`playwright-core` package and an installed Chrome. It never installs a browser
or accesses the physical camera: browser checks use a synthetic camera device.
The base suite executes the real local hand model; a separate QA-only landmark
replay exercises index up/down selection and folded return through the actual
app callbacks. Neither proves physical-user recognition accuracy.

Results, screenshots and traces go to ignored `qa/`. Root `npm test` also runs
the gesture/model unit tests without prototype dependencies, model download,
camera, browser or network access. The prototype's source is checked separately
from the Next.js TypeScript/ESLint configuration, as with the existing wardrobe.

The loopback server serves a fixed map of built files, rejects foreign Host and
Origin values and mutation methods, and does not read credentials. Its CSP
allows same-origin runtime resources and pinned ui-sdk style hashes; the
existing static prototype retains its previous policy.
