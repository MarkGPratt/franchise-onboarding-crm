# Franchise Onboarding CRM

A platform for The Surgeon Group (Drain Surgeon, Aircon Surgeon, Electro Surgeon) to manage
franchisee onboarding — checklists, document vault, notes, leads/CRM, calendars, and admin
user management.

This is the original application source, recovered and prepared for self-hosting and
ongoing editing.

## Tech stack

- Vite + React 18 + TypeScript
- shadcn/ui (Radix UI) + Tailwind CSS
- React Router v6, TanStack Query v5, react-hook-form + zod
- Supabase client (`@supabase/supabase-js`) for auth, database, storage, and edge functions

## Local development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:8080`.

## Backend configuration

The app talks to a Supabase-compatible backend via `src/lib/supabase.ts`, which now reads
its credentials from environment variables:

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If you leave `.env` empty or
missing, the app falls back to the **original backend** (`dmldlxuetpjwpgnwvtgw.databasepad.com`)
so it keeps working immediately — but for full control you should point it at your own
Supabase project.

### Setting up your own Supabase project

The folder above this one (`C:\Franchisee Onboarding`) contains a full export of the
original backend:

- `database.sql` — full schema (35 tables), RLS policies, triggers, and seed data
  (checklist sections/tasks, franchisees, divisions, etc.)
- `functions/` — Supabase Edge Functions (Deno): `manage-users`, `send-notification`,
  `send-stage-email`, `crm-dispatcher`, `daily-notes-digest`, `export-franchisee-notes-pdf`,
  `audit-auth-users`, `recover-admin-password`
- `storage/franchise-documents/` — uploaded files (checklist attachments and document vault)

To migrate to your own Supabase project:

1. Create a new project at supabase.com.
2. Adapt `database.sql` to the `public` schema (the export uses a project-specific schema
   name, `prj_Vr0kcOWXsNOm`) and run it via the SQL editor or `supabase db push`.
3. Replace the helper functions `is_admin()`, `is_staff()`, `my_role()`, and
   `my_franchisee_id()` so they use `auth.uid()` instead of the original
   `current_setting('request.jwt.claim.sub')` (a quirk of the original "databasepad.com"
   host).
4. Create a `franchise-documents` storage bucket and upload the contents of
   `storage/franchise-documents/`.
5. Deploy the edge functions in `functions/` with `supabase functions deploy`, setting
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for each.
6. Put your new project's URL and anon key into `.env`.

## User roles

- **admin** — full access, user management (via the `manage-users` edge function)
- **sales** — leads/CRM access
- **franchisee** — restricted to their own franchisee's onboarding data

## Deployment

Hosting configs are included for both:

- **Vercel** — `vercel.json` (build command `npm run build`, output `dist`, SPA rewrites)
- **Netlify** — `netlify.toml` (same build/output, SPA redirects)

Either platform: push this folder to a Git repo, import it, and set the `VITE_SUPABASE_URL`
/ `VITE_SUPABASE_ANON_KEY` environment variables in the project settings.

```bash
npm run build   # outputs to dist/
```

## Editing with Claude

Open this folder (`C:\Franchisee Onboarding`) in Cowork/Claude to make changes — Claude has
the full source, schema, and edge functions for context.

## Notes

- No `.git` repository is initialized yet. Run `git init` from this folder once it's on
  your machine (and remove any stray empty `.git/` directory first if present).
- `npm install` could not be run in this environment (network access to npmjs.org is
  blocked here) — run it locally before `npm run dev` / `npm run build`.
