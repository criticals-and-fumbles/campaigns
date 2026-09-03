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

// Same idea, but for WORLD-LEVEL (no unit) docs — used to resolve
// worldLevelEntries references, and to correctly report "updated" vs
// "created" for a top-level array item submitted with no worldUnit
// (which is also world-level, see lib/wiki-import.js's scope comment).
// Added 2026-09-04 for the Wiki Restructure Kit — additive, the unit-
// scoped queries above are unchanged.
const EXISTING_WORLD_LEVEL = (type, field) =>
  `*[_type == "${type}" && world._ref == $worldId && !defined(${field})]{ _id, name }`;

// POST /api/import/wiki — multipart: file (WIKI_JSON_TEMPLATE-shaped
// JSON, optionally extended with `sections`/`worldLevelEntries` — see
// the Wiki Restructure Kit / lib/wiki-import.js's file-level comment) +
// worldId (which world this import targets — always chosen in the
// console UI, never read from the file). The specific world unit within
// that world comes from the file's worldUnit.name instead, and is now
// OPTIONAL — a file with only `sections` and/or `worldLevelEntries` and
// no worldUnit at all is valid. A world can only be created in Sanity
// Studio (admin-only), but a unit is fair game for this import to
// create, so unlike the world, it isn't pre-selected. Bulk
// createOrReplace + at most one worldUnit create-or-patch + at most one
// world.sections full-replace patch, all in a single atomic transaction
// — see lib/wiki-import.js for the resolution logic.
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
  const hasWorldUnit = worldUnitName && String(worldUnitName).trim();
  // Deterministic — same scheme api-world-unit.js uses, so a unit
  // created via the manual builder and one created via bulk import for
  // the same world+name land on the same document. null when no
  // worldUnit was given — lib/wiki-import.js treats that as "world-level
  // only", not an error, unless a (malformed) worldUnit object with a
  // blank name was explicitly present, which it reports as a failure.
  const worldUnitId = hasWorldUnit ? wikiDocId("worldUnit", worldId, null, worldUnitName) : null;

  const [
    existingWorldUnit,
    unitFactions, unitKeyFigures, unitMagicItems, unitNotablePlaces, loreEntries,
    worldFactions, worldKeyFigures, worldMagicItems, worldNotablePlaces,
  ] = await Promise.all([
    worldUnitId ? query(c.env, WORLD_UNIT_BY_ID_QUERY, { id: worldUnitId }) : Promise.resolve(null),
    worldUnitId ? query(c.env, EXISTING_IN_UNIT("faction", "unit"), { unitId: worldUnitId }) : Promise.resolve([]),
    worldUnitId ? query(c.env, EXISTING_IN_UNIT("keyFigure", "unit"), { unitId: worldUnitId }) : Promise.resolve([]),
    worldUnitId ? query(c.env, EXISTING_IN_UNIT("magicItem", "unit"), { unitId: worldUnitId }) : Promise.resolve([]),
    worldUnitId ? query(c.env, EXISTING_IN_UNIT("notablePlace", "unit"), { unitId: worldUnitId }) : Promise.resolve([]),
    query(c.env, EXISTING_LORE_IN_WORLD, { worldId }),
    query(c.env, EXISTING_WORLD_LEVEL("faction", "unit"), { worldId }),
    query(c.env, EXISTING_WORLD_LEVEL("keyFigure", "unit"), { worldId }),
    query(c.env, EXISTING_WORLD_LEVEL("magicItem", "unit"), { worldId }),
    query(c.env, EXISTING_WORLD_LEVEL("notablePlace", "unit"), { worldId }),
  ]);

  const target = { worldId, existingWorldUnit };
  const worldLevel = { factions: worldFactions, keyFigures: worldKeyFigures, magicItems: worldMagicItems, notablePlaces: worldNotablePlaces, loreEntries };
  const existing = {
    // When no worldUnit was given, lib/wiki-import.js's "unit" scope
    // (fed by the file's top-level factions/keyFigures/etc arrays)
    // produces world-level documents too (scope.unitId is null either
    // way) — so its existing-content lookup must be the SAME world-level
    // set "world" scope uses, not an empty one, or a top-level array
    // submitted without a worldUnit could never resolve references
    // against, or correctly detect updates to, content that already
    // exists at the world level.
    unit: worldUnitId
      ? { factions: unitFactions, keyFigures: unitKeyFigures, magicItems: unitMagicItems, notablePlaces: unitNotablePlaces, loreEntries }
      : worldLevel,
    world: worldLevel,
  };

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
