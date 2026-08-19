import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { renderConsolePage } from "../templates/console.js";

const app = new Hono();

// Both scoped to the requesting DM's own campaigns (ownerEmail == gmEmail)
// — see CLAUDE.md § ownership. Dossiers are scoped via their campaign
// reference since dossiers carry no owner field of their own.
const MY_CAMPAIGNS_QUERY = `*[_type == "campaign" && ownerEmail == $email] | order(title asc){
  _id, title, slug, genre, status, visible
}`;

const MY_DOSSIERS_QUERY = `*[_type == "dossier" && campaign->ownerEmail == $email] | order(_createdAt desc){
  _id, code, title, location, overview, heroImage, objectives,
  "campaignId": campaign._ref, "campaignTitle": campaign->title
}`;

// Genre themes are shared reference data, not owned by any one DM — every
// DM picks from the same list when creating a campaign.
const GENRE_THEMES_QUERY = `*[_type == "genreTheme"] | order(genre asc){ _id, genre, campaignOverride }`;

app.get("/", async (c) => {
  const email = c.get("gmEmail");
  const [campaigns, dossiers, genreThemes] = await Promise.all([
    query(c.env, MY_CAMPAIGNS_QUERY, { email }),
    query(c.env, MY_DOSSIERS_QUERY, { email }),
    query(c.env, GENRE_THEMES_QUERY),
  ]);
  const html = renderConsolePage({ campaigns, dossiers, genreThemes, gmEmail: email });
  return c.html(html);
});

export default app;
