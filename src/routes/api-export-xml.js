import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { dossiersToXmlDocument } from "../lib/xml.js";

const app = new Hono();

// Both scoped to the requesting DM's own campaigns — see api-dossier.js
// for why dossiers inherit access from campaign->ownerEmail rather than
// carrying their own owner field.
const MINE = `*[_type == "dossier" && campaign->ownerEmail == $email]{
  code, title, classification, distribution, sessionLabel, location, overview,
  quickFacts, locationFacts, statTiles, threatAssessment, objectives, media, log,
  "campaignSlug": campaign->slug.current
}`;

const MINE_BY_CAMPAIGN = `*[_type == "dossier" && campaign->slug.current == $slug && campaign->ownerEmail == $email]{
  code, title, classification, distribution, sessionLabel, location, overview,
  quickFacts, locationFacts, statTiles, threatAssessment, objectives, media, log,
  "campaignSlug": campaign->slug.current
}`;

// GET /api/export.xml (or ?campaign=slug) — XML export of the caller's
// own dossiers only.
app.get("/", async (c) => {
  const campaignSlug = c.req.query("campaign");
  const email = c.get("gmEmail");
  const dossiers = campaignSlug
    ? await query(c.env, MINE_BY_CAMPAIGN, { slug: campaignSlug, email })
    : await query(c.env, MINE, { email });

  const xml = dossiersToXmlDocument(dossiers);
  return c.body(xml, 200, {
    "content-type": "application/xml",
    "content-disposition": 'attachment; filename="dossiers-export.xml"',
  });
});

export default app;
