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
