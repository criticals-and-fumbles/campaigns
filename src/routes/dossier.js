import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { renderDossierPage } from "../templates/dossier.js";

const app = new Hono();

const CAMPAIGN_QUERY = `*[_type == "campaign" && slug.current == $slug][0]{
  _id, title, slug, genre, system, status, gmNames, heroImage, hook,
  sessionCount, motto, signOff,
  "theme": theme->
}`;

const DOSSIER_QUERY = `*[_type == "dossier" && code == $code && campaign->slug.current == $slug][0]{
  ...,
  "campaign": campaign->{ _id, title, slug, system, motto, signOff, "theme": theme-> }
}`;

const CAMPAIGN_DOSSIERS_QUERY = `*[_type == "dossier" && campaign->slug.current == $slug] | order(_createdAt desc){
  _id, code, title, sessionLabel, location
}`;

const ALL_CAMPAIGNS_QUERY = `*[_type == "campaign"] | order(status asc, title asc){
  _id, title, slug, genre, system, status, hook
}`;

// GET / — public campaign directory, the site's landing page.
app.get("/", async (c) => {
  const campaigns = await query(c.env, ALL_CAMPAIGNS_QUERY);

  const cards = (campaigns || [])
    .map(
      (camp) => `<li class="campaign-card">
  <a href="/${encodeURIComponent(camp.slug?.current || "")}">
    <h2>${escapeHtml(camp.title)}</h2>
    <p class="meta">${escapeHtml(camp.genre || "")}${camp.system ? " · " + escapeHtml(camp.system) : ""} · ${escapeHtml(camp.status || "")}</p>
    ${camp.hook ? `<p class="hook">${escapeHtml(camp.hook)}</p>` : ""}
  </a>
</li>`,
    )
    .join("\n");

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campaigns — Criticals &amp; Fumbles</title>
  <style>
    body{font-family:sans-serif; max-width:720px; margin:60px auto; padding:0 20px;}
    ul{list-style:none; padding:0; display:grid; gap:16px;}
    .campaign-card a{display:block; padding:16px 20px; border:1px solid #ddd; border-radius:8px; text-decoration:none; color:inherit;}
    .campaign-card a:hover{border-color:#999;}
    .campaign-card h2{margin:0 0 4px;}
    .meta{color:#666; font-size:.9em; margin:0 0 6px;}
    .hook{margin:0; color:#333;}
  </style>
</head>
<body>
  <h1>Campaigns</h1>
  <ul>${cards || "<li>No campaigns published yet.</li>"}</ul>
</body>
</html>`);
});

// GET /:campaignSlug/:dossierCode — the dossier page itself.
app.get("/:campaignSlug/:dossierCode", async (c) => {
  const { campaignSlug, dossierCode } = c.req.param();
  const dossier = await query(c.env, DOSSIER_QUERY, { slug: campaignSlug, code: dossierCode });
  if (!dossier) return c.notFound();

  const html = renderDossierPage({
    dossier,
    campaign: dossier.campaign,
    theme: dossier.campaign?.theme,
  });
  return c.html(html);
});

// GET /:campaignSlug — optional campaign landing/session-index page.
app.get("/:campaignSlug", async (c) => {
  const { campaignSlug } = c.req.param();
  const campaign = await query(c.env, CAMPAIGN_QUERY, { slug: campaignSlug });
  if (!campaign) return c.notFound();

  const dossiers = await query(c.env, CAMPAIGN_DOSSIERS_QUERY, { slug: campaignSlug });

  const list = dossiers
    .map(
      (d) =>
        `<li><a href="/${encodeURIComponent(campaignSlug)}/${encodeURIComponent(d.code)}">${escapeHtml(d.sessionLabel || d.code)} — ${escapeHtml(d.title)}</a></li>`,
    )
    .join("\n");

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(campaign.title)} — Session Index</title>
</head>
<body style="font-family:sans-serif; max-width:640px; margin:60px auto; padding:0 20px;">
  <h1>${escapeHtml(campaign.title)}</h1>
  <p>${escapeHtml(campaign.hook || "")}</p>
  <p><em>${escapeHtml(campaign.system || "")} · ${escapeHtml(campaign.status || "")}</em></p>
  <h2>Sessions</h2>
  <ul>${list || "<li>No dossiers published yet.</li>"}</ul>
</body>
</html>`);
});

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default app;
