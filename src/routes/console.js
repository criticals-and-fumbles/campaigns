import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { renderConsolePage } from "../templates/console.js";
import { DOSSIER_XML_TEMPLATE, OBJECTIVES_CSV_TEMPLATE } from "../lib/import-templates.js";

const app = new Hono();

// Both scoped to the requesting DM's own campaigns (ownerEmail == gmEmail)
// — see CLAUDE.md § ownership. Dossiers are scoped via their campaign
// reference since dossiers carry no owner field of their own.
// Full editable field set — the console's Edit Campaign panel needs
// every field it can PATCH, not just what the read-only table displays.
const MY_CAMPAIGNS_QUERY = `*[_type == "campaign" && ownerEmail == $email] | order(title asc){
  _id, title, slug, genre, system, status, gmNames, hook, motto, signOff,
  visible, heroImage, "theme": theme._ref
}`;

// Same reasoning — the single dossier editor edits every schema field
// (see schema/dossier.js), so it needs every field fetched up front.
const MY_DOSSIERS_QUERY = `*[_type == "dossier" && campaign->ownerEmail == $email] | order(_createdAt desc){
  _id, code, title, classification, distribution, sessionLabel, location,
  overview, heroImage, quickFacts, locationFacts, statTiles,
  threatAssessment, objectives, log,
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
  const html = renderConsolePage({
    campaigns,
    dossiers,
    genreThemes,
    gmEmail: email,
    sanityProjectId: c.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    sanityDataset: c.env.NEXT_PUBLIC_SANITY_DATASET,
  });
  return c.html(html);
});

// Downloadable starter templates for the Bulk Import buttons — content
// lives in lib/import-templates.js so it stays next to (and gets tested
// against) the parsers it has to match. Behind Access same as the rest
// of /console — not sensitive, just consistent with the surrounding
// routes rather than carving out a public exception for two files.
app.get("/templates/dossiers.xml", (c) =>
  c.body(DOSSIER_XML_TEMPLATE, 200, {
    "content-type": "application/xml",
    "content-disposition": 'attachment; filename="dossier-import-template.xml"',
  }),
);

app.get("/templates/objectives.csv", (c) =>
  c.body(OBJECTIVES_CSV_TEMPLATE, 200, {
    "content-type": "text/csv",
    "content-disposition": 'attachment; filename="objectives-import-template.csv"',
  }),
);

export default app;
