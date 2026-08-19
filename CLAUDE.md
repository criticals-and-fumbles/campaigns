# Criticals & Fumbles — Campaigns Subsite — Project Memory

A Cloudflare Worker serving `campaigns.criticalsandfumbles.com`. GMs
publish and update genre-themed "campaign dossier" pages; visitors browse
ongoing campaigns. Deliberately a separate Worker and separate GitHub
repo from the main criticalsandfumbles.com site (Next.js + Sanity), to
keep its own Cloudflare Workers Free-plan bundle budget isolated and
deploy independently — but it shares that main site's Sanity **project
and dataset**, not a second Sanity project.

**These guardrails are ported from the main site's `CLAUDE.md`
(criticals-and-fumbles/website), same policies applied here, not a looser
standard just because this is a smaller subsite** — porting done directly
from that repo's actual root `CLAUDE.md` during this repo's scaffolding
session, not reinvented from scratch. If the main site's guardrails
change later, this file should be updated to match; it isn't
auto-synced.

**This repo hasn't been split into `docs/*.md` modules yet** — unlike the
main site (see its `docs/` directory and module index), this repo is
small enough at scaffold time that one file is still manageable. Split it
the same way once it grows past a comfortable single-file read — same
threshold judgement call the main site made, not a fixed line count.

**Site purpose — read this before making priority calls.** This is a
GM-facing publishing tool first, a public browsing surface second. Flow:
GM logs edits through `/console` → dossier goes live → players/visitors
read it at `/:campaignSlug/:dossierCode`. Every design/priority decision
should ask "does this make it easier for a GM to update a dossier
mid-week, or harder?" — the console's inline-edit/autosave pattern exists
specifically so a GM can fix a typo from their phone between sessions
without touching Sanity Studio at all (which they never get access to,
by design — see Schema Safety Protocol below).

## Schema Safety Protocol

Applies to any session that creates, modifies, or touches a Sanity
schema — **especially here, since `campaign`/`dossier`/`genreTheme` live
in the SAME Sanity project/dataset as the main criticalsandfumbles.com
site.** A mistake here can affect that site's content too, not just this
one. This protocol exists because of a real incident on the main site
(the tier/role rename that made 6 of 7 team members invisible — full
account in that repo's `docs/lessons-learned.md`) where an enum rename
shipped without a migration step.

1. **Verify before touching.** Before editing any existing schema, query
   the actual current data in Sanity Vision (or an equivalent script
   using `NEXT_PUBLIC_SANITY_API_VERSION`/`NEXT_PUBLIC_SANITY_PROJECT_ID`
   — see `seed/seed.js` for the pattern) and show the real current state.
   Never assume schema/data state from memory or from what a prompt
   describes — confirm it live first.
2. **Additive by default.** New fields, new schema types, and new enum
   options are always safe. Renaming, restructuring, or removing an
   EXISTING field or enum value is never additive — treat it as
   high-risk regardless of how small it looks, and remember it can
   affect the main site's Studio too once these types are added there
   (see README.md "Manual setup" step 5).
3. **Stop and ask on ambiguity.** If a requested change could plausibly
   touch an existing field's name, type, or meaning — stop and ask
   before proceeding, rather than making a judgement call alone.
4. **Migrate, don't assume (enum renames specifically).** Deploy schema
   and code changes together — never let this repo's `schema/*.js`
   definitions drift out of sync with what's actually registered in the
   main site's Studio (once step 5 of README.md's manual setup has run)
   or with what the Worker code assumes field values look like. If old
   documents might hold previous enum values, write a dry-run migration
   script before deploying, not after something breaks — same pattern as
   `seed/seed.js`.
5. **Verify after, not just before.** After any schema change, query the
   same data again and confirm existing content is intact before
   considering the change complete. Show this confirmation, don't just
   assume it worked.
6. **This protocol is not optional reading.** It applies regardless of
   which part of the app a session touches — schema risk can appear in
   sessions that don't look schema-related at first glance.

## Risk check & ownership

Before starting any session that touches an existing schema, run `gh
issue list --label known-risk --state open` (in this repo — create the
`known-risk`/`risk-high`/`risk-low` labels here the same way the main
site's repo has them, if they don't exist yet) and review results
relevant to the area being touched. Claude Code owns known-risk issue
hygiene autonomously in this repo too — create issues for new risks
found, close issues you resolve (with a clear summary comment and a
corresponding lessons-learned note added to this file before closing),
and leave issues open with a progress comment if only partially
resolved. The user reviews periodically, not per-action — write closing
comments that stand alone as a clear audit trail.

## Bundle size budget

**Cloudflare Workers Free plan caps a script at 3 MiB gzip-compressed —
same hard limit as the main site, but this is a SEPARATE budget** (this
repo deploys as its own Worker). No baseline measured yet at scaffold
time (never deployed). Before adding any dependency: `npx wrangler
versions upload --preview-alias <name>` after a build, same
before/after-checking discipline as the main site. Deliberately minimal
dependencies from the start — Hono (router) + fast-xml-parser (XML
import), no frontend framework, no `@sanity/client` (hand-rolled fetch
helpers in `src/lib/sanity.js` instead) — see SCAFFOLD_PROMPT.md's hard
constraints for why.

## Stack

Cloudflare Worker (Wrangler, not Pages) + Hono for routing + server-
rendered template literals (`src/templates/`) + Sanity CMS (same
project/dataset as criticalsandfumbles.com — same env var names too,
`NEXT_PUBLIC_SANITY_PROJECT_ID` etc., see `src/lib/sanity.js`; reads use
`SANITY_API_READ_TOKEN`, mutations use `SANITY_API_WRITE_TOKEN`, both
currently the **same token values as the main site's**, not a dedicated
token for this Worker — a deliberate choice made 2026-08-19 given the
goal of eventually linking documents/schema between the two repos, at
the cost of shared blast radius if either codebase is compromised) +
Cloudflare Access for auth (no app-level login/session system — see
`src/lib/auth.js`). No R2, no KV, no D1 at scaffold time.

## Data model

See `schema/genreTheme.js`, `schema/campaign.js`, `schema/dossier.js` for
the authoritative field definitions (all additive to the main site's
existing schema, all commented with the reasoning behind non-obvious
choices — e.g. `dossier.media`'s two-optional-fields pattern for
`image|file`, `quickFacts`/`locationFacts`'s free-form label/value array
design). One dossier template renders every campaign regardless of
genre — colors/fonts/section-labels/loading-screen-motif are entirely
data-driven from the campaign's referenced `genreTheme`. Never add a
layout-mode switch keyed on genre/campaign name directly.

## Known deviation from the scaffold brief

`campaign.worldRef` — the original scaffold brief referenced
`wikiWorld` as the type to reference. Checked directly against the main
site's actual registered schema during scaffolding (same Claude Code
session had it in context) — the real type name is `world`. Used the
verified name, not the brief's placeholder guess.
