# Spec: Cloak Link-to-Me App

## Goal

Turn Cloak from a one-shot virtual try-on tool into an iOS-first app where users
save fashion links from anywhere and see the original brand model photo
transformed so the main character is themselves.

Short positioning:

> Save any fashion link. Cloak turns the model into you.

This is closer to a Savee-style fashion save flow plus a Pose-style model swap
than a standard try-on form.

## User Promise

When a user shares a clothing link or image into Cloak:

1. Cloak saves and analyzes the item.
2. Cloak finds the best product imagery.
3. If there is an on-model image, Cloak keeps the brand's pose, styling,
   lighting, and scene, then swaps the model identity to the user.
4. If there is only a flat product image, Cloak falls back to virtual try-on on
   the user's avatar/photo.
5. The finished look appears in a vertical feed for saving, sharing, or buying.

The product loop is:

```text
Share clothing link
→ Cloak extracts best on-model image
→ model becomes you
→ save / skip / buy
→ Cloak learns your taste
→ Cloak recommends more items already shown on you
```

## Why This Is Different

Traditional try-on:

- User uploads a photo.
- User uploads a garment image.
- AI places the garment onto the user.

Cloak Link-to-Me:

- User shares a product page, editorial image, TikTok, Pinterest pin, or
  shopping screenshot.
- Cloak keeps the original fashion context.
- The brand photo becomes personalized.

The product should feel less like an AI utility and more like a personal fashion
feed.

Cloak should not ask users to describe their style upfront. Taste should be
learned from high-intent behavior: what users share, what they save, what they
skip, what they compare, and what they eventually buy.

## Core Flow

```text
iOS Share Sheet / paste URL / upload image
        |
        v
Create saved item
        |
        v
Fetch metadata and extract candidate images
        |
        v
Classify image set
        |
        +--> on-model image found --> Model Swap pipeline
        |
        +--> product-only image --> Try-On pipeline
        |
        v
Create look
        |
        v
Show in vertical feed
```

## App UX

### Onboarding: Create "Me"

- User uploads or captures a full-body fit photo.
- Selfie can be accepted as fallback, but the app should explain that full-body
  images produce better looks.
- Store:
  - `userId`
  - `avatarUrl`
  - optional generated model/profile image
  - optional body metadata later

### Capture: Share to Cloak

Primary entry point:

- User opens Safari, TikTok, Instagram, Pinterest, SSENSE, Zara, etc.
- User taps Share.
- User selects Cloak.
- Cloak receives one of:
  - product URL
  - plain text containing a URL
  - image
  - screenshot

The Share Extension should create a saved item immediately and open the main app
only when needed.

### Feed: Swipe Looks

- Vertical swipe is the primary browse behavior.
- Each item is a generated look, not a form.
- Right-side actions:
  - save
  - share
  - buy/open original link
  - regenerate
  - compare original
- Every action should write a taste signal:
  - save = positive intent
  - skip = negative intent
  - buy/open original link = purchase intent
  - regenerate = interest but poor generation/source image
  - compare original = trust/quality evaluation
- Horizontal swipe or segmented control can switch variants:
  - original brand photo
  - me version
  - alternate source image
  - alternate generation

## Taste Learning

Cloak's long-term advantage should come from a taste graph built from real
shopping behavior, not a quiz.

Track signals:

- saved links
- skipped looks
- buy/open-original clicks
- shared looks
- regenerated looks
- preferred brands
- preferred categories
- preferred colors
- preferred silhouettes
- preferred price bands
- items that looked good in the original brand image but bad on the user

The recommendation feed should eventually rank items by:

- similarity to saved and bought items
- dissimilarity from skipped items
- fit with preferred brands/categories/colors/silhouettes
- price-band compatibility
- confidence that the item will generate well on the user
- freshness from sources the user already browses

Recommendation cards should not be plain product listings. The primary asset
should be the generated "me" version, with original product imagery available
for comparison.

## AI Pipelines

### Pipeline A: Model Swap

Use when source imagery already has a person wearing the garment.

Inputs:

- source on-model image
- user reference image / generated user model

Output:

- same brand image with the model identity changed to the user

Expected qualities:

- preserve clothing
- preserve pose
- preserve lighting
- preserve styling
- preserve background
- make the main subject look like the user

This is the hero pipeline because it preserves the brand aesthetic.

### Pipeline B: Try-On Fallback

Use when source imagery is a flat-lay, hanger photo, white-background product
image, or screenshot without a model.

Inputs:

- user avatar/photo
- garment image

Output:

- garment shown on the user

Expected qualities:

- keep user identity
- keep body/pose as much as possible
- place garment realistically

### Pipeline C: Motion Preview

Not MVP. After static look quality is good, convert a successful look into a
short 5-10 second motion clip.

Inputs:

- completed look image

Output:

- short video suitable for sharing

## Backend Data Model Additions

Existing tables can stay, but the model should evolve from only `garments` and
`tryons` to saved items and looks.

### `saved_items`

Represents something the user saved into Cloak.

Fields:

- `id`
- `user_id`
- `source_type`: `url`, `image`, `screenshot`, `text`
- `source_url`
- `source_domain`
- `title`
- `brand`
- `price`
- `status`: `saved`, `analyzing`, `ready`, `failed`
- `error_message`
- `created_at`
- `updated_at`

### `item_images`

Candidate images extracted from a saved item.

Fields:

- `id`
- `saved_item_id`
- `image_url`
- `width`
- `height`
- `rank`
- `classification`: `on_model`, `flat_product`, `editorial`, `logo`,
  `unknown`
- `selected_for_generation`
- `created_at`

### `looks`

Generated personalized outputs.

Fields:

- `id`
- `user_id`
- `saved_item_id`
- `source_image_id`
- `pipeline`: `model_swap`, `tryon`, `motion`
- `status`: `queued`, `processing`, `finalizing`, `completed`, `failed`
- `provider`
- `provider_job_id`
- `result_url`
- `video_url`
- `error_message`
- `created_at`
- `updated_at`

### `taste_events`

Append-only interaction events used to learn taste.

Fields:

- `id`
- `user_id`
- `saved_item_id`
- `look_id`
- `event_type`: `save`, `skip`, `buy_click`, `share`, `regenerate`,
  `compare_original`
- `metadata`
- `created_at`

### `taste_profile`

Materialized user taste summary derived from `taste_events`.

Fields:

- `user_id`
- `preferred_brands`
- `preferred_categories`
- `preferred_colors`
- `preferred_silhouettes`
- `preferred_price_bands`
- `negative_brands`
- `negative_categories`
- `updated_at`

## API Shape

### `POST /api/items`

Create a saved item from a URL, text, or image upload.

Returns:

```json
{
  "itemId": "uuid",
  "status": "saved"
}
```

### `POST /api/items/[id]/analyze`

Fetch metadata, extract images, classify candidates, and select the best image.

Returns:

```json
{
  "itemId": "uuid",
  "status": "ready",
  "selectedImageId": "uuid",
  "recommendedPipeline": "model_swap"
}
```

### `POST /api/items/[id]/generate`

Start the generation job.

Rules:

- `model_swap` when selected image is `on_model` or `editorial`
- `tryon` when selected image is `flat_product`
- reject or ask for manual image selection when image quality is too low

Returns:

```json
{
  "lookId": "uuid",
  "status": "processing"
}
```

### `GET /api/looks/[id]`

Poll generation status and return the completed result.

### `GET /api/feed`

Return completed and in-progress looks for the vertical feed.

### `POST /api/taste-events`

Record save, skip, buy click, share, regenerate, and compare actions.

Returns:

```json
{
  "ok": true
}
```

### `GET /api/recommendations`

Not required for the first slice. Later, return recommended saved/generated
items ranked from the user's taste profile.

## Image Selection Heuristics

For product URLs, prefer images in this order:

1. Large on-model product images.
2. Editorial/lifestyle images with a visible full or half body.
3. Product-only images with clean clothing visibility.
4. Open Graph image as fallback.

Reject or deprioritize:

- thumbnails
- logos
- sprites
- tiny images
- images below minimum dimensions
- duplicate URLs
- images with multiple unrelated products

## MVP Scope

Build this first:

- iOS Share Extension receives URL/text/image.
- Backend creates a saved item.
- URL analyzer extracts metadata and candidate images.
- Basic image classification chooses `on_model` vs `flat_product`.
- `model_swap` generation path for on-model photos.
- `tryon` fallback for flat product photos.
- Vertical feed shows saved/generated looks.
- Result supports original/me comparison, share, and open original link.
- Save, skip, buy/open-original, regenerate, share, and compare actions create
  taste events.

## Out of Scope For First MVP

- Full authentication system
- Public social graph
- Comments/likes/following
- Size recommendation
- Price tracking
- Browser extension
- Multi-brand closet analytics
- Motion/video generation
- Automatic checkout
- Fully personalized recommendation feed

## Product Risks

- Ecommerce scraping is unreliable; many sites block bots or hide images behind
  client-side rendering.
- Model swap quality is only valuable if identity is strong and clothing remains
  faithful.
- Some product pages have no good on-model image.
- AI generation cost can be abused without login, quota, or waitlist controls.
- User photos are sensitive data; deletion and privacy controls are required
  before public launch.

## Launch Readiness

Internal MVP is ready when:

- a product URL can be shared into Cloak from iOS
- Cloak extracts a usable image
- Cloak chooses the right pipeline
- the generated look appears in the feed
- the result can be shared
- feed actions write taste events

Private beta is ready when:

- production Railway, Cloudinary, and AI provider credentials are configured
- real-device Share Extension flow works
- at least 20 real product URLs across several brands generate acceptable looks
- rate limits and cost controls are active
- user data deletion exists

## References

- Jaytel Pose tweet, 2026-05-26:
  https://x.com/Jaytel/status/2059320775841079493
- Apple Share Extension documentation:
  https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html
- FASHN Model Swap:
  https://docs.fashn.ai/api-reference/model-swap
- FASHN Try-On:
  https://docs.fashn.ai/api-reference/tryon-max
- FASHN Image to Video:
  https://docs.fashn.ai/api-reference/image-to-video
