import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { dossiersToXmlDocument } from "../lib/xml.js";

const app = new Hono();

const ALL = `*[_type == "dossier"]{
  code, title, classification, distribution, sessionLabel, location, overview,
  quickFacts, locationFacts, statTiles, threatAssessment, objectives, media, log,
  "campaignSlug": campaign->slug.current
}`;

const BY_CAMPAIGN = `*[_type == "dossier" && campaign->slug.current == $slug]{
  code, title, classification, distribution, sessionLabel, location, overview,
  quickFacts, locationFacts, statTiles, threatAssessment, objectives, media, log,
  "campaignSlug": campaign->slug.current
}`;

// GET /api/export.xml (or ?campaign=slug) — full XML export.
app.get("/", async (c) => {
  const campaignSlug = c.req.query("campaign");
  const dossiers = campaignSlug
    ? await query(c.env, BY_CAMPAIGN, { slug: campaignSlug })
    : await query(c.env, ALL);

  const xml = dossiersToXmlDocument(dossiers);
  return c.body(xml, 200, {
    "content-type": "application/xml",
    "content-disposition": 'attachment; filename="dossiers-export.xml"',
  });
});

export default app;
