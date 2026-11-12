# CPHIA BioPage

A bilingual executive portfolio generator for CPHIA 2026 delegates.

## Stack
- Vite static frontend deployed on Cloudflare Pages
- Supabase Postgres, Auth, Storage and Edge Functions
- OpenAI `gpt-4o-mini` called only from the Supabase Edge Function

## Local development

```bash
npm install
npm run dev
```

The public Supabase URL and publishable key are configured in `src/config.js`. They are publishable identifiers, not server secrets. Never place an OpenAI key, Supabase secret key, or service-role key in frontend code or Git.

## Supabase

Apply the migration in `supabase/migrations/20261112120000_create_biopage_core.sql`, deploy the function in `supabase/functions/biopage-api/index.ts`, then set `OPENAI_API_KEY` in Supabase Dashboard → Edge Functions → Secrets.

Owner admin sign-in uses a Supabase magic link and is restricted server-side to `ahmadoulaminediouf40@gmail.com`.

## Cloudflare Pages

Build command: `npm run build`
Build output directory: `dist`
Production branch: `main`

## Privacy
CV text is processed in-memory by the browser and sent to the Edge Function for generation. The original PDF is not saved. Only the generated profile and portrait are kept. Drafts are private and can only be accessed with their secret edit link. Public profiles are exposed only after activation.
