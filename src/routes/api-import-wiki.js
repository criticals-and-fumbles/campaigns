import { Hono } from "hono";
import { query, mutate } from "../lib/sanity.js";
import { buildWikiImportTransaction } from "../lib/wiki-import.js";
import { wikiDocId } from "../lib/slug.js";

const app = new Hono();

const WORLD_UNIT_BY_ID_QUERY = `*[_id == $id][0]{ _id, overview }`;

// Existing content scoped to the target world unit (or, for loreEntries,
// the world — that's the field actually required on that type) — used
// only to resolve bulk-import references by exact name/title match, same
// idea as the manual builder's createOrReplace-by-name-in-scope rule.
const EXISTING_IN_UNIT = (type, field) =>
  `*[_type == "${type}" && ${field}._ref == $unitId]{ _id, name }`;
const EXISTING_LORE_IN_WORLD = `*[_type == "loreEntry" && world._ref == $worldId]{ _id, title }`;

// POST /api/import/wiki — multipart: file (WIKI_JSON_TEMPLATE-shaped
// JSON) + worldId (which world this import targets — always chosen in
// the console UI, never read from the file). The specific world unit
// within that world comes from the file's worldUnit.name instead — a
// world can only be created in Sanity Studio (admin-only), but a unit is
// fair game for this import to create, so unlike the world, it isn't
// pre-selected. Bulk createOrReplace + one worldUnit create-or-patch,
// all in a single atomic transaction — see lib/wiki-import.js for the
// resolution logic.
app.post("/", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  const worldId = form.get("worldId");
  if (!file) return c.json({ error: "No JSON file provided" }, 400);
  if (!worldId) return c.json({ error: "worldId is required" }, 400);

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    return c.json({ error: `Malformed JSON: ${err.message}` }, 400);
  }

  const worldUnitName = parsed.worldUnit?.name;
  if (!worldUnitName || !String(worldUnitName).trim()) {
    return c.json({ error: 'worldUnit.name is required in the uploaded file — it says which unit within the selected world this import targets' }, 400);
  }

  // Deterministic — same scheme api-world-unit.js uses, so a unit
  // created via the manual builder and one created via bulk import for
  // the same world+name land on the same document.
  const worldUnitId = wikiDocId("worldUnit", worldId, null, worldUnitName);

  const [existingWorldUnit, factions, keyFigures, magicItems, notablePlaces, loreEntries] = await Promise.all([
    query(c.env, WORLD_UNIT_BY_ID_QUERY, { id: worldUnitId }),
    query(c.env, EXISTING_IN_UNIT("faction", "unit"), { unitId: worldUnitId }),
    query(c.env, EXISTING_IN_UNIT("keyFigure", "unit"), { unitId: worldUnitId }),
    query(c.env, EXISTING_IN_UNIT("magicItem", "unit"), { unitId: worldUnitId }),
    query(c.env, EXISTING_IN_UNIT("notablePlace", "unit"), { unitId: worldUnitId }),
    query(c.env, EXISTING_LORE_IN_WORLD, { worldId }),
  ]);

  const target = { worldId, existingWorldUnit };
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
