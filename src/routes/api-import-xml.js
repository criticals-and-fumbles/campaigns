import { Hono } from "hono";
import { query, mutate } from "../lib/sanity.js";
import { parseDossiersXml } from "../lib/xml.js";

const app = new Hono();

// Scoped to the caller's own campaigns — an XML row targeting a campaign
// slug the caller doesn't own fails per-row (see the loop below) rather
// than silently importing into someone else's campaign.
const MY_CAMPAIGN_SLUGS = `*[_type == "campaign" && ownerEmail == $email]{ _id, "slug": slug.current }`;
const MY_EXISTING_DOSSIER_IDS = `*[_type == "dossier" && campaign->ownerEmail == $email]{ _id, code, "campaignSlug": campaign->slug.current }`;

function dossierDocId(campaignSlug, code) {
  return `dossier.${campaignSlug}.${code}`.replace(/[^a-zA-Z0-9._-]/g, "-");
}

// POST /api/import — multipart XML upload; bulk createOrReplace in one
// atomic transaction. Dossiers that fail validation (unresolvable
// campaignSlug, missing code) are excluded from the transaction and
// reported individually — no silent partial imports: every input
// <dossier> ends up counted as created, updated, or failed-with-reason.
app.post("/", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!file) return c.json({ error: "No XML file provided" }, 400);

  const text = await file.text();

  let parsed;
  try {
    parsed = parseDossiersXml(text);
  } catch (err) {
    return c.json({ error: `Malformed XML: ${err.message}` }, 400);
  }

  const email = c.get("gmEmail");
  const [campaigns, existing] = await Promise.all([
    query(c.env, MY_CAMPAIGN_SLUGS, { email }),
    query(c.env, MY_EXISTING_DOSSIER_IDS, { email }),
  ]);
  const campaignBySlug = new Map(campaigns.map((cmp) => [cmp.slug, cmp._id]));
  const existingKeys = new Set(existing.map((d) => `${d.campaignSlug}::${d.code}`));

  const mutations = [];
  const failed = [];
  let created = 0;
  let updated = 0;

  for (const d of parsed) {
    if (!d.code) {
      failed.push({ code: d.code || "(no code)", reason: "Missing dossier id/code" });
      continue;
    }
    const campaignId = campaignBySlug.get(d.campaignSlug);
    if (!campaignId) {
      failed.push({
        code: d.code,
        reason: `Unknown campaignSlug "${d.campaignSlug}" — no matching campaign document`,
      });
      continue;
    }

    const key = `${d.campaignSlug}::${d.code}`;
    if (existingKeys.has(key)) updated++;
    else created++;

    mutations.push({
      createOrReplace: {
        _id: dossierDocId(d.campaignSlug, d.code),
        _type: "dossier",
        code: d.code,
        campaign: { _type: "reference", _ref: campaignId },
        title: d.title,
        classification: d.classification,
        distribution: d.distribution,
        sessionLabel: d.sessionLabel,
        location: d.location,
        overview: d.overview,
        quickFacts: d.quickFacts,
        locationFacts: d.locationFacts,
        statTiles: d.statTiles,
        threatAssessment: d.threatAssessment,
        objectives: d.objectives,
        log: d.log,
        lastEditedBy: c.get("gmEmail"),
        lastEditedAt: new Date().toISOString(),
      },
    });
  }

  let result = null;
  if (mutations.length > 0) {
    try {
      result = await mutate(c.env, mutations, crypto.randomUUID());
    } catch (err) {
      return c.json({ error: `Sanity transaction failed: ${err.message}` }, 502);
    }
  }

  return c.json({
    ok: true,
    imported: mutations.length,
    created,
    updated,
    failed: failed.length,
    failures: failed,
    result,
  });
});

export default app;
