# Railway Migration Notes

Cloak now uses Railway Postgres for application data and Cloudinary for public
images. The backend is the only code that sees `DATABASE_URL`; web and iOS
clients continue to use HTTP API routes.

## What Moves Cleanly

- `users`
- `garments`
- `tryons`
- `rate_limits`
- SQL triggers

Use the migration in `railway/migrations/20260427010000_initial_schema.sql`.
Do not expose the database URL to the client.

## What Needs Replacement

Railway does not provide the same public object storage API as a hosted image
service. Cloak uploads avatars and try-on outputs to Cloudinary.

Recommended options:

- Cloudinary for avatars and try-on outputs
- S3 / Cloudflare R2 for raw assets
- Keep Cloudinary for public media and Railway Postgres for data

## Deployment Steps

1. Add Railway Postgres.
2. Run `railway/migrations/20260427010000_initial_schema.sql`.
3. Set `DATABASE_URL` on the Next.js service.
4. Set `DATABASE_SSL=true` if the Railway connection requires TLS.
5. Set `FASHN_API_KEY` and Cloudinary credentials.

The iOS app should not know where the backend stores data.
