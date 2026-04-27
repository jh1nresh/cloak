# Spec: Cloak V1 — Virtual Try-On PWA

## Goal
Build a mobile-first PWA where users upload a selfie + clothing item and get an AI-generated try-on image they can share.

## Tech Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **PWA:** next-pwa for installability
- **Backend:** Next.js API routes
- **Try-on AI:** Fashn.ai try-on API
- **Storage:** Supabase (user avatar + try-on history)
- **Image hosting:** Cloudinary (output images with watermark)
- **Deployment:** Vercel-ready

## Pages & Routes

### `/` — Landing / Redirect
- If user has avatar → redirect to `/tryon`
- If no avatar → redirect to `/onboarding`

### `/onboarding` — Create Avatar
- Step 1: Camera capture (use device front camera) OR upload photo
- Step 2: Input height (cm) and weight (kg) — optional but shown
- Step 3: "Create My Avatar" button → saves to Supabase + localStorage
- Design: Clean, feminine aesthetic. White + soft pink/nude tones.

### `/tryon` — Try On
- Top: small avatar preview thumbnail (tap to change)
- Input area: 
  - Option A: "Paste product URL" text input + fetch button (scrapes product image)
  - Option B: "Upload photo / screenshot" file upload
- "Try It On" CTA button (disabled until garment image ready)
- Shows loading state while Fashn.ai processes (~5-30s)
- On success → redirect to `/result/[id]`

### `/result/[id]` — Result
- Full-screen try-on image
- Below image: 
  - "💾 Save Photo" — downloads image with watermark
  - "🔗 Share" — copies shareable link to clipboard + shows toast
  - "👗 Try Another" — back to /tryon
- Watermark: "Cloak" logo + small QR code linking to domain

### `/share/[id]` — Shareable Page (for friends)
- Shows the try-on result image
- CTA: "Try this on yourself →" → goes to /onboarding
- Meta tags for good OG preview (og:image = the try-on result)

## API Routes

### `POST /api/avatar`
- Accepts: multipart/form-data (photo, height, weight)
- Uploads photo to Supabase Storage
- Saves user record to Supabase DB
- Returns: { userId, avatarUrl }

### `POST /api/scrape-garment`
- Accepts: { url: string }
- Scrapes product page with cheerio/fetch
- Extracts main product image (largest image on page)
- Returns: { imageUrl }

### `POST /api/tryon`
- Accepts: { avatarUrl, garmentImageUrl or garmentImageBase64 }
- Calls Fashn.ai try-on API
- Polls until complete
- Uploads result to Cloudinary with watermark
- Saves to Supabase (tryons table)
- Returns: { tryonId, resultImageUrl }

### `GET /api/tryon/[id]`
- Returns try-on record for share page

## Database Schema (Supabase)

```sql
-- users table
create table users (
  id uuid primary key default gen_random_uuid(),
  avatar_url text not null,
  height_cm integer,
  weight_kg integer,
  created_at timestamptz default now()
);

-- tryons table
create table tryons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  garment_url text,
  result_url text not null,
  created_at timestamptz default now()
);
```

## Fashn.ai Integration

Model: `tryon-v1.6`

```typescript
const response = await fetch("https://api.fashn.ai/v1/run", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.FASHN_API_KEY}`,
  },
  body: JSON.stringify({
    model_name: "tryon-v1.6",
    inputs: {
      model_image: avatarImageUrl,
      garment_image: garmentImageUrl,
      category: "auto",
      mode: "performance",
      output_format: "jpeg",
    },
  }),
});
```

## Environment Variables (.env.local)
```
FASHN_API_KEY=your_fashn_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Design System
- **Primary color:** #1A1A1A (near black)
- **Accent:** #E8C4B8 (dusty rose / nude)
- **Background:** #FAFAFA
- **Font:** Inter or Geist
- **Mobile-first:** all layouts designed for 390px width first
- **Rounded corners everywhere:** border-radius 16px+
- **Minimal:** no clutter, lots of whitespace

## Acceptance Criteria
- [ ] `/onboarding` captures photo and saves avatar to Supabase
- [ ] `/tryon` accepts URL input and scrapes garment image
- [ ] `/tryon` accepts direct image upload
- [ ] Fashn.ai API call works and returns try-on image
- [ ] `/result/[id]` shows result with share + download buttons
- [ ] `/share/[id]` shows result with "try it yourself" CTA
- [ ] OG meta tags on share page for good link previews
- [ ] PWA manifest + service worker (installable on mobile)
- [ ] All pages work on mobile (test at 390px)
- [ ] `tsc --noEmit` passes
- [ ] `.env.local.example` file included with all required vars

## Out of Scope (V1)
- Authentication / login
- Size recommendations
- Trust scores / ZK reviews
- 3D avatar
- Native app / App Clip
- Payment processing
- Analytics
