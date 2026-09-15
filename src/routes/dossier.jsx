/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { query } from "../lib/sanity.js";
import { renderDossierPage, renderCampaignIndexPage } from "../templates/dossier.js";

const app = new Hono();

// Shared with cnf-website's ThemeProvider.tsx (COOKIE_NAME there) via a
// cookie scoped to the parent domain — localStorage can't cross
// subdomains, cookies scoped to .criticalsandfumbles.com can. This is
// read-only here (this Worker doesn't set it — only the main site and
// this repo's own client-side toggles do, both writing the same name).
const COLOR_MODE_COOKIE = "cnf-theme";
function resolveColorMode(c) {
  return getCookie(c, COLOR_MODE_COOKIE) === "light" ? "light" : "dark";
}

const CAMPAIGN_QUERY = `*[_type == "campaign" && slug.current == $slug][0]{
  _id, title, slug, genre, system, status, gmNames, heroImage, hook,
  sessionCount, motto, signOff, visible,
  "theme": theme->
}`;

// campaign.heroImage/hook added 2026-09-01 as OG-tag fallbacks for
// dossiers with no headerImage/heroImage/overview of their own (share
// row's link previews need SOME image/description, not a blank card).
const DOSSIER_QUERY = `*[_type == "dossier" && code == $code && campaign->slug.current == $slug][0]{
  ...,
  "campaign": campaign->{ _id, title, slug, system, motto, hook, heroImage, signOff, visible, "theme": theme-> }
}`;

const CAMPAIGN_DOSSIERS_QUERY = `*[_type == "dossier" && campaign->slug.current == $slug] | order(_createdAt desc){
  _id, code, title, sessionLabel, location, _createdAt
}`;

// GET / — retired 2026-09-15. The public campaign directory this used to
// render (full campaign list + sidebar activity feed, converted to JSX
// earlier the same day) now lives at cnf-website's own
// app/(site)/campaigns/page.tsx instead — real Nav/Footer/design-system
// reuse, which hand-copying this Worker's CSS could never keep in sync
// with (see that repo's lessons-learned on this exact page for the full
// story). A Cloudflare Route + host-based middleware rewrite was tried
// first, sending campaigns.criticalsandfumbles.com/ traffic straight
// into cnf-sg's Worker — reverted, because a relative-URL nav click from
// there (e.g. "Events") stayed on this subdomain and 404'd on every page
// this Worker doesn't itself serve. A plain redirect avoids that: once a
// visitor lands on the real page, they're truly on that site's domain,
// so every other link just works.
//
// PageShell/SiteNav/SiteFooter/CampaignCard/ActivityItem/Backdrop (were
// under src/components/directory/) and the console/GM-mutation routes
// this Worker used to also serve are both gone now, not just dead code
// — the former were deleted outright once this redirect confirmed
// nothing depended on them; the latter moved wholesale to their own
// Worker (see cnf-website/apps/console) the same day console split out
// as its own product. This Worker is now dossier rendering only.
app.get("/", (c) => c.redirect("https://www.criticalsandfumbles.com/campaigns", 308));

// GET /:campaignSlug/:dossierCode — the dossier page itself. A dossier
// under a non-visible campaign 404s here too, not just off the directory
// — visible is a real access gate, not just a listing filter.
app.get("/:campaignSlug/:dossierCode", async (c) => {
  const { campaignSlug, dossierCode } = c.req.param();
  const dossier = await query(c.env, DOSSIER_QUERY, { slug: campaignSlug, code: dossierCode });
  if (!dossier || !dossier.campaign?.visible) return c.notFound();

  // ?embed=1 — set by renderCampaignIndexPage's iframe src. Hides this
  // page's own floating theme toggle so the session browser's toggle
  // (which drives this page's theme directly via
  // frame.contentWindow.setDossierTheme(), same-origin) isn't duplicated.
  const html = renderDossierPage({
    dossier,
    campaign: dossier.campaign,
    theme: dossier.campaign?.theme,
    embedded: c.req.query("embed") === "1",
    colorMode: resolveColorMode(c),
  });
  return c.html(html);
});

// GET /:campaignSlug — per-campaign session index. Same 404-if-not-visible
// gate as the dossier page above. Genre-themed two-pane list+detail view
// (renderCampaignIndexPage) — dossiers already come back most-recent-first
// from CAMPAIGN_DOSSIERS_QUERY's order(_createdAt desc).
app.get("/:campaignSlug", async (c) => {
  const { campaignSlug } = c.req.param();
  const campaign = await query(c.env, CAMPAIGN_QUERY, { slug: campaignSlug });
  if (!campaign || !campaign.visible) return c.notFound();

  const dossiers = await query(c.env, CAMPAIGN_DOSSIERS_QUERY, { slug: campaignSlug });

  return c.html(
    renderCampaignIndexPage({ campaign, dossiers, theme: campaign.theme, colorMode: resolveColorMode(c) }),
  );
});

export default app;
