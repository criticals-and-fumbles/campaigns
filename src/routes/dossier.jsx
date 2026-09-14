/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { query } from "../lib/sanity.js";
import { renderDossierPage, renderCampaignIndexPage } from "../templates/dossier.js";
import { PageShell } from "../components/directory/PageShell.jsx";
import { CampaignCard } from "../components/directory/CampaignCard.jsx";
import { ActivityItem } from "../components/directory/ActivityItem.jsx";

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

// "Most recently updated" means actual campaign activity — a new or
// edited session bumps the campaign to the top, not just edits to the
// campaign document itself (which is what plain _updatedAt would give:
// a GM adding a session without ever re-touching the campaign's own
// fields would otherwise never move it). lastActivity is the newest of
// (a) any of its dossiers' _updatedAt, or (b) the campaign's own
// _updatedAt if it has no dossiers yet — see references(^._id), which
// resolves to the campaign document being projected.
const ALL_CAMPAIGNS_QUERY = `*[_type == "campaign" && visible == true]{
  _id, title, slug, genre, system, status, hook, heroImage,
  "lastActivity": coalesce(*[_type == "dossier" && references(^._id)] | order(_updatedAt desc)[0]._updatedAt, _updatedAt)
} | order(lastActivity desc)`;

// Sidebar activity feed — the most recently updated dossiers across every
// visible campaign, newest first, capped at 10.
const RECENT_ACTIVITY_QUERY = `*[_type == "dossier" && campaign->visible == true] | order(_updatedAt desc)[0...10]{
  code, title, sessionLabel, _updatedAt,
  "campaignSlug": campaign->slug.current, "campaignTitle": campaign->title
}`;

// siteSettings is a main-site document (cnf-website/sanity/schemas/
// siteSettings.ts) — but it lives in the same Sanity project/dataset as
// this Worker, so querying it directly (rather than hardcoding the
// Discord/WhatsApp URLs, site title/description, or copyright line here)
// keeps this page's CTAs AND its nav/footer chrome in sync with whatever
// the main site's Studio has, same principle as that repo's own "never
// hardcode the Discord invite string" rule (see its CLAUDE.md).
const SITE_LINKS_QUERY = `*[_type == "siteSettings"][0]{
  title, shortDescription, discordUrl, copyrightLine,
  "whatsappUrl": socialLinks[platform == "WhatsApp"][0].url,
  socialLinks
}`;

// GET / — public campaign directory. Only campaigns the owning DM has
// marked visible show up here — see schema/campaign.js § visible.
// Sorted by actual recent activity (see ALL_CAMPAIGNS_QUERY's lastActivity
// projection), full-width list rows rather than a card grid, with a
// sidebar feed of the most recently updated sessions across every
// visible campaign.
//
// 2026-09-15: this route (and everything it renders — PageShell,
// SiteNav, SiteFooter, CampaignCard, ActivityItem, Backdrop, all under
// src/components/directory/) was converted from a hand-rolled
// template-string function to server-rendered JSX (hono/jsx), for the
// same component-based authoring pattern cnf-website's own pages use.
// Markup/CSS/behaviour are otherwise unchanged from the pre-conversion
// version. Everything downstream of a campaign — its session index and
// the dossier page itself — stays genre-themed template strings
// (renderCampaignIndexPage/renderDossierPage, via theme.js), not part of
// this conversion.
app.get("/", async (c) => {
  const [campaigns, recent, siteLinks] = await Promise.all([
    query(c.env, ALL_CAMPAIGNS_QUERY),
    query(c.env, RECENT_ACTIVITY_QUERY),
    query(c.env, SITE_LINKS_QUERY),
  ]);

  const ctas = [];
  if (siteLinks?.discordUrl) {
    ctas.push(
      <a key="discord" class="cta-btn cta-discord" href={siteLinks.discordUrl} target="_blank" rel="noopener noreferrer">
        Join us on Discord
      </a>,
    );
  }
  if (siteLinks?.whatsappUrl) {
    ctas.push(
      <a key="whatsapp" class="cta-btn cta-whatsapp" href={siteLinks.whatsappUrl} target="_blank" rel="noopener noreferrer">
        Join our WhatsApp Community
      </a>,
    );
  }

  // Rendered to a plain string (not passed to c.html() as a JSX object
  // directly) specifically so "<!DOCTYPE html>" can be prepended —
  // there's no way to put a doctype INSIDE the <html> JSX tree itself,
  // and c.html(jsxElement) treats the JSX as the entire response body.
  // Safe to call .toString() synchronously here: every component in this
  // tree is a plain sync function with no async/Promise children.
  const page = (
    <PageShell title="Campaign Logs" siteLinks={siteLinks} colorMode={resolveColorMode(c)}>
      <h1>Campaign Logs</h1>
      <p class="intro">
        Catch up on our games here. Please reach out to us if you are interested in any games that are still
        recruiting.
      </p>
      {ctas.length > 0 && <div class="cta-row">{ctas}</div>}
      <div class="directory-layout">
        <ul class="campaign-list">
          {campaigns && campaigns.length > 0 ? (
            campaigns.map((camp) => <CampaignCard key={camp._id} campaign={camp} />)
          ) : (
            <p class="empty">No campaigns published yet.</p>
          )}
        </ul>
        <aside class="sidebar">
          <h3>Recent Updates</h3>
          <ul class="activity-list">
            {recent && recent.length > 0 ? (
              recent.map((d) => <ActivityItem key={`${d.campaignSlug}-${d.code}`} item={d} />)
            ) : (
              <p class="empty">No sessions published yet.</p>
            )}
          </ul>
        </aside>
      </div>
    </PageShell>
  );
  return c.html("<!DOCTYPE html>" + page.toString());
});

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
