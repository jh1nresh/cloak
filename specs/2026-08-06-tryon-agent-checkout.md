# Spec: Cloak Motion Try-On + Agent Checkout

> Status: draft
> Date: 2026-08-06
> Supersedes nothing. Extends `specs/2026-05-27-link-to-me-app.md`.

## Goal

Turn Cloak from "看看穿起來如何" into "看到自己穿著它動，然後在 app 內直接買到"。

Two changes to the current product:

1. **Motion try-on** — the try-on output becomes a short video of the user
   wearing the garment, not a still image. Provider: Decart `lucy-vton-3`.
2. **Agent checkout** — the user buys from inside Cloak. Cloak's agent places
   the order on the merchant's store. The user never returns to the source
   e-commerce site.

Short positioning:

> Save any fashion link. See yourself wearing it. Buy it without leaving.

## Product Boundary (constitution)

What Cloak is:

- A personal wardrobe + fitting room that ends in a purchase.
- The owner of the **fit decision**: which garment, which size, does it suit you.

What Cloak is not:

- Not a try-on API or a rendering product. The render layer is commoditized
  (Fashn, Decart, fal, Google Doppl all sell it). Cloak must not be positioned
  or priced as a try-on tool.
- **Not the merchant of record.** Cloak does not hold inventory, does not own
  fulfillment, does not own returns. Payment is delegated (ACP shared payment
  token); the merchant stays MoR.
- Not a marketplace. No catalog ingestion, no product search. Items enter Cloak
  only through the user sharing a link.

The defensible asset is not the video. It is the loop:

```text
motion try-on (high-confidence decision)
  → size prediction (height/weight + purchase history + fit feedback)
  → order placed through Cloak
  → return rate below the merchant's store average
  → leverage to negotiate agent-channel access and revenue share
```

Rendering is rentable. The return-rate record is not.

## Why Now

- Decart `lucy-vton-3` ships production video try-on: garment reference image +
  video of the subject → subject wearing the garment, fabric drape and motion
  preserved. Verified working in the wild (Anywear, Decart's own extension).
- Checkout was standardized in H1 2026. Cloak does not have to build browser
  automation or per-merchant scrapers:
  - **UCP** (Shopify + Google) — Agentic Storefronts on by default for all
    Shopify stores since 2026-03; UCP-compliant MCP servers expose
    discover → cart → checkout.
  - **ACP** (OpenAI + Stripe + Meta) — Shared Payment Token / Delegated
    Payments, so Cloak never touches a card number.

## Provider Facts (verified 2026-08-06)

| Mode | Input | Output | Price |
|---|---|---|---|
| `lucy-vton-3` realtime | live WebRTC camera + garment image | live stream | $0.02/sec |
| `lucy-vton-3` batch | MP4 (H.264/VP8, ≤200MB) + garment image | MP4 | $0.04/sec |
| image VTON | — | **does not exist** | — |

Consequences:

- There is no photo-in/photo-out mode. The subject side must be video.
- Batch is the P1 path: async submit + poll matches the existing `looks`
  polling architecture and avoids WebRTC on iOS.
- Garment side is unchanged from Fashn: one product image, ≥512×512, plain
  background preferred.

Unverified, resolve in the P0 spike: minimum/maximum batch clip duration, queue
latency at 3s, whether `reference_image` accepts a URL or requires a blob.

## Architecture

Three layers, shipped in order. Each is independently testable.

```text
L1  Motion try-on      Decart lucy-vton-3 batch      ← P1, this spec's slice
L2  Size prediction    height/weight + size chart    ← P2
L3  Agent checkout     UCP cart + ACP payment        ← P3, gated on P0 spike
```

### The digital body

The user records **one** 3-second turn video during onboarding. It is stored
once and reused as the subject input for every garment. After onboarding the
user-facing flow is unchanged from today: paste link → wait → see result. The
only difference is the result moves.

This keeps the added friction to a single one-time capture instead of a camera
session per garment.

---

# P1 — Motion Try-On

**Independently testable slice.** Ships without any checkout work. Value on its
own: the feed becomes video.

## Scope

- Capture and store a body video per user.
- Submit `lucy-vton-3` batch jobs against it with a garment image.
- Render the resulting MP4 in the iOS feed, looping, with an extracted poster
  frame for the grid.
- Keep the existing Fashn still-image pipeline intact as fallback.

## Data model

`users` — new columns (migration
`railway/migrations/20260806010000_motion_tryon.sql`):

```sql
alter table users
  add column if not exists body_video_url text,
  add column if not exists body_video_duration_ms integer,
  add column if not exists body_video_captured_at timestamptz;
```

`looks` — **no migration needed.** The existing schema already carries the
slice:

- `pipeline = 'motion'` — already in the check constraint, currently unused
- `video_url` — the Decart MP4
- `result_url` — the extracted poster frame (keeps grid rendering unchanged)
- `provider = 'decart'`, `provider_job_id` — the Decart job id

## API surface

### `POST /api/body-video`

- Accepts: `multipart/form-data` with one video file.
- Validates: MIME in {`video/mp4`, `video/quicktime`}, size ≤ 25MB,
  duration 2–5s. Reuse `lib/security.ts` validation patterns.
- Uploads to Cloudinary (video resource type), writes the three `users`
  columns.
- Returns: `{ bodyVideoUrl, durationMs }`.
- Rate limited via `lib/rate-limit.ts`, same policy as `/api/avatar`.

### `POST /api/looks/motion`

- Accepts: `{ userId, savedItemId? , garmentImageUrl? }` — exactly one of the
  latter two.
- Rejects with 409 `body_video_missing` if the user has no `body_video_url`.
- Creates a `looks` row: `pipeline='motion'`, `status='queued'`,
  `provider='decart'`.
- Submits `POST https://api.decart.ai/v1/jobs/lucy-vton-3` with the user's
  body video and the garment image as `reference_image`, stores
  `provider_job_id`, returns the look id immediately.
- Fire-and-forget: never blocks the request on generation.

### `GET /api/looks/[id]`

- Polls Decart, maps provider status onto the existing `TryOnStatus` enum,
  writes `video_url` and `result_url` on completion.

### `lib/decart.ts`

Mirrors the shape of `lib/fashn.ts` — `submitDecartVton()`,
`getDecartJobStatus()`, `getDecartApiKey()`. Key read from `DECART_API_KEY`,
server-side only, never shipped to the client. Add to `.env.local.example`.

## iOS changes

- `OnboardingView.swift` — new step after the selfie: 3-second guided turn
  capture (AVFoundation, front camera, countdown, retake). Copy states plainly
  that the clip is stored and reused for every try-on.
- `FeedView.swift` — when `look.videoUrl != nil`, render a looping muted
  `AVPlayer` instead of the still `Image`; otherwise fall back to `resultUrl`.
- `Models.swift` — add `videoUrl` to the `Look` model.
- `APIClient.swift` — `uploadBodyVideo()`, `createMotionLook()`.

## Acceptance scenarios

1. **Given** a user with no body video, **when** they open the feed and tap try
   on, **then** they are routed to body-video capture and the API returns 409
   `body_video_missing` rather than a generic 500.
2. **Given** a user with a stored body video, **when** they share a product
   link into Cloak, **then** a `looks` row is created with
   `pipeline='motion'`, `provider='decart'`, `status='queued'` within one
   request cycle, and the response returns before generation finishes.
3. **Given** a queued motion look, **when** the Decart job completes, **then**
   `video_url` is a playable MP4 and `result_url` is a poster frame extracted
   from it, and both are Cloudinary-hosted.
4. **Given** a completed motion look, **when** the user scrolls it into view in
   the iOS feed, **then** the video autoplays muted and loops, and scrolling
   away releases the player.
5. **Given** a Decart job that fails or times out, **when** the poll runs,
   **then** the look moves to `status='failed'` with a user-readable
   `error_message`, and the feed shows a retry affordance rather than a blank
   cell.
6. **Given** a user who already has still-image try-ons, **when** motion ships,
   **then** those existing looks still render unchanged.

## Cost model

| Item | Cost |
|---|---|
| One 3s motion try-on | 3 × $0.04 = **$0.12** |
| Body video storage | Cloudinary, one clip per user |
| Poster frame | free — extracted from the MP4, no second generation |

At $0.12 per generation, rate limiting exists to stop abuse, not to control
spend. Set the per-user daily cap in `lib/rate-limit.ts` accordingly and log
cumulative provider spend per user so the number is known before P3.

## Verification

- `npx tsc --noEmit` clean.
- `npm run build` clean.
- Migration applied against Railway; `looks` rows with `pipeline='motion'`
  round-trip.
- One real end-to-end run: a real 3s clip + a real Zara/Shopify product image
  through `POST /api/looks/motion` to a playable MP4. Record actual queue
  latency and attach the output. **No claim of P1 completion without this
  artifact.**
- iOS: `xcodebuild` build for the `Cloak` scheme + simulator run showing the
  looping video in the feed.

---

# P0 — Blocking Spike (run in parallel with P1)

**This decides whether P3 exists at all.** Run it before writing any checkout
code.

Shopify gates agents by trust tier. An agent profile is hosted at a well-known
URL and referenced on every UCP request. **Only higher tiers can complete
checkout directly**; lower tiers can only hand off to the merchant's own
checkout page — which breaks the entire "never leave Cloak" promise.

Tasks:

1. Register a Cloak agent profile against Shopify's UCP requirements.
2. Join the Universal Cart API early-access waitlist.
3. Against one real Shopify women's-fashion store, attempt: discover → build
   cart → complete checkout. Record which tier is granted and whether direct
   completion is permitted.
4. Confirm ACP delegated payment / shared payment token works with that
   merchant's processor.

Exit criteria: a written yes/no on "can Cloak complete a purchase without
handing the user off." If no, P3 is redesigned as assisted-checkout (Cloak
prefills, user confirms on merchant page) and the positioning changes with it.
Do not discover this after building P3.

---

# P2 — Size Prediction (sketch, not yet specified)

The forced decision point that rendering cannot answer: M or L. Inputs are
`users.height_cm` / `weight_kg` (already collected), the merchant size chart,
and post-delivery fit feedback.

Ship the feedback capture **with P1**, not later — one question after delivery
("合身嗎?" too small / just right / too big) written to `taste_events` with a
new event type. Without it there is no training signal and no return-rate
evidence, which is the entire leverage story.

# P3 — Agent Checkout (sketch, gated on P0)

UCP for cart and checkout, ACP shared payment token for money, Cloak never MoR
and never stores a card number. Requires an `orders` table, order status in
`ProfileView`, and a security review note per `AGENTS.md` before merge.

---

## Out of Scope

- Realtime WebRTC try-on / "digital mirror" mode. Decart supports it and has a
  Swift SDK, but it is a retention feature, not a P1 decision aid, and costs
  engineering that P1 does not need.
- Replacing the Fashn still-image pipeline. It stays as fallback and for users
  who decline video capture.
- Catalog ingestion, product search, recommendations from a merchant feed.
- Non-Shopify merchants. P3 targets Shopify women's DTC only, ~10 stores,
  manually onboarded.
- Multi-garment outfits and layering. Decart's own docs flag thick outer layers
  as a known weakness.
- Any user-facing claim of size or fit accuracy until P2 has evidence.

## Risks

| Risk | Mitigation |
|---|---|
| Shopify grants a low trust tier → no direct checkout | P0 spike resolves before P3 is built; fallback is assisted checkout |
| Return rate above store average → merchants block the channel | Capture fit feedback from P1; treat return rate as the product's primary metric, not engagement |
| Body-video capture kills onboarding conversion | Measure drop-off at the capture step; keep the Fashn still-image path as an opt-out |
| Decart pricing or availability changes | `lib/decart.ts` mirrors `lib/fashn.ts` behind the same provider shape; `looks.provider` already distinguishes them |
| Storing a video of the user raises the privacy bar above a selfie | Explicit consent copy at capture, deletion control in `ProfileView`, cover in the security review note |
