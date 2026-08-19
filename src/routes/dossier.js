import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { renderDossierPage } from "../templates/dossier.js";
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
  _id, code, title, sessionLabel, location
}`;

const ALL_CAMPAIGNS_QUERY = `*[_type == "campaign" && visible == true] | order(status asc, title asc){
  _id, title, slug, genre, system, status, hook, heroImage
}`;

const STATUS_LABEL = {
  active: "Active",
  recruiting: "Recruiting",
  hiatus: "On Hiatus",
  concluded: "Concluded",
};

// Shared page chrome for the two public listing pages (directory +
// per-campaign session index) — styled to match the main
// criticalsandfumbles.com site's design system (see that repo's
// docs/design-system.md) since these pages are meant to be launched from
// there. Hand-rolled plain CSS since this Worker has no Tailwind/
// component layer; values copied by hand, see CLAUDE.md § Visual design.
// The dossier page itself (renderDossierPage) is intentionally NOT run
// through this shell — it has its own genre-driven theme system.
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
  .container{max-width:1280px; margin:0 auto; padding:4rem 1.5rem;}
  .back-link{display:inline-block; font-family:var(--font-ui); font-size:.8rem; color:var(--text-muted); text-decoration:none; margin-bottom:1.5rem;}
  .back-link:hover{color:var(--emerald);}
  h1{font-family:var(--font-display); letter-spacing:.02em; font-size:2.75rem; margin:0 0 .5rem;}
  h1 .emerald{color:var(--emerald);}
  h1 .amber{color:var(--amber);}
  h1 .magenta{color:var(--magenta);}
  .intro{color:var(--text-muted); max-width:65ch; margin:0 0 2.5rem;}
  ul{list-style:none; padding:0; margin:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1.5rem;}
  .card a{display:flex; flex-direction:column; height:100%; overflow:hidden; border:1px solid var(--border); border-radius:.5rem; background:var(--surface); text-decoration:none; transition:border-color .2s ease;}
  .card a:hover{border-color:var(--emerald);}
  .card-image{aspect-ratio:16/9; background:#0c1a10; overflow:hidden;}
  .card-image img{width:100%; height:100%; object-fit:cover;}
  .card-body{display:flex; flex-direction:column; gap:.75rem; padding:1.25rem;}
  .badge{align-self:flex-start; border:1px solid var(--emerald); color:var(--emerald); font-family:var(--font-ui); font-size:.75rem; padding:.25rem 1rem; border-radius:999px;}
  .card-body h2{font-family:var(--font-display); letter-spacing:.02em; font-size:1.5rem; margin:0; line-height:1.2;}
  .hook{font-size:1.1rem; color:var(--text-muted); margin:0; flex:1;}
  .meta{display:flex; justify-content:space-between; font-family:var(--font-ui); font-size:.75rem; color:var(--text-muted);}
  .empty{color:var(--text-muted);}
  .session-row a{display:block; padding:1rem 1.25rem; border:1px solid var(--border); border-radius:.5rem; background:var(--surface); text-decoration:none; font-family:var(--font-ui); font-size:.9rem; transition:border-color .2s ease;}
  .session-row a:hover{border-color:var(--emerald);}
  ul.sessions{display:flex; flex-direction:column; gap:.75rem;}
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
app.get("/", async (c) => {
  const campaigns = await query(c.env, ALL_CAMPAIGNS_QUERY);

  const cards = (campaigns || [])
    .map((camp) => {
      const imageUrl = urlFor(camp.heroImage).width(600).height(340).url();
      const status = STATUS_LABEL[camp.status] || camp.status;
      return `<li class="card">
  <a href="/${encodeURIComponent(camp.slug?.current || "")}">
    <div class="card-image">${imageUrl ? `<img src="${imageUrl}" alt="" loading="lazy">` : ""}</div>
    <div class="card-body">
      ${camp.genre ? `<span class="badge">${escapeHtml(camp.genre)}</span>` : ""}
      <h2>${escapeHtml(camp.title)}</h2>
      ${camp.hook ? `<p class="hook">${escapeHtml(camp.hook)}</p>` : ""}
      <div class="meta">
        <span>${escapeHtml(camp.system || "")}</span>
        <span>${escapeHtml(status || "")}</span>
      </div>
    </div>
  </a>
</li>`;
    })
    .join("\n");

  const body = `${brandTitle()}
  <p class="intro">Ongoing campaigns run by our GMs — browse session dossiers as they're published.</p>
  <ul>${cards || `<p class="empty">No campaigns published yet.</p>`}</ul>`;

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
// gate as the dossier page above.
app.get("/:campaignSlug", async (c) => {
  const { campaignSlug } = c.req.param();
  const campaign = await query(c.env, CAMPAIGN_QUERY, { slug: campaignSlug });
  if (!campaign || !campaign.visible) return c.notFound();

  const dossiers = await query(c.env, CAMPAIGN_DOSSIERS_QUERY, { slug: campaignSlug });

  const list = dossiers
    .map(
      (d) => `<li class="session-row"><a href="/${encodeURIComponent(campaignSlug)}/${encodeURIComponent(d.code)}">${escapeHtml(d.sessionLabel || d.code)} — ${escapeHtml(d.title)}</a></li>`,
    )
    .join("\n");

  const body = `<a class="back-link" href="/">&larr; All Campaigns</a>
  <h1>${escapeHtml(campaign.title)}</h1>
  <p class="intro">${escapeHtml(campaign.hook || "")}<br>
  <span class="meta"><span>${escapeHtml(campaign.system || "")}</span><span>${escapeHtml(STATUS_LABEL[campaign.status] || campaign.status || "")}</span></span></p>
  <ul class="sessions">${list || `<p class="empty">No sessions published yet.</p>`}</ul>`;

  return c.html(pageShell(`${campaign.title} — Session Index`, body));
});

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default app;
