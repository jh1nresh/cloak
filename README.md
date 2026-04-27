# Cloak

Mobile-first virtual try-on product with a Next.js backend, PWA fallback, and
native SwiftUI iOS client.

Users create an avatar from a selfie, provide a garment image by URL or upload,
then receive an AI-generated try-on result that can be saved or shared.
Product URLs imported into Cloak are saved as garments and become part of the
vertical fit feed. The native iOS app adds a Share Extension so users can send
product links or images into Cloak from the iOS share sheet.

## Stack

- Next.js App Router
- Tailwind CSS
- Supabase for avatar/result data
- Fashn.ai for try-on generation
- Cloudinary for watermarked output images
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

Before using the async try-on and shared rate limit flow, apply the Supabase
migration in `supabase/migrations`.

## Verification

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```
