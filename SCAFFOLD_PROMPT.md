# Scaffold prompt: Criticals & Fumbles — Campaigns Subsite

Paste this whole document into a coding agent (or read it yourself) to scaffold the repo. It is self-contained — the agent doesn't need any other context.

## What this is

A Cloudflare Worker application that serves `campaigns.criticalsandfumbles.com`, a subsite of criticalsandfumbles.com (a Singapore TTRPG community site, Next.js + Sanity). This subsite lets GMs publish and update "campaign dossiers" — animated, genre-themed session-update pages — and gives visitors a way to browse ongoing campaigns. It is intentionally a **separate Worker and a separate GitHub repo** from the main site, to keep its own dependency/bundle-size budget isolated (Cloudflare Workers Free plan caps a script at 3MiB gzip-compressed) and to let it deploy independently.

**Target repo:** `https://github.com/criticals-and-fumbles/campaigns`

**Scope of this task:** scaffold the repo structure, config, and application code described below. Do **not** provision any cloud infrastructure (no creating the actual Cloudflare Worker resource, no DNS, no Sanity project/tokens, no GitHub secrets) — those are manual steps the project owner does after this scaffold is reviewed. See "Manual setup (not part of this task)" at the end.

## Reference files (attached alongside this prompt)

Treat these as the source of truth for visual design and interaction behavior — port their logic into the real application rather than redesigning from scratch:

- `campaign-dossier-concept.html` — the single dossier template all campaigns use (glitch/signal-corruption title, scan-line overlay, animated meters, media feed, audio-log player, dark/light toggle). This exact color/font/copy set is Bureau Noir's (sci-fi) look; other genres reskin the same structure via their `genreTheme` — see `campaign-dossier-fantasy-concept.html`, `campaign-dossier-horror-concept.html`, and `campaign-dossier-modern-concept.html` for worked examples of that reskinning in practice.
- `campaign-dossier-fantasy-concept.html` — the same template reskinned for a Fantasy (D&D 5e / Pathfinder-style) campaign: blue/orange palette, Cinzel/Crimson Pro fonts, quest-oriented section labels, a magic-circle sweep in place of the radar sweep, an added Party Status panel.
- `campaign-dossier-horror-concept.html` — the same template reskinned for a Horror (Call of Cthulhu / Zombicide-style) campaign: black/red palette, Special Elite/Courier Prime fonts, incident-report section labels, signal-corruption title distortion, an added Survivor Status panel.
- `campaign-dossier-modern-concept.html` — the same template reskinned for a Modern investigative campaign (Shattered Tales): a colder ice-blue/slate-grey palette (deliberately more restrained/clinical than the other three — no second vivid accent color), Space Grotesk/Inter/JetBrains Mono fonts, case-file section labels, a padlock-unlock boot motif, an added Case Status panel.
- `admin-console-concept.html` — the GM-facing admin console: a bulk spreadsheet-style grid of all dossiers with inline-editable cells, a per-dossier detail editor, and working XML/CSV export-import (currently wired to in-memory mock data — needs to be rewired to call the real Worker API routes below).
- `sanity-proxy-worker.js` — a real (not mock) Worker source implementing the API routes this app needs: field-level Sanity PATCH mutations, asset upload with a 500KB cap, XML export, XML bulk import. Use this as the starting point for `src/worker.js` / `src/routes/*`, adjusting as needed for the data model below.
- `genre-theme-examples.json` — example theme documents (colors, fonts, section-label dictionaries) for each genre. Use this shape for the `genreTheme` schema and as seed/fixture data.

There is **one dossier template**, not multiple layout modes — every campaign, regardless of genre, renders through the same component. What changes per campaign is entirely data-driven from its `genreTheme`: colors, fonts, and section-label copy. Do not build a layout-mode switch or a second template family; the four dossier reference HTML files above are the same markup/structure with different theme values plugged in — port it that way.

## Tech stack & hard constraints

- **Cloudflare Worker**, deployed with Wrangler. Not Cloudflare Pages.
- **Keep the deployed script under Cloudflare Workers' Free-plan 3MiB gzip-compressed limit.** Avoid heavy frontend frameworks bundled server-side; prefer minimal dependencies. If SSR/templating is needed, use something lightweight (e.g. `hono` + template literals, or a small JSX-less approach) rather than a full framework.
- **Sanity CMS is the content store — same Sanity *project* and *dataset* as the main criticalsandfumbles.com site** (already exists; this repo does not create a new Sanity project). This repo adds new document types to that shared schema: `campaign`, `dossier`, `genreTheme`. Do not create a second Sanity project or a second dataset — cross-references (`dossier` → `wikiWorld`, if the main site's schema has one) depend on being in the same dataset.
- **No Sanity Studio for content editing, ever.** All writes happen through this Worker's own API routes using a service-level Sanity write token stored as a Worker secret (`SANITY_WRITE_TOKEN`), never sent to the browser. GMs never get individual Sanity accounts or tokens.
- **No R2 / no external object storage.** Images and files upload straight into Sanity's native asset pipeline (`image` / `file` document types, referenced via `asset._ref`), not stored as plain URL strings.
- **Auth is Cloudflare Access, not app-level auth.** Access sits in front of `/console/*` and any `/api/*` write routes at the Cloudflare edge (configured outside this repo). The Worker code should read and trust the `Cf-Access-Authenticated-User-Email` request header for identifying/attributing which GM made an edit — it must NOT implement its own login, session, or password system.
- **Images capped at 500KB.** Client-side: downscale to a max ~1920px edge and re-encode as WebP, stepping quality down until under 500KB, before uploading. Server-side: hard-reject (413) any upload over 500KB regardless of what the client did — the server check is authoritative.
- No `localStorage` / `sessionStorage` anywhere in browser-side code.
- XML is the canonical full-fidelity import/export format (nested dossier structure — meta, overview, threat/meter rows, objectives, media, log). CSV/spreadsheet export is a secondary, flattened view scoped to one repeating collection at a time (e.g. all objectives across all dossiers) for fast bulk edits — not a full-dossier format.

## Data model to implement (Sanity schema, additive to the main site's existing schema)

```
genreTheme
  genre: string            // "Sci-Fi" | "Fantasy" | "Horror" | "Modern" | "Site" | ...
  campaignOverride: bool   // true if this is a one-off override rather than a shared genre default
  colors: { dark: {bg, accentA, accentB, text}, light: {bg, accentA, accentB, text} }
  fonts: { display, body, mono }
  labels: { dossier, overview, location, meterSection, meterItem, objectives,
            objectivePriorityHigh, objectivePriorityMid, objectivePriorityLow,
            log, media, statPanel }
    // `location` was missing from the original spec despite every concept having a whole
    //   tabbed section for it with a genre-varying heading ("Location" / "The Realm" / "Zone Map").
    // `statPanel` titles the optional statTiles strip ("Party Status" / "Survivor Status") —
    //   leave it unset for genres that don't use the panel; the section just won't render.
  loadingScreen: { motif, bootTitle, bootSubtitle }
    // motif is a data-driven switch, NOT a per-genre hardcoded boot component:
    //   "terminal-decrypt" — boot text characters scramble through random glyphs
    //     and lock left-to-right into the final message (sci-fi/Bureau Noir)
    //   "wax-seal"          — a seal glyph cracks in half and falls away (fantasy)
    //   "vhs-tracking"      — a tracking-error band sweeps down twice while boot
    //     text renders as chromatic-aberration glitch, then locks clear (horror)
    //   "file-unlock"       — a padlock on a case-file glyph clicks open (modern)
    // All four built reference HTML files implement their respective motif
    // (terminal-decrypt, wax-seal, vhs-tracking, file-unlock) — port each as a
    // small reusable animation module the boot screen selects by
    // `theme.loadingScreen.motif`, not by campaign or genre name.

campaign
  title: string
  slug: slug
  genre: string
  system: string              // the actual game system, e.g. "D&D 5e", "Pathfinder 2e",
                               //   "Call of Cthulhu 7e", "Zombicide", "Infinity". Lives here,
                               //   NOT per-dossier — it doesn't change session to session.
  status: "active" | "recruiting" | "hiatus" | "concluded"
  gmNames: array of string
  theme: reference -> genreTheme
  heroImage: image (Sanity asset)
  hook: text                  // short description for the directory card
  sessionCount: number
  motto: string                // campaign-level flavor line shown in the dossier footer
                               //   (e.g. "Arachne is not a system...", "Where titans fell...")
  signOff: string               // footer attribution, e.g. "BUREAU NOIR COMMAND", "THE GUILDMASTER"
  worldRef: reference -> wikiWorld (optional; only if the main site's schema has this type)

dossier
  code: string                 // e.g. "BN-DAWN-119-08"
  campaign: reference -> campaign
  title: string
  classification: string        // e.g. "TOP SECRET", "RESTRICTED", "Party Eyes Only"
  distribution: string           // e.g. "PLAYER-FACING", "SURVIVOR CELL ONLY"
  sessionLabel: string            // free text — "8", "Day 41", "28.06.119 IC" — genreTheme's
                                  //   labels decide whether the classbar calls this "SESSION" or "DATE"
  location: string                // short location name, used as page subtitle
  overview: text
  heroImage: image
  quickFacts: array of { _type: "factRow", label, value }
                                   // the kv-panel beside Overview — fully free-form per campaign,
                                   //   e.g. sci-fi: GM Clock, Nomad Relations, Active Complication;
                                   //   fantasy: Guild Standing, In-Game Date; horror: Comms Status
  locationFacts: array of { _type: "factRow", label, value }
                                   // the kv-panel beside the location/map — same free-form pattern,
                                   //   scoped to the location section instead of the overview section
  statTiles: array of { _type: "statTile", value, label }
                                   // OPTIONAL 4-tile status strip under the meters section —
                                   //   fantasy's Party Status (level, headcount, torches, days-to-winter),
                                   //   horror's Survivor Status (survivors, supplies, exposure, water).
                                   //   Omit/empty array if a campaign doesn't use one (sci-fi currently
                                   //   doesn't) — the section only renders when this array is non-empty.
  threatAssessment: array of { _type: "meterRow", label, level }
  objectives: array of { _type: "objective", priority: "primary"|"secondary"|"tertiary", status: "open"|"done", title, description }
  media: array of { _type: "mediaItem", kind: "image"|"audio"|"video", asset: image|file, caption }
  log: array of { _type: "logEntry", ts, entry }
  lastEditedBy: string          // populated server-side from Cf-Access-Authenticated-User-Email
  lastEditedAt: datetime
```

Note on `quickFacts` / `locationFacts`: these are intentionally generic label/value arrays rather than fixed fields, because every concept uses a *different set* of facts (sci-fi tracks "Nomad Relations" and "Arachne Coverage"; fantasy tracks "Guild Standing" and "Known Hazards"; horror tracks "Comms Status" and "Structural Hazards" under the same slot). Modeling each genre's facts as named schema fields would mean a schema change every time a new genre or campaign wants a different fact — the array-of-label-value pattern lets a GM define whatever's relevant per campaign, through the console, with zero schema changes.

Seed the project with the six example theme documents from `genre-theme-examples.json`: site default (emerald/pink), sci-fi default (green/red), the Bureau Noir sci-fi override (emerald/pink), fantasy default (blue/orange), horror default (black/red), and modern default (ice-blue/slate-grey — deliberately colder/more restrained than the other three, no second vivid accent color).

## Routes to implement

**Public:**
- `GET /:campaignSlug/:dossierCode` — renders a dossier using its campaign's theme (color tokens, fonts, section labels, loading-screen motif).
- `GET /:campaignSlug` — optional campaign landing/session-index page.

**Console (behind Cloudflare Access):**
- `GET /console` — the admin console (bulk grid + inline editor), ported from `admin-console-concept.html`, wired to real data instead of the mock array.
- `PATCH /api/dossier/:id` — body `{ field, value, ifRevisionId? }`; single-field Sanity mutation. Include the optimistic-concurrency `ifRevisionID` guard when provided.
- `POST /api/dossier` — create a new dossier document.
- `POST /api/upload` — multipart upload, `kind: "image"|"file"`; 500KB hard cap on `kind: "image"`; pushes to Sanity's asset API; returns the asset reference for the client to PATCH onto a dossier field.
- `GET /api/export.xml` — full XML export of all dossiers (or `?campaign=slug` scoped).
- `POST /api/import` — multipart XML upload; parses with a Workers-compatible parser (`fast-xml-parser`, not `DOMParser`); bulk `createOrReplace` mutation in one transaction; return a summary (created/updated/failed counts, with reasons for failures — no silent partial imports).
- `GET /api/export.csv?collection=objectives` — flattened CSV of one repeating collection across all dossiers.
- `POST /api/import/csv` — bulk-patches that collection back in from an edited CSV.

Every route under `/api/*` and `/console*` must reject requests missing `Cf-Access-Authenticated-User-Email` with 401 — that header's presence is what Access guarantees, and the Worker should never assume it's running unprotected.

## Repo structure

```
/campaigns
  wrangler.toml               # name, compatibility_date; routes/custom_domain left commented
                               #   out with a note that the domain is attached manually
  package.json
  src/
    worker.js                 # entry point, routes to handlers
    routes/
      dossier.js               # public dossier render
      console.js                # admin console page
      api-dossier.js            # PATCH/POST dossier
      api-upload.js              # asset upload + 500KB gate
      api-export-xml.js
      api-import-xml.js
      api-export-csv.js
      api-import-csv.js
    lib/
      sanity.js                 # sanity fetch/mutate helpers
      xml.js                     # serialize/parse
      csv.js
      theme.js                   # resolves a campaign's genreTheme into CSS vars + labels
    templates/
      dossier.js                   # port of campaign-dossier-concept.html, theme-parameterized
                                    #   (see campaign-dossier-fantasy-concept.html and
                                    #   campaign-dossier-horror-concept.html for how the same
                                    #   structure should reskin per genreTheme)
      console.js                   # port of admin-console-concept.html
  schema/
    genreTheme.js               # Sanity schema definitions to hand off to the main
    campaign.js                  # site's Studio config (this repo doesn't run Studio,
    dossier.js                   # but the types must be declared somewhere shared)
  seed/
    genre-themes.json           # copy of genre-theme-examples.json, ready to seed via script
  .github/workflows/deploy.yml  # wrangler deploy on push to main
  README.md                     # must document every manual step below
```

## CI/CD

GitHub Actions workflow, triggered on push to `main`, running `wrangler deploy`. Expects two repo secrets that will be added manually (see below): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Use `cloudflare/wrangler-action` (or equivalent) rather than hand-rolling the deploy step.

## Explicit non-goals (already decided against, do not reintroduce)

- No R2 bucket, no Decap CMS / git-based CMS, no Sanity Studio editing flow, no SAML auth, no per-campaign separate Worker or separate Sanity project (all campaigns share this one Worker and the shared Sanity project/dataset via the `campaign` reference on each dossier), no browser storage APIs.

## Project conventions (CLAUDE.md)

This repo should carry its own `CLAUDE.md` at the root, applying the **same guardrails and modularization policies already established in the main criticalsandfumbles.com site's `CLAUDE.md`** — same rules, applied to this codebase, not a different or looser standard just because it's a smaller subsite.

Important: this scaffold prompt does not itself contain the main site's `CLAUDE.md` content. Whoever runs this prompt should paste or attach the main site's `CLAUDE.md` alongside it so the scaffolding agent can port the actual policies over verbatim (adjusting only what's genuinely repo-specific, like directory names or the tech-stack section if it differs) rather than inventing new guardrails from scratch. Do not proceed to write this repo's `CLAUDE.md` without that source file in hand — flag it as missing and ask for it rather than guessing at what the guardrails say.

## Manual setup (not part of this task — the project owner does these after reviewing the scaffold)

1. Create the actual Cloudflare Worker application in the dashboard (same Cloudflare account that manages the criticalsandfumbles.com DNS zone — this is required for the custom domain step to work).
2. Attach the custom domain `campaigns.criticalsandfumbles.com` to the Worker (Workers & Pages → Settings → Domains & Routes → Add Custom Domain).
3. Generate a Sanity API token (Editor role) scoped to the main site's existing Sanity project, for this Worker's exclusive use.
4. Set Worker secrets: `wrangler secret put SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`, `SANITY_WRITE_TOKEN`.
5. Add the `campaign` / `dossier` / `genreTheme` schema types to the main site's Sanity Studio config so they validate and are visible there too (coordinate with whoever maintains that repo).
6. Create a Cloudflare Access application scoped to `campaigns.criticalsandfumbles.com/console*` and `/api/*`, add Google as the login method, and write a policy allowlisting GM email addresses.
7. Create a Cloudflare API token scoped to Workers Scripts:Edit + Workers Routes:Edit for this account; add it and the account ID as `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets on the new GitHub repo.
8. Run the seed script to create the six genre-theme documents from `seed/genre-themes.json` in Sanity.
9. On the main site, add the "Campaigns" directory page/nav entry that queries this shared Sanity project for `campaign` documents and links out to `campaigns.criticalsandfumbles.com/<slug>`.
