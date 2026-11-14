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
node --env-file=/path/to/private.env prototypes/mirror/server.mjs
```

Open `http://127.0.0.1:8781/`. The existing phone prototype is also served at
`http://127.0.0.1:8781/static/`. Set `PORT` to choose a different loopback port.
Stop the server with Ctrl-C. The optional private env file contains only your
server-side `DECART_API_KEY`; never put it under `dist/`, `models/` or source
control. Without a key, demo and local-camera modes still work. For those modes,
`npm run serve --prefix prototypes/mirror` needs no env file.

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
  is unrestricted. Keep the hand visible anywhere in the camera frame and
  wait for **已就緒**. Move the extended finger upward for
  the next garment or downward for the previous one.
- The original preview draws green hand landmarks and reports whether the model
  is loading, no hand is visible, the index pose is recognized, or the
  gesture is ready. No activation box is required. Natural slight fingertip curvature is accepted. If the
  local server is unavailable, the page reports it before opening a camera.
- After each selection, fold the index finger briefly before returning and
  extending it again. A switch remains locked until an explicit fold has been
  observed for at least 220 ms and a one-second cooldown has elapsed. Tracking
  loss, moving across the frame and holding an extended finger cannot reset it.
- **我的鏡頭** selects an original-camera layout. **開啟鏡頭** requests a local
  video-only stream. This mode is explicitly labelled as not AI transformed.
- **停止**, Escape, hiding/leaving the page or the three-minute preview limit
  releases the camera and detector. Another explicit Start can restart them.

## Own-camera Lucy trial

Press **AI 試穿 · 25秒** to start Lucy2.6 in standard mode. This explicitly
requests a video-only camera, sends that video and the selected original garment
reference to Decart, and uses Decart credits. The transformed output occupies the
main stage; the original stays in the bottom-right preview. Local index tracking
starts automatically and uses the original stream, anywhere in the camera frame.
Click, keys, wheel and index navigation update the same session with complete
`set({image,prompt})` state. References come from all12 accepted MUJI USA/MISHOW/
Lavahut snapshot items, not the pre-generated person images.

A short-lived token is model/origin scoped, minted only after the user's Start.
The client stops25seconds after camera preparation; the provider token caps a
session at30seconds. Token expiry alone does not stop an established connection.
One reservation is persisted in ignored `qa/lucy-reservation.json`, including on
failure; refresh and process restart do not create another trial. There is no
retry, automatic reconnect, fast mode, top-up, recording or microphone. A further
trial requires a separately authorized reservation; do not delete the receipt to
silently extend the allowance.

Stop, Escape and page exit close the local camera, detector and realtime handle.
If Stop happens while the SDK's uncancellable connect is pending, the app leaves
for a script-free stopped page to close that document's WebRTC owner. A rejected
request or disconnected session is shown as a failure, never a successful fit.
The UI distinguishes selection, reference acceptance and a received remote
stream: reference acknowledgement does not prove the rendered garment matches.

## What the prototype demonstrates

Demonstration mode uses the existing synthetic person and 12 pre-generated
results from the three-store Shopify snapshot. It is not a live product feed.
In demo mode, hand gestures navigate those still images; the person is not an
animated video. In Lucy mode the input is your camera, with actual provider
output shown separately. Live Shopify refresh and backend pre-generation are
not connected here. The images do not establish garment
fidelity, body measurements or size/fit accuracy.

Hand landmarks remain transient and local. Camera-only mode stays local; AI
Start shares video and garment references with Decart. There is no microphone
or recording, and the permanent credential never reaches the browser.
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
app callbacks. A Lucy-only adapter fixture exercises the actual app lifecycle,
serial reference updates and remote-video binding without calling Decart or
accessing a physical camera. This is not provider-quality evidence.
The final real-model check also uses two checksum-pinned official MediaPipe hand
photographs, downloaded to ignored `qa/fixtures/` if absent. It checks positive
hand/index detection, folded-hand feedback and stale-overlay removal without
using a physical camera. These fixtures do not prove physical-user recognition
accuracy.

Results, screenshots and traces go to ignored `qa/`. Root `npm test` also runs
the gesture/model unit tests without prototype dependencies, model download,
camera, browser or network access. It also covers guarded one-use token policy. The prototype's source is checked separately
from the Next.js TypeScript/ESLint configuration, as with the existing wardrobe.

The loopback server serves a fixed map of built files, rejects foreign Host and
Origin values and mutation methods except the Origin/CSRF-guarded token endpoint. The
permanent key is read only from the server environment. Its CSP
allows same-origin runtime resources and documented Decart signaling hosts and pinned ui-sdk style hashes; the
existing static prototype retains its previous policy.
