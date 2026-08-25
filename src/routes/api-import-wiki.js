import { Hono } from "hono";
import { query, mutate } from "../lib/sanity.js";
import { buildWikiImportTransaction } from "../lib/wiki-import.js";

const app = new Hono();

const TARGET_WORLD_UNIT_QUERY = `*[_id == $id][0]{ _id, overview, "worldId": world._ref }`;

// Existing content scoped to the selected world unit (or, for loreEntries,
// the unit's world — that's the field actually required on that type) —
// used only to resolve bulk-import references by exact name/title match,
// same idea as the manual builder's createOrReplace-by-name-in-scope rule.
const EXISTING_IN_UNIT = (type, field) =>
  `*[_type == "${type}" && ${field}._ref == $unitId]{ _id, name }`;
const EXISTING_LORE_IN_WORLD = `*[_type == "loreEntry" && world._ref == $worldId]{ _id, title }`;

// POST /api/import/wiki — multipart: file (WIKI_JSON_TEMPLATE-shaped
// JSON) + worldUnitId (which world unit this import targets — always
// chosen in the console UI, never read from the file itself). Bulk
// createOrReplace + one worldUnit patch, all in a single atomic
// transaction — see lib/wiki-import.js for the resolution logic.
app.post("/", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  const worldUnitId = form.get("worldUnitId");
  if (!file) return c.json({ error: "No JSON file provided" }, 400);
  if (!worldUnitId) return c.json({ error: "worldUnitId is required" }, 400);

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    return c.json({ error: `Malformed JSON: ${err.message}` }, 400);
  }

  const worldUnit = await query(c.env, TARGET_WORLD_UNIT_QUERY, { id: worldUnitId });
  if (!worldUnit) return c.json({ error: `No world unit found for id "${worldUnitId}"` }, 400);

  const [factions, keyFigures, magicItems, notablePlaces, loreEntries] = await Promise.all([
    query(c.env, EXISTING_IN_UNIT("faction", "unit"), { unitId: worldUnitId }),
    query(c.env, EXISTING_IN_UNIT("keyFigure", "unit"), { unitId: worldUnitId }),
    query(c.env, EXISTING_IN_UNIT("magicItem", "unit"), { unitId: worldUnitId }),
    query(c.env, EXISTING_IN_UNIT("notablePlace", "unit"), { unitId: worldUnitId }),
    worldUnit.worldId ? query(c.env, EXISTING_LORE_IN_WORLD, { worldId: worldUnit.worldId }) : [],
  ]);

  const target = {
    worldUnitId,
    worldId: worldUnit.worldId,
    existingOverviewBlocks: worldUnit.overview || [],
  };
  const existing = { factions, keyFigures, magicItems, notablePlaces, loreEntries };

  const { mutations, report, warnings } = buildWikiImportTransaction(
    parsed,
    target,
    existing,
    c.get("gmEmail"),
  );

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
    created: report.filter((r) => r.status === "created").length,
    updated: report.filter((r) => r.status === "updated").length,
    failed: report.filter((r) => r.status === "failed").length,
    report,
    warnings,
    result,
  });
});

export default app;
