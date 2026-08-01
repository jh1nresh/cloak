# Cloak

Mobile-first virtual try-on product with a Next.js backend, PWA fallback, and
native SwiftUI iOS client.

Users create an avatar from a selfie, provide a garment image by URL or upload,
then receive an AI-generated try-on result that can be saved or shared.
Product URLs imported into Cloak are saved as garments and become part of the
vertical fit feed. The native iOS app adds a Share Extension so users can send
product links or images into Cloak from the iOS share sheet.

The root web experience is a V0 women's fashion drop storefront:

- Browse 10 local demo products
- Search or filter by category, color, fit, and tags
- Open a product try-on studio
- Upload one shopper photo with explicit consent
- Generate a mock try-on comparison
- Leave Cloak through a per-product Shopify checkout placeholder

The storefront mock flow is intentionally separate from the paid Fashn.ai
try-on API. It does not persist uploads, create accounts, place orders, or
claim size/fit accuracy.

## Stack

- Next.js App Router
- Tailwind CSS
- Railway Postgres for users, garments, try-on jobs, and rate limits
- Fashn.ai for try-on generation
- Cloudinary for avatar images and watermarked output images
- Web app manifest + lightweight service worker for installability
- Web Share Target for opening shared product URLs into `/tryon`
- SwiftUI iOS app + Share Extension in `ios/`

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Useful local routes:

- `/` - drop storefront gallery
- `/products/satin-column-slip` - product try-on studio example
- `/privacy` - storefront upload consent and privacy copy
- `/tryon` - existing saved-link/avatar try-on app flow

## Storefront V0

The storefront product catalog lives in `lib/drop-products.ts`.

`POST /api/drop-tryon` is a mock provider for the V0 storefront. It accepts a
single image upload and product ID, validates file type and size, then returns a
preselected demo result image. No provider secret is required.

Allowed upload types: JPG, PNG, WebP, HEIC, HEIF.

Max storefront upload size: 8MB.

The checkout buttons use placeholder Shopify-style URLs from the local product
data. Replace each `checkoutUrl` with a real Shopify product/cart checkout URL
when the campaign drop is connected to a store.

## Native iOS

```bash
cd ios
xcodegen generate
xcodebuild -project Cloak.xcodeproj -scheme Cloak -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.4' CODE_SIGNING_ALLOWED=NO build
```

The iOS app defaults to `http://localhost:3002`; update
`ios/CloakApp/Info.plist` for a deployed API or physical-device testing.

## Environment

Required variables are listed in `.env.local.example`.

Before using the async try-on and shared rate limit flow, apply the Railway
Postgres migration in `railway/migrations`.

## Verification

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
npm run check
```
