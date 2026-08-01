# Cloak iOS

Native SwiftUI client for the Cloak try-on backend.

## Targets

- `Cloak`: SwiftUI app with onboarding, vertical garment feed, upload/link import, try-on submission, and result polling.
- `CloakShareExtension`: iOS share extension for product URLs, text containing URLs, and shared garment images.

## Setup

1. Install XcodeGen if needed: `brew install xcodegen`.
2. Start the Next API locally from the repo root: `npm run dev`.
3. Generate the Xcode project:

   ```sh
   cd ios
   xcodegen generate
   ```

4. Open `Cloak.xcodeproj` or build from CLI.

The app defaults to `http://localhost:3002` through `CLOAKAPIBaseURL` in `CloakApp/Info.plist`. For a device build, replace that value with the deployed API URL or your Mac LAN IP.

## Product Direction

This app keeps the backend as the source of truth. The iOS app should never talk directly to Railway Postgres or service-role credentials. Media storage is handled by the backend through Cloudinary.

## MVP Pages

- Onboarding creates or replaces the private fit profile.
- Discover is the vertical, full-screen garment feed.
- Import accepts a confirmed retailer URL or garment image.
- Closet separates locally saved pieces, completed try-ons, and confirmed ownership.
- Me shows fit-photo controls, local taste signals, privacy/data disclosure, and app information.
- Result covers processing, failure, original/me comparison, save, share, and retailer handoff.

Saved pieces, completed-look links, and taste totals are persisted on the device. The Owned section remains empty until purchase confirmation is connected; a save or retailer visit never creates ownership. Cloud deletion and personalized recommendation summaries are not implemented in this private-beta slice.
