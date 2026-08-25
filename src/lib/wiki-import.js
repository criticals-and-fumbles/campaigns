/**
 * Bulk Wiki JSON import — parses/resolves the shape defined by
 * WIKI_JSON_TEMPLATE (import-templates.js) into a single atomic Sanity
 * transaction, targeting one WORLD selected in the console UI (never from
 * the file itself). The specific world UNIT within that world is instead
 * named in the file (parsed.worldUnit.name, required) — worlds can only
 * be created in Sanity Studio (admin-only), but world units can be
 * created by this console's service account, so unlike the world, the
 * unit is fair game for this import to create if it doesn't exist yet.
 *
 * Reference resolution is single-pass, not dependency-ordered, and that's
 * deliberate: every entry's Sanity _id — including the worldUnit's own
 * id — is computed deterministically up front (wikiDocId(), same scheme
 * api-faction.js etc. use for the manual builder, so bulk-imported and
 * manually-created content interoperate under the same "same name+scope
 * updates in place" rule) before any mutation is built. Since Sanity
 * references are just string _id pointers created within the same
 * transaction, a faction that references a keyFigure and a keyFigure
 * that references that same faction (a real circular case in this
 * schema) both resolve correctly without needing factions-before-
 * keyFigures ordering — building the whole id map first replaces the
 * "process in dependency order" approach originally planned.
 */
import { wikiDocId, slugify } from "./slug.js";
import { markdownToBlocks } from "./portable-text.js";

const ENUMS = {
  "keyFigure.status": ["alive", "dead", "unknown", "missing"],
  "keyFigure.threatLevel": ["friendly", "neutral", "cautious", "dangerous", "deadly"],
  "magicItem.rarity": ["common", "uncommon", "rare", "very-rare", "legendary", "artifact"],
  "loreEntry.category": [
    "Location", "Faction", "NPC", "History", "Creature", "Artefact", "Magic", "Pantheon", "Culture",
  ],
  "loreEntry.canonStatus": ["canon", "homebrew", "disputed", "rumour", "retconned", "dm-eyes-only"],
  "notablePlace.dangerLevel": ["safe", "low-risk", "dangerous", "deadly"],
  "worldUnit.developmentStatus": ["draft", "in-progress", "established", "canonical"],
};

function checkEnum(schemaKey, value, warnings, itemLabel) {
  if (value === undefined || value === null || value === "") return undefined;
  const allowed = ENUMS[schemaKey];
  if (!allowed.includes(value)) {
    warnings.push(`${itemLabel}: "${value}" is not a valid ${schemaKey.split(".")[1]} — dropped (allowed: ${allowed.join(", ")})`);
    return undefined;
  }
  return value;
}

const REF_TYPE = { keyFigures: "keyFigure", factions: "faction", magicItems: "magicItem", notablePlaces: "notablePlace", loreEntries: "loreEntry" };

/** Resolves a single reference value (local id from this file, or an
 * exact name/title match against existing docs) to a real Sanity _id.
 * Returns undefined (dropping the reference, not the whole entry) if
 * neither resolves. */
function resolveRef(value, localIdMap, existingByName, warnings, itemLabel, fieldLabel) {
  if (!value) return undefined;
  if (localIdMap.has(value)) return localIdMap.get(value);
  const existingId = existingByName.get(String(value).toLowerCase());
  if (existingId) return existingId;
  warnings.push(`${itemLabel}: ${fieldLabel} "${value}" not found in this file or in the selected world unit — reference dropped`);
  return undefined;
}

function resolveRefList(values, localIdMap, existingByName, warnings, itemLabel, fieldLabel) {
  if (!Array.isArray(values)) return undefined;
  const resolved = values
    .map((v) => resolveRef(v, localIdMap, existingByName, warnings, itemLabel, fieldLabel))
    .filter(Boolean);
  return resolved.length ? resolved.map((id) => ({ _type: "reference", _ref: id, _key: crypto.randomUUID() })) : undefined;
}

/**
 * @param {object} parsed - the uploaded JSON, already JSON.parse()'d
 * @param {object} target - { worldId, existingWorldUnit } — existingWorldUnit is
 *   the current worldUnit doc ({ _id, overview } or null if it doesn't exist yet
 *   under this world) for the computed name, fetched by the caller by _id since
 *   the id is deterministic from worldId + parsed.worldUnit.name
 * @param {object} existing - { factions, keyFigures, magicItems, notablePlaces, loreEntries } each
 *   an array of { _id, name|title } already fetched, scoped to this world unit (loreEntries scoped
 *   to the world, since it's the field that's actually required on that type)
 * @param {string} gmEmail
 * @returns {{ mutations: object[], report: { type, name, status: "created"|"updated"|"failed", reason? }[], warnings: string[], worldUnitId?: string }}
 */
export function buildWikiImportTransaction(parsed, target, existing, gmEmail) {
  const warnings = [];
  const report = [];
  const mutations = [];
  const now = new Date().toISOString();
  const audit = { consoleEditedByEmail: gmEmail, consoleEditedAt: now };

  const worldUnitName = parsed.worldUnit?.name;
  if (!worldUnitName || !String(worldUnitName).trim()) {
    return {
      mutations: [],
      report: [{ type: "worldUnit", name: "(missing)", status: "failed", reason: 'worldUnit.name is required — it says which unit within the selected world this import targets' }],
      warnings: [],
    };
  }
  const worldUnitId = wikiDocId("worldUnit", target.worldId, null, worldUnitName);
  target = { ...target, worldUnitId };

  if (Array.isArray(parsed.sessionLogs) && parsed.sessionLogs.length) {
    for (const s of parsed.sessionLogs) {
      report.push({ type: "sessionLog", name: s.title || s.name || "(untitled)", status: "failed", reason: "Session logs aren't supported via bulk Wiki import — excluded" });
    }
  }

  // --- Pass 1: compute every entry's deterministic _id, register local ids ---
  const localIdMap = new Map(); // local "id" string -> real Sanity _id
  const prepared = { factions: [], keyFigures: [], magicItems: [], loreEntries: [], notablePlaces: [] };

  for (const [key, type, nameField] of [
    ["factions", "faction", "name"],
    ["keyFigures", "keyFigure", "name"],
    ["magicItems", "magicItem", "name"],
    ["loreEntries", "loreEntry", "title"],
    ["notablePlaces", "notablePlace", "name"],
  ]) {
    const items = Array.isArray(parsed[key]) ? parsed[key] : [];
    for (const item of items) {
      const displayName = item[nameField];
      if (!displayName || !String(displayName).trim()) {
        report.push({ type, name: "(unnamed)", status: "failed", reason: `Missing required "${nameField}"` });
        continue;
      }
      const _id = wikiDocId(type, target.worldId, target.worldUnitId, displayName);
      if (item.id) localIdMap.set(item.id, _id);
      prepared[key].push({ item, _id, displayName });
    }
  }

  // --- Existing-content lookup maps (name/title, lowercased, -> _id) ---
  const existingByName = {};
  for (const key of Object.keys(REF_TYPE)) {
    existingByName[key] = new Map((existing[key] || []).map((d) => [String(d.name || d.title).toLowerCase(), d._id]));
  }
  // Also let a reference resolve against something already created earlier
  // in THIS same import pass (e.g. two factions in the file, one naming
  // the other by exact string instead of by local id). `prepared`'s keys
  // (factions/keyFigures/magicItems/notablePlaces/loreEntries) already
  // match existingByName's keys one-to-one.
  const existingByNameWithPrepared = (key) => {
    const map = new Map(existingByName[key]);
    for (const { displayName, _id } of prepared[key]) map.set(displayName.toLowerCase(), _id);
    return map;
  };

  // --- Existing-doc-id sets, to report created vs updated accurately ---
  const existingIdSet = new Set();
  for (const key of Object.keys(existing)) for (const d of existing[key] || []) existingIdSet.add(d._id);

  // --- Pass 2: build each mutation, resolving references ---
  for (const { item, _id, displayName } of prepared.factions) {
    const label = `Faction "${displayName}"`;
    mutations.push({
      createOrReplace: {
        _id, _type: "faction", name: displayName,
        slug: { _type: "slug", current: slugify(displayName) },
        world: target.worldId ? { _type: "reference", _ref: target.worldId } : undefined,
        unit: target.worldUnitId ? { _type: "reference", _ref: target.worldUnitId } : undefined,
        factionType: item.factionType || undefined,
        description: markdownToBlocks(item.description),
        members: resolveRefList(item.members, localIdMap, existingByNameWithPrepared("keyFigures"), warnings, label, "member"),
        dmNotes: markdownToBlocks(item.dmNotes),
        ...audit,
      },
    });
    report.push({ type: "faction", name: displayName, status: existingIdSet.has(_id) ? "updated" : "created" });
  }

  for (const { item, _id, displayName } of prepared.keyFigures) {
    const label = `Key Figure "${displayName}"`;
    mutations.push({
      createOrReplace: {
        _id, _type: "keyFigure", name: displayName,
        slug: { _type: "slug", current: slugify(displayName) },
        world: target.worldId ? { _type: "reference", _ref: target.worldId } : undefined,
        unit: target.worldUnitId ? { _type: "reference", _ref: target.worldUnitId } : undefined,
        alsoKnownAs: item.alsoKnownAs || undefined,
        status: checkEnum("keyFigure.status", item.status, warnings, label),
        faction: (() => {
          const ref = resolveRef(item.faction, localIdMap, existingByNameWithPrepared("factions"), warnings, label, "faction");
          return ref ? { _type: "reference", _ref: ref } : undefined;
        })(),
        role: item.role || undefined,
        threatLevel: checkEnum("keyFigure.threatLevel", item.threatLevel, warnings, label),
        description: markdownToBlocks(item.description),
        dmNotes: markdownToBlocks(item.dmNotes),
        ...audit,
      },
    });
    report.push({ type: "keyFigure", name: displayName, status: existingIdSet.has(_id) ? "updated" : "created" });
  }

  for (const { item, _id, displayName } of prepared.magicItems) {
    const label = `Magic Item "${displayName}"`;
    mutations.push({
      createOrReplace: {
        _id, _type: "magicItem", name: displayName,
        slug: { _type: "slug", current: slugify(displayName) },
        world: target.worldId ? { _type: "reference", _ref: target.worldId } : undefined,
        unit: target.worldUnitId ? { _type: "reference", _ref: target.worldUnitId } : undefined,
        itemType: item.itemType || undefined,
        rarity: checkEnum("magicItem.rarity", item.rarity, warnings, label),
        currentHolder: (() => {
          const ref = resolveRef(item.currentHolder, localIdMap, existingByNameWithPrepared("keyFigures"), warnings, label, "currentHolder");
          return ref ? { _type: "reference", _ref: ref } : undefined;
        })(),
        foundAt: (() => {
          const ref = resolveRef(item.foundAt, localIdMap, existingByNameWithPrepared("notablePlaces"), warnings, label, "foundAt");
          return ref ? { _type: "reference", _ref: ref } : undefined;
        })(),
        lore: markdownToBlocks(item.lore),
        dmNotes: markdownToBlocks(item.dmNotes),
        ...audit,
      },
    });
    report.push({ type: "magicItem", name: displayName, status: existingIdSet.has(_id) ? "updated" : "created" });
  }

  for (const { item, _id, displayName } of prepared.notablePlaces) {
    const label = `Notable Place "${displayName}"`;
    mutations.push({
      createOrReplace: {
        _id, _type: "notablePlace", name: displayName,
        slug: { _type: "slug", current: slugify(displayName) },
        world: target.worldId ? { _type: "reference", _ref: target.worldId } : undefined,
        unit: target.worldUnitId ? { _type: "reference", _ref: target.worldUnitId } : undefined,
        placeType: item.placeType || undefined,
        dangerLevel: checkEnum("notablePlace.dangerLevel", item.dangerLevel, warnings, label),
        description: markdownToBlocks(item.description),
        keyFigures: resolveRefList(item.keyFigures, localIdMap, existingByNameWithPrepared("keyFigures"), warnings, label, "keyFigure"),
        items: resolveRefList(item.items, localIdMap, existingByNameWithPrepared("magicItems"), warnings, label, "item"),
        dmNotes: markdownToBlocks(item.dmNotes),
        ...audit,
      },
    });
    report.push({ type: "notablePlace", name: displayName, status: existingIdSet.has(_id) ? "updated" : "created" });
  }

  for (const { item, _id, displayName } of prepared.loreEntries) {
    const label = `Lore Entry "${displayName}"`;
    mutations.push({
      createOrReplace: {
        _id, _type: "loreEntry", title: displayName,
        slug: { _type: "slug", current: slugify(displayName) },
        world: target.worldId ? { _type: "reference", _ref: target.worldId } : undefined,
        unit: target.worldUnitId ? { _type: "reference", _ref: target.worldUnitId } : undefined,
        alsoKnownAs: item.alsoKnownAs || undefined,
        category: checkEnum("loreEntry.category", item.category, warnings, label),
        summary: item.summary || undefined,
        body: markdownToBlocks(item.body),
        canonStatus: checkEnum("loreEntry.canonStatus", item.canonStatus, warnings, label),
        firstAppeared: item.firstAppeared || undefined,
        relatedEntries: resolveRefList(item.relatedEntries, localIdMap, existingByNameWithPrepared("loreEntries"), warnings, label, "relatedEntry"),
        tags: Array.isArray(item.tags) && item.tags.length ? item.tags : undefined,
        ...audit,
      },
    });
    report.push({ type: "loreEntry", name: displayName, status: existingIdSet.has(_id) ? "updated" : "created" });
  }

  // --- worldUnit: create if it doesn't exist yet under this world, else
  // patch it. Unlike a world (admin-only in Studio), a unit is fair game
  // for this import to create. overview is APPENDED to an existing
  // unit's overview, or becomes the whole overview on a freshly created
  // one (nothing to append to).
  {
    const wu = parsed.worldUnit;
    const devStatus = checkEnum("worldUnit.developmentStatus", wu.developmentStatus, warnings, "World Unit");
    const overviewBlocks = wu.overview && String(wu.overview).trim() ? markdownToBlocks(wu.overview) || [] : undefined;

    if (target.existingWorldUnit) {
      const set = { ...audit };
      let touchedWorldUnit = false;
      if (overviewBlocks) {
        // Append at the block-array level, not by round-tripping the
        // EXISTING blocks through markdown — blocksToMarkdown() is lossy
        // (drops headings/lists/anything beyond bold+italic paragraphs),
        // so converting-then-reconverting existing content would silently
        // flatten any real formatting already there. Only the NEW text
        // goes through markdownToBlocks(); existing blocks are left
        // completely untouched and just concatenated with the new ones.
        set.overview = [...(target.existingWorldUnit.overview || []), ...overviewBlocks];
        touchedWorldUnit = true;
      }
      if (devStatus) { set.developmentStatus = devStatus; touchedWorldUnit = true; }
      if (wu.colourAccent) { set.colourAccent = wu.colourAccent; touchedWorldUnit = true; }
      if (wu.pageFooterCTA && String(wu.pageFooterCTA).trim()) {
        set.pageFooterCTA = markdownToBlocks(wu.pageFooterCTA);
        touchedWorldUnit = true;
      }
      if (touchedWorldUnit) {
        mutations.push({ patch: { id: worldUnitId, set } });
        report.push({ type: "worldUnit", name: worldUnitName, status: "updated" });
      }
    } else {
      mutations.push({
        createOrReplace: {
          _id: worldUnitId,
          _type: "worldUnit",
          name: worldUnitName,
          slug: { _type: "slug", current: slugify(worldUnitName) },
          world: { _type: "reference", _ref: target.worldId },
          overview: overviewBlocks,
          developmentStatus: devStatus,
          colourAccent: wu.colourAccent || undefined,
          pageFooterCTA: wu.pageFooterCTA && String(wu.pageFooterCTA).trim() ? markdownToBlocks(wu.pageFooterCTA) : undefined,
          ...audit,
        },
      });
      report.push({ type: "worldUnit", name: worldUnitName, status: "created" });
    }
  }

  return { mutations, report, warnings, worldUnitId };
}
