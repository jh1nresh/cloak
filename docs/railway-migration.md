# Railway Migration Notes

Railway can replace Supabase for Postgres-backed data, but it is not a direct
drop-in replacement for Supabase Storage.

## What Moves Cleanly

- `users`
- `garments`
- `tryons`
- `rate_limits`
- SQL functions and triggers

Use Railway Postgres with a server-side client such as `pg`, Prisma, or Drizzle.
Do not expose the database URL to the client.

## What Needs Replacement

The current avatar flow uploads to Supabase Storage. Railway does not provide the
same public object storage API.

Recommended options:

- Cloudinary for avatars and try-on outputs
- S3 / Cloudflare R2 for raw assets
- Keep Cloudinary for public media and Railway Postgres for data

## Practical Migration Path

1. Add Railway Postgres.
2. Move tables and migrations from `supabase/migrations`.
3. Replace `lib/supabase.ts` with a server-only database adapter.
4. Change `POST /api/avatar` to upload the photo to Cloudinary instead of
   Supabase Storage.
5. Update all API routes to use the new adapter.
6. Keep the iOS app unchanged because it only talks to the HTTP API.

The iOS app should not know whether the backend uses Supabase or Railway.
