# CPHIA BioPage

A bilingual (English / French) executive portfolio generator designed for CPHIA 2026 networking. It turns a participant's text-based PDF CV into an editable professional profile and, after manual activation, a shareable page with contact actions and a QR code.

## Production

- Public application: https://cphia-biopage.ahmadoulaminediouf40.workers.dev
- Frontend hosting: Cloudflare Worker `cphia-biopage` (static application assets served by the Worker).
- Backend: Supabase project `CPHIA BioPage` (`vxdddtchpksfcfymirou`, region `eu-west-3`).
- AI profile generation: OpenAI Chat Completions API, model `gpt-4o-mini`, called only by the Supabase Edge Function.
- Owner account: `ahmadoulaminediouf40@gmail.com`.

The Worker is currently deployed directly through the Cloudflare API. GitHub commits do **not** trigger an automatic production deployment. After changing frontend files, publish the updated static asset snapshot to the Worker.

## Stack

- Vite and browser ES modules for local frontend development.
- Supabase Postgres, Auth, private Storage bucket and Edge Functions.
- OpenAI `gpt-4o-mini` for bilingual CV-to-profile generation.
- PDF.js for in-browser text extraction, QRCode for QR generation, and Supabase JS client.

## Local development

```bash
npm install
npm run dev
```

The public Supabase URL and publishable key are configured in `src/config.js`. These are intended for browser use and are not server secrets. Never put an OpenAI key, Supabase secret key, or service-role key in frontend code or Git.

## Supabase setup

The three migrations in `supabase/migrations/` document the exact migrations already applied to the production database. They are historical records of the live setup; do not blindly reapply them to the existing production project.

1. Create or select a Supabase project.
2. Apply the migrations in timestamp order when provisioning a new, empty database.
3. Deploy `supabase/functions/biopage-api/index.ts` as the Edge Function `biopage-api` with JWT verification disabled; the function performs its own private edit-token and owner-email checks.
4. Add `OPENAI_API_KEY` in Supabase Dashboard → Edge Functions → Secrets. The secret must remain server-side.
5. In Authentication → URL Configuration, set the Site URL to the production URL above and add the exact redirect URL `https://cphia-biopage.ahmadoulaminediouf40.workers.dev/admin`.

The owner dashboard sends a Supabase magic link and accepts only `ahmadoulaminediouf40@gmail.com`. Supabase Auth must allow the production redirect URL or the magic-link flow will not complete.

## Profile and activation flow

1. A participant uploads a text-based PDF CV and a portrait, enters a WhatsApp number and optional LinkedIn URL, and consents to AI-assisted processing.
2. The browser extracts CV text; the original PDF is not uploaded or retained.
3. The Edge Function generates the bilingual profile, stores the profile draft and portrait, and returns a private edit link. The original edit token is not stored; only its SHA-256 hash is retained.
4. The participant edits content, portrait, WhatsApp number and LinkedIn URL before publication.
5. The owner verifies payment separately, generates a single-use activation code in `/admin`, and shares it with the participant. There is no integrated card-payment gateway in this release.
6. A valid one-time code activates the public page. Public pages expose the generated professional content and contact options; portrait images are served through signed URLs from a private Storage bucket.

The displayed activation price and WhatsApp contact are configurable in the frontend source. Activation codes should only be issued after payment has been confirmed by the owner.

## Privacy and security notes

- Original CV PDFs are not stored.
- Draft profiles and activation data are inaccessible to `anon` and `authenticated` roles through the Data API; backend access uses the service role only.
- Row Level Security is enabled on all BioPage tables.
- Portraits are stored in the private `biopage-portraits` bucket with a 5 MB upload limit and signed URLs.
- Draft access requires a high-entropy private edit token; only its SHA-256 hash is stored.
- CV generation is rate-limited per client IP hash.
- Never expose the Supabase service-role/secret key or `OPENAI_API_KEY` in the browser or repository.

## Important

CPHIA BioPage is an independent networking tool. It is not an official CPHIA or Africa CDC service and does not verify delegate status.
