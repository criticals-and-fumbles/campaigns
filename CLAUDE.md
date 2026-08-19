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

**TODO — deferred, not forgotten: split this file into `docs/*.md`
modules once it's grown enough to justify it.** Checked 2026-08-19: this
file is 130 lines vs. the ~1300 lines cnf-website's root `CLAUDE.md` had
when it was split (see that repo's `docs/release-history.md` v0.1.14
entry region for the modularization session). Splitting now would
produce mostly-empty module files (no release history yet, no wiki/
architecture docs beyond what's here) — working against the actual goal,
which is keeping per-session token usage low, not structural symmetry
with the main site for its own sake. A single small file a session reads
in full costs less than several files a session has to figure out which
of are relevant. **Revisit once this file's own length starts costing
more tokens per session than a lean-root-plus-modules split would** — a
few hundred lines is a reasonable point to re-check, not a hard trigger.

**Site purpose — read this before making priority calls.** This is a
GM-facing publishing tool first, a public browsing surface second. Flow:
GM logs edits through `/console` → dossier goes live → players/visitors
read it at `/:campaignSlug/:dossierCode`. Every design/priority decision
should ask "does this make it easier for a GM to update a dossier
mid-week, or harder?" — the console's inline-edit/autosave pattern exists
specifically so a GM can fix a typo from their phone between sessions
without touching Sanity Studio at all (which they never get access to,
by design — see Schema Safety Protocol below).

## Ownership model — campaigns are DM-scoped, not shared

Added 2026-08-19. A campaign's `ownerEmail` (`schema/campaign.js`) is set
once, server-side, from the creating DM's `Cf-Access-Authenticated-User-
Email` (see `src/routes/api-campaign.js`'s POST handler) — never
client-supplied, never patchable afterward (`PATCH /api/campaign/:id`
explicitly rejects `field: "ownerEmail"`, same pattern dossier's
`lastEditedBy` already used). Dossiers have no owner field of their own —
they inherit access from their parent campaign via `campaign->ownerEmail`,
checked with a query at the top of every dossier PATCH/POST handler.

**This is enforced server-side on every mutating route, not just hidden
in the console UI** — `console.js`'s scoped queries (campaigns/dossiers
`WHERE ownerEmail == $email`) are a UX convenience, not the security
boundary. A DM's own browser calling `/api/campaign/:id` or
`/api/dossier/:id` for a document they don't own gets a 403 regardless of
what the console UI shows them. The bulk XML/CSV export/import routes
(`api-export-xml.js`, `api-import-xml.js`, `api-export-csv.js`,
`api-import-csv.js`) are scoped the same way — an XML row or CSV code
targeting another DM's campaign fails per-row rather than silently
touching it.

`visible` (also on `campaign`) is a separate, unrelated concern — public
publish/unpublish, not ownership. Defaults to `false` server-side (`POST
/api/campaign` falls back to hidden if the client omits it) so a DM can
build a campaign out before it appears on the public directory, but
unlike `ownerEmail` it's not creation-only or immutable — the client MAY
opt into `visible: true` at creation time (the console's "Publish
immediately" checkbox, added 2026-08-19 for discoverability — the
toggle in "My Campaigns" existed first but wasn't obvious enough on its
own), and it stays freely PATCHable afterward either way. It's a real
access gate, not just a listing filter: a direct link to
`/:campaignSlug` or `/:campaignSlug/:dossierCode` under a non-visible
campaign 404s (see `src/routes/dossier.js`), it doesn't just disappear
from `/`. Dossiers have no `visible` field of their own — every dossier
under a visible campaign is visible, there is no per-dossier draft state
(the create-dossier form has no publish toggle for this reason).

**What is NOT scoped by ownership:** `genreTheme` documents are shared
reference data across all DMs (the console's "Create Campaign" theme
picker lists every genreTheme, not just the caller's) — there is no
per-theme owner, by design; themes are a shared palette, not a DM's
private content.

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

## Visual design — two deliberately different skins, split by audience

**Main-site-styled** (dark-mode-default palette, Bebas Neue/Crimson Pro/
Space Mono fonts, the three-color brand title treatment): the public
campaign **directory** (`GET /`) and **the console** (`/console`,
`templates/console.js`). Both are chrome around the main site's product
— the directory launches *from* criticalsandfumbles.com, the console is
an admin tool a DM uses the same way they'd use any other internal main-
site tool — so both use that site's actual design system, not an
invented one. Values were copied by hand from `app/(site)/globals.css`
and `components/content/ArticleCard.tsx` in that repo (see its
`docs/design-system.md` for the source of truth) — there's no shared
package/token file between the two repos, so if the main site's palette
or fonts change, both this page's inline `<style>` block AND
`templates/console.js`'s `CONSOLE_CSS` have to be updated by hand;
nothing keeps them in sync automatically. Nav/header is deliberately
absent on the directory page — the main site will link into it directly
once that's built, this repo doesn't own that navigation.

**Genre-themed** (via `src/lib/theme.js`'s `themeToCssVars`/
`resolveLabels`, driven by the campaign's referenced `genreTheme`
document): the dossier page itself (`renderDossierPage`) and, since
2026-08-19, each campaign's **session index** (`renderCampaignIndexPage`,
`GET /:campaignSlug`) too — a "dossier list page" is part of that
campaign's in-fiction presentation, not main-site chrome, so it picks up
the same colors/fonts/motif a dossier under that campaign would. The
session-index page is a two-pane list+detail view: the left pane lists
sessions most-recent-first (the underlying GROQ query already sorts
`order(_createdAt desc)`, so no client-side re-sorting needed); the right
pane is an `<iframe>` pointed at the selected session's own
`/:campaignSlug/:dossierCode` URL — reusing `renderDossierPage` completely
unchanged rather than re-implementing dossier rendering inline, so the
embedded and directly-linked views can never drift apart. The most recent
session auto-selects on load so the right pane isn't empty by default.

## Lessons learned

**Sanity's REST API version segment needs a `v` prefix — fixed
2026-08-19, first-deploy bug.** `src/lib/sanity.js`'s `apiBase()` (and
`seed/seed.js`'s copy of the same logic) originally built
`https://<project>.api.sanity.io/<version>/...` — missing the required
`v` before the date, e.g. `/2026-06-01/` instead of `/v2026-06-01/`.
Sanity doesn't return a clear "bad version" error for this; it returns a
generic `{"message":"no Route matched with those values"}` 404, which
looked identical to a routing problem and took real live-debugging to
isolate (confirmed by testing both URL forms directly against Sanity's
API with curl — the unprefixed form 404s, the `v`-prefixed form returns
real data). If a future session ever touches the API-base URL
construction in either file, keep the `v` prefix; there's no client
library here to get this right automatically (deliberately hand-rolled,
see Bundle size budget above), so it has to stay correct by hand.

**Cloudflare's "Build" vs "Runtime" variable panels are genuinely
separate — fixed 2026-08-19.** Workers Builds (Git-integration) has two
distinct "Variables and secrets" panels in the dashboard: one under
Settings → **Build** (used only during the CI build step), one under
Settings → **Runtime** (actually bound to `env` for live requests). The
Worker's first live deploy had all 5 Sanity values set correctly, but
under Build, not Runtime — `env.NEXT_PUBLIC_SANITY_PROJECT_ID` etc. were
all `undefined` at request time despite looking fully configured in the
dashboard. Confirmed via the Cloudflare API
(`GET /accounts/:id/workers/scripts/campaigns/settings`) showing an
empty `bindings` array even though the dashboard showed values — that
API call is the reliable way to check what's actually bound, since the
dashboard UI doesn't make the Build/Runtime distinction obvious at a
glance.

**Inline `style="display:none"` on a panel silently defeats a `.open`
CSS class toggle — fixed 2026-08-19, see issue #2.** `templates/
console.js`'s `createCampaignView`/`createDossierView` panels were
copied from `editorPanel` (the single-dossier editor), which shows/hides
purely via `.editor{display:none} .editor.open{display:block}` — but the
two new panels' opening `<div>` tags also had a redundant hardcoded
`style="display:none;"` baked into the markup. An inline `style`
attribute always wins over any stylesheet rule regardless of selector
specificity, so `classList.add('open')` was executing correctly (title
and active-nav-item state updated) while the panel's actual computed
`display` stayed `none` — from the outside this looked like "the click
does nothing," which delayed diagnosis across two failed fix attempts.
First fix attempt (switching `switchView()` from `style.display=''` to
`classList` toggling) was necessary but not sufficient — it fixed the
*logic* but not the pre-existing inline style already sitting on those
two elements. Root cause only became clear by loading the actual
rendered HTML into `jsdom` and inspecting live `computedStyle`/
`className`, not from reading the CSS/JS source. **If a future session
adds another panel that reuses the `.editor` class's open/close pattern,
copy `editorPanel`'s bare `<div class="editor" id="...">` — no inline
`style` attribute — not a version with `style="display:none;"` baked
in.**
