# BAGLE FLIX

A subscription streaming platform whose catalogue contains **only AI-generated
films and series**. Two-sided: creators pay a monthly plan to host their work,
viewers pay a monthly subscription to watch it.

Operated by SV SOCIAL MEDIA LTD (Cyprus).

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS 4 |
| Data + Auth | Supabase (Postgres, Auth, Row Level Security) |
| Video | Bunny Stream (adaptive HLS, token auth, DRM) |
| Payments | Stripe Billing (subscriptions) |
| Hosting | Vercel, auto-deploy from `main` |

## The non-negotiable rule

**No video URL is ever public.** Playback always follows this path:

1. The browser requests a film.
2. The **server** checks that the user is authenticated and holds an active
   entitlement for it — a viewer subscription, ownership of the title, or admin.
3. Only then does the server mint a **short-lived signed Bunny token**.
4. The token expires within minutes and is bound to the session.

If a video ID or URL ever reaches an unauthenticated client, the whole
catalogue becomes downloadable. This is the core security requirement of the
product, not an optimisation.

Access is enforced in Postgres Row Level Security, not only in application code.

## Local development

Node.js 24 LTS is required.

```bash
npm install
cp .env.example .env.local   # then fill in the real values
npm run dev
```

The app runs at http://localhost:3000.

## Build status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Repo, Next.js foundation, Supabase schema + RLS, auth | In progress |
| 2 | Bunny Stream upload, signed playback, first film live | Not started |
| 3 | Catalogue, search, series support, creator dashboard | Not started |
| 4 | Stripe subscriptions, affiliates, admin panel | Not started |
| 5 | Stripe live activation, custom domain, legal + VAT | Not started |

Routes that exist but are not yet built render an honest "coming soon" screen —
no button on this site pretends to do something it cannot do.

## Secrets

Real keys live in `.env.local` (git-ignored) and in Vercel's environment
variable settings. They are never committed, and never sent over chat.
