# Campaigns — Criticals & Fumbles Subsite

A Cloudflare Worker serving `campaigns.criticalsandfumbles.com`. Lets GMs
publish and update "campaign dossiers" — animated, genre-themed session
update pages — and gives visitors a way to browse ongoing campaigns.

Separate Worker and separate GitHub repo from the main
criticalsandfumbles.com site, deployed independently, to keep its own
Cloudflare Workers Free-plan bundle-size budget (3 MiB gzip) isolated. It
shares the main site's Sanity **project and dataset** (not a second Sanity
project) — see `CLAUDE.md` for the full guardrails this repo follows.

## Stack

Cloudflare Worker (Wrangler) + [Hono](https://hono.dev) for routing +
server-rendered template literals (no frontend framework — see
`CLAUDE.md`'s bundle-size budget for why). Content lives in Sanity, same
project/dataset as the main site; this Worker is the only thing with
write access, via `SANITY_WRITE_TOKEN`. Auth is Cloudflare Access, not
app-level login.

## Local development

```bash
npm install
cp .env.example .env   # fill in SANITY_PROJECT_ID / SANITY_WRITE_TOKEN etc.
npm run dev             # wrangler dev
```

`npm run seed:dry` shows what the genre-theme seed script would create;
`npm run seed` (with `DRY_RUN=false` in `.env`) actually writes them.

## Routes

**Public:**
- `GET /:campaignSlug/:dossierCode` — a dossier page, themed via its campaign's `genreTheme`.
- `GET /:campaignSlug` — campaign session index.

**Console (behind Cloudflare Access):**
- `GET /console` — bulk grid + inline editor.
- `PATCH /api/dossier/:id`, `POST /api/dossier`
- `POST /api/upload` — 500KB hard cap on images, server-side authoritative.
- `GET /api/export.xml` (`?campaign=slug` to scope), `POST /api/import`
- `GET /api/export.csv?collection=objectives`, `POST /api/import/csv?collection=objectives`

Every `/console*` and `/api/*` route rejects requests missing
`Cf-Access-Authenticated-User-Email` with 401 — see `src/lib/auth.js`.

## Manual setup (not automatable — the project owner does these)

This scaffold deliberately provisions no cloud infrastructure. Steps to
take it live, in order:

1. **Create the Cloudflare Worker application** in the dashboard, on the
   same Cloudflare account that manages the criticalsandfumbles.com DNS
   zone (required for the custom domain step below to work).
2. **Attach the custom domain** `campaigns.criticalsandfumbles.com` to the
   Worker: Workers & Pages → Settings → Domains & Routes → Add Custom
   Domain.
3. **Generate a Sanity API token** (Editor role), scoped to the main
   site's existing Sanity project, for this Worker's exclusive use.
4. **Set Worker secrets:**
   ```bash
   wrangler secret put SANITY_PROJECT_ID
   wrangler secret put SANITY_DATASET
   wrangler secret put SANITY_API_VERSION
   wrangler secret put SANITY_WRITE_TOKEN
   ```
5. **Add the `campaign` / `dossier` / `genreTheme` schema types**
   (`schema/*.js` in this repo) to the main site's Sanity Studio config so
   they validate and are visible there too — coordinate with whoever
   maintains that repo (cnf-website; see its `docs/schemas.md`).
6. **Create a Cloudflare Access application** scoped to
   `campaigns.criticalsandfumbles.com/console*` and `/api/*`, add Google
   as the login method, and write a policy allowlisting GM email
   addresses.
7. **Create a Cloudflare API token** scoped to Workers Scripts:Edit +
   Workers Routes:Edit; add it and the account ID as `CLOUDFLARE_API_TOKEN`
   / `CLOUDFLARE_ACCOUNT_ID` secrets on this GitHub repo (Settings →
   Secrets and variables → Actions) so `.github/workflows/deploy.yml` can
   deploy on push to `main`.
8. **Run the seed script** (`npm run seed`, with `.env` filled in) to
   create the 6 genre-theme documents from `seed/genre-themes.json` in
   Sanity.
9. **On the main site**, add a "Campaigns" directory page/nav entry that
   queries this shared Sanity project for `campaign` documents and links
   out to `campaigns.criticalsandfumbles.com/<slug>`.

## Repo structure

```
src/
  worker.js        entry point, mounts routes + Access middleware
  routes/          one file per route group (dossier, console, api-*)
  lib/             sanity.js, xml.js, csv.js, theme.js, auth.js, sanity-image.js
  templates/       dossier.js (theme-parameterized), console.js, motifs.js
schema/            Sanity schema defs to hand off to the main site's Studio
seed/              genre-themes.json + seed.js
```

## Known deviation from the original scaffold brief

The brief's data model referenced `worldRef: reference -> wikiWorld`. The
main site's actual Sanity schema was checked directly (it's in the same
Claude Code session that scaffolded this repo) — the real registered type
name is `world`, not `wikiWorld`. `schema/campaign.js` uses the correct
name.
