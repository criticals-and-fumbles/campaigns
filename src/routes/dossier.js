import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { renderDossierPage, renderCampaignIndexPage } from "../templates/dossier.js";
import { urlFor } from "../lib/sanity-image.js";

const app = new Hono();

const CAMPAIGN_QUERY = `*[_type == "campaign" && slug.current == $slug][0]{
  _id, title, slug, genre, system, status, gmNames, heroImage, hook,
  sessionCount, motto, signOff, visible,
  "theme": theme->
}`;

const DOSSIER_QUERY = `*[_type == "dossier" && code == $code && campaign->slug.current == $slug][0]{
  ...,
  "campaign": campaign->{ _id, title, slug, system, motto, signOff, visible, "theme": theme-> }
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

const STATUS_LABEL = {
  active: "Active",
  recruiting: "Recruiting",
  hiatus: "On Hiatus",
  concluded: "Concluded",
};

// CSS class per status — see .status-badge.* rules in pageShell for the
// actual colors. "recruiting" gets the loudest treatment (solid amber
// fill) since the directory's intro copy specifically points visitors at
// recruiting campaigns.
const STATUS_CLASS = {
  active: "status-active",
  recruiting: "status-recruiting",
  hiatus: "status-hiatus",
  concluded: "status-concluded",
};

// siteSettings is a main-site document (cnf-website/sanity/schemas/
// siteSettings.ts) — but it lives in the same Sanity project/dataset as
// this Worker, so querying it directly (rather than hardcoding the
// Discord/WhatsApp URLs here) keeps this page's CTAs in sync with
// whatever the main site's Studio has, same principle as that repo's own
// "never hardcode the Discord invite string" rule (see its CLAUDE.md).
const SITE_LINKS_QUERY = `*[_type == "siteSettings"][0]{
  discordUrl,
  "whatsappUrl": socialLinks[platform == "WhatsApp"][0].url
}`;

// Page chrome for the public campaign DIRECTORY ONLY ("/") — styled to
// match the main criticalsandfumbles.com site's design system (see that
// repo's docs/design-system.md) since this page is meant to be launched
// from there. Hand-rolled plain CSS since this Worker has no Tailwind/
// component layer; values copied by hand, see CLAUDE.md § Visual design.
// Everything downstream of a campaign — its session index and the
// dossier page itself — is genre-themed instead (renderCampaignIndexPage/
// renderDossierPage, via theme.js), NOT run through this shell.
function pageShell(title, bodyInner) {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Crimson+Pro:wght@400;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#111111; --surface:#1a1a1a; --border:#2a2a2a;
    --text:#f0eae0; --text-muted:#666666;
    --emerald:#2ec56b; --amber:#c8893a; --magenta:#d946a8;
    --font-display:'Bebas Neue', sans-serif;
    --font-body:'Crimson Pro', serif;
    --font-ui:'Space Mono', monospace;
  }
  *{box-sizing:border-box;}
  html{font-size:18px;}
  body{margin:0; background:var(--bg); color:var(--text); font-family:var(--font-body); font-size:1.125rem;}
  a{color:inherit;}
  .container{max-width:1400px; margin:0 auto; padding:4rem 1.5rem;}
  .back-link{display:inline-block; font-family:var(--font-ui); font-size:.8rem; color:var(--text-muted); text-decoration:none; margin-bottom:1.5rem;}
  .back-link:hover{color:var(--emerald);}
  h1{font-family:var(--font-display); letter-spacing:.02em; font-size:2.75rem; margin:0 0 .5rem;}
  h1 .emerald{color:var(--emerald);}
  h1 .amber{color:var(--amber);}
  h1 .magenta{color:var(--magenta);}
  .intro{color:var(--text-muted); max-width:65ch; margin:0 0 1.5rem;}

  .cta-row{display:flex; flex-wrap:wrap; gap:.75rem; margin:0 0 2.5rem;}
  .cta-btn{display:inline-flex; align-items:center; font-family:var(--font-ui); font-size:.85rem; font-weight:700; padding:.65rem 1.25rem; border-radius:.4rem; text-decoration:none; transition:opacity .15s ease;}
  .cta-btn:hover{opacity:.85;}
  .cta-discord{background:#5865F2; color:#fff;}
  .cta-whatsapp{background:#25D366; color:#04160c;}

  /* Directory layout: wide list on the left, a narrower sticky "recent
     activity" feed on the right — stacks to a single column on mobile. */
  .directory-layout{display:grid; grid-template-columns:1fr 320px; gap:2.5rem; align-items:start;}
  @media(max-width:860px){.directory-layout{grid-template-columns:1fr;}}

  ul.campaign-list{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:1rem;}
  .card a{display:flex; flex-direction:row; align-items:stretch; overflow:hidden; border:1px solid var(--border); border-radius:.5rem; background:var(--surface); text-decoration:none; transition:border-color .2s ease;}
  .card a:hover{border-color:var(--emerald);}
  /* "not more than a quarter of the card" — capped at 25% width, with a
     sane minimum so it doesn't collapse to nothing on a narrow card. */
  .card-image{flex:0 0 25%; max-width:25%; min-width:120px; aspect-ratio:4/3; background:#0c1a10; overflow:hidden;}
  .card-image img{width:100%; height:100%; object-fit:cover;}
  .card-body{flex:1; min-width:0; display:flex; flex-direction:column; gap:.6rem; padding:1.25rem 1.5rem;}
  .badge-row{display:flex; flex-wrap:wrap; align-items:center; gap:.5rem;}
  .badge{border:1px solid var(--emerald); color:var(--emerald); font-family:var(--font-ui); font-size:.75rem; padding:.25rem 1rem; border-radius:999px;}
  /* Status is the one thing a visitor most needs to spot at a glance —
     "recruiting" campaigns are what the intro copy explicitly points
     people at, so it gets a solid fill instead of the genre badge's
     quieter outline treatment. */
  .status-badge{font-family:var(--font-ui); font-size:.75rem; font-weight:700; padding:.25rem 1rem; border-radius:999px; text-transform:uppercase; letter-spacing:.03em;}
  .status-badge.status-active{background:rgba(46,197,107,.15); color:var(--emerald); border:1px solid var(--emerald);}
  .status-badge.status-recruiting{background:var(--amber); color:#1a1000;}
  .status-badge.status-hiatus{background:transparent; color:var(--text-muted); border:1px solid var(--border);}
  .status-badge.status-concluded{background:transparent; color:var(--text-muted); border:1px solid var(--border); opacity:.7;}
  .card-body h2{font-family:var(--font-display); letter-spacing:.02em; font-size:1.5rem; margin:0; line-height:1.2;}
  .hook{font-size:1.05rem; color:var(--text-muted); margin:0;}
  .meta{display:flex; justify-content:space-between; gap:1rem; font-family:var(--font-ui); font-size:.75rem; color:var(--text-muted); margin-top:auto;}
  .empty{color:var(--text-muted);}

  .sidebar{position:sticky; top:2rem; border:1px solid var(--border); border-radius:.5rem; background:var(--surface); padding:1.25rem;}
  .sidebar h3{font-family:var(--font-display); letter-spacing:.02em; font-size:1.15rem; margin:0 0 1rem; color:var(--emerald);}
  .activity-list{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.9rem;}
  .activity-item a{display:block; text-decoration:none; color:inherit; padding-bottom:.9rem; border-bottom:1px solid var(--border);}
  .activity-item:last-child a{border-bottom:none; padding-bottom:0;}
  .activity-item a:hover .activity-title{color:var(--emerald);}
  .activity-title{display:block; font-size:.95rem; margin-bottom:.25rem; transition:color .15s ease;}
  .activity-meta{display:flex; justify-content:space-between; gap:.5rem; font-family:var(--font-ui); font-size:.68rem; color:var(--text-muted);}
</style>
</head>
<body>
<div class="container">
${bodyInner}
</div>
</body>
</html>`;
}

function brandTitle() {
  return `<h1><span class="emerald">Criticals</span> <span class="amber">&amp;</span> <span class="magenta">Fumbles</span></h1>`;
}

// GET / — public campaign directory. Only campaigns the owning DM has
// marked visible show up here — see schema/campaign.js § visible.
// Sorted by actual recent activity (see ALL_CAMPAIGNS_QUERY's lastActivity
// projection), full-width list rows rather than a card grid, with a
// sidebar feed of the most recently updated sessions across every
// visible campaign.
app.get("/", async (c) => {
  const [campaigns, recent, siteLinks] = await Promise.all([
    query(c.env, ALL_CAMPAIGNS_QUERY),
    query(c.env, RECENT_ACTIVITY_QUERY),
    query(c.env, SITE_LINKS_QUERY),
  ]);

  const cards = (campaigns || [])
    .map((camp) => {
      const imageUrl = urlFor(camp.heroImage).width(400).height(300).url();
      const status = STATUS_LABEL[camp.status] || camp.status;
      const statusClass = STATUS_CLASS[camp.status] || "";
      return `<li class="card">
  <a href="/${encodeURIComponent(camp.slug?.current || "")}">
    <div class="card-image">${imageUrl ? `<img src="${imageUrl}" alt="" loading="lazy">` : ""}</div>
    <div class="card-body">
      <div class="badge-row">
        ${camp.genre ? `<span class="badge">${escapeHtml(camp.genre)}</span>` : ""}
        ${status ? `<span class="status-badge ${statusClass}">${escapeHtml(status)}</span>` : ""}
      </div>
      <h2>${escapeHtml(camp.title)}</h2>
      ${camp.hook ? `<p class="hook">${escapeHtml(camp.hook)}</p>` : ""}
      <div class="meta">
        <span>${escapeHtml(camp.system || "")}</span>
        <span>Updated ${timeAgo(camp.lastActivity)}</span>
      </div>
    </div>
  </a>
</li>`;
    })
    .join("\n");

  const activity = (recent || [])
    .map(
      (d) => `<li class="activity-item">
  <a href="/${encodeURIComponent(d.campaignSlug)}/${encodeURIComponent(d.code)}">
    <span class="activity-title">${escapeHtml(d.sessionLabel || d.code)} — ${escapeHtml(d.title)}</span>
    <span class="activity-meta"><span>${escapeHtml(d.campaignTitle)}</span><span>${timeAgo(d._updatedAt)}</span></span>
  </a>
</li>`,
    )
    .join("\n");

  const ctas = [
    siteLinks?.discordUrl ? `<a class="cta-btn cta-discord" href="${escapeHtml(siteLinks.discordUrl)}" target="_blank" rel="noopener noreferrer">Join us on Discord</a>` : "",
    siteLinks?.whatsappUrl ? `<a class="cta-btn cta-whatsapp" href="${escapeHtml(siteLinks.whatsappUrl)}" target="_blank" rel="noopener noreferrer">Join our WhatsApp Community</a>` : "",
  ].join("\n");

  const body = `${brandTitle()}
  <p class="intro">Catch up on our games here. Please reach out to us if you are interested in any games that are still recruiting.</p>
  ${ctas ? `<div class="cta-row">${ctas}</div>` : ""}
  <div class="directory-layout">
    <ul class="campaign-list">${cards || `<p class="empty">No campaigns published yet.</p>`}</ul>
    <aside class="sidebar">
      <h3>Recent Updates</h3>
      <ul class="activity-list">${activity || `<p class="empty">No sessions published yet.</p>`}</ul>
    </aside>
  </div>`;

  return c.html(pageShell("Campaigns — Criticals & Fumbles", body));
});

// GET /:campaignSlug/:dossierCode — the dossier page itself. A dossier
// under a non-visible campaign 404s here too, not just off the directory
// — visible is a real access gate, not just a listing filter.
app.get("/:campaignSlug/:dossierCode", async (c) => {
  const { campaignSlug, dossierCode } = c.req.param();
  const dossier = await query(c.env, DOSSIER_QUERY, { slug: campaignSlug, code: dossierCode });
  if (!dossier || !dossier.campaign?.visible) return c.notFound();

  const html = renderDossierPage({
    dossier,
    campaign: dossier.campaign,
    theme: dossier.campaign?.theme,
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

  return c.html(renderCampaignIndexPage({ campaign, dossiers, theme: campaign.theme }));
});

// Coarse relative-time label ("2 hours ago", "3 days ago") for the
// directory list and the recent-activity sidebar — no need for a date
// library over a handful of buckets.
function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.floor(month / 12)}y ago`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default app;
