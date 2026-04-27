# Cloak Expo Prototype

Expo-based prototype shell for Cloak. The active native app is now the SwiftUI
project in `../ios`.

The app uses the existing Cloak backend:

- `POST /api/avatar`
- `GET /api/garments`
- `POST /api/scrape-garment`
- `POST /api/tryon`
- `GET /api/tryon/[id]`

## Setup

```bash
npm install
EXPO_PUBLIC_API_BASE_URL=http://localhost:3002 npm run ios
```

For a physical iPhone, use the LAN URL for the backend instead of localhost.

## Current Scope

- Fit photo upload
- Vertical garment feed
- Product URL import
- Garment screenshot upload
- Try-on job creation and polling
- Save/share generated result
- Deep link placeholder: `cloak://tryon?url=https://...`

## Native Share Extension

Implemented in the SwiftUI/XcodeGen project under `../ios`, not in this Expo
prototype.
