/**
 * Bulk Wiki JSON import — parses/resolves the shape defined by
 * WIKI_JSON_TEMPLATE (import-templates.js) into a single atomic Sanity
 * transaction, targeting one WORLD selected in the console UI (never from
 * the file itself). The specific world UNIT within that world is instead
 * named in the file (parsed.worldUnit.name, optional — see below), worlds
 * can only be created in Sanity Studio (admin-only), but world units can
 * be created by this console's service account, so unlike the world, the
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
 *
 * Extended 2026-09-04 (Wiki Restructure Kit, see cnf-website issue #26)
 * with two ADDITIVE capabilities — every file that only used the
 * original shape (worldUnit + unit-scoped arrays) behaves identically to
 * before:
 *
 *   sections — replaces the target world's ENTIRE `world.sections` array
 *   (a full-replace patch, not a merge/append — a restructure pass is
 *   expected to submit the complete reorganized set, not a delta; see
 *   the template's own instructions, which say this explicitly). Each
 *   entry's optional `bucket` (one of BUCKET_ORDER below) is used only
 *   to SORT sections before writing — `bucket` itself is never
 *   persisted, since `world.sections`' schema (worldSection) only has
 *   heading + body. An entry with no bucket, or one not in
 *   BUCKET_ORDER, sorts after every recognized bucket, in file order.
 *
 *   worldLevelEntries — the same five sub-document arrays (factions/
 *   keyFigures/magicItems/notablePlaces/loreEntries) as the pre-existing
 *   top-level arrays, but explicitly NOT scoped to any worldUnit (no
 *   `unit` reference set) — for content that belongs to the world as a
 *   whole rather than one territory. Uses the exact same
 *   wikiDocId(type, worldId, null, name) id scheme the pre-existing
 *   top-level arrays already fall back to whenever no worldUnit is
 *   given, so a world-level entry created via worldLevelEntries and one
 *   created via the top-level arrays (with worldUnit omitted) land on
 *   the same document if named the same — there's only one way to be
 *   "world-level", regardless of which array it was declared in.
 *
 *   A single file MAY mix scopes — e.g. worldLevelEntries content
 *   alongside a worldUnit + its own unit-scoped arrays — since each
 *   scope's entries get their own id computation and their own
 *   reference-resolution lookup (SCOPES below), kept deliberately
 *   separate rather than merged into one global name lookup: a
 *   worldLevelEntries item can only reference other worldLevelEntries
 *   items or existing world-level docs by exact name, not reach into a
 *   different worldUnit's scoped content, and vice versa. This mirrors
 *   how loreEntry (world-scoped by design, see its schema comment) has
 *   always been look-up-scoped to the world rather than the unit, even
 *   in the original single-scope version of this function.
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

// Canonical heading taxonomy order (Wiki Restructure Kit) — sections are
// sorted into this order regardless of the order the file lists them in.
// Purely a sort key at import time; never stored (worldSection has no
// "bucket" field).
const BUCKET_ORDER = ["OV", "HO", "GS", "PC", "PF", "TA", "CC", "TL", "SA"];

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
const SUB_TYPES = [
  ["factions", "faction", "name"],
  ["keyFigures", "keyFigure", "name"],
  ["magicItems", "magicItem", "name"],
  ["loreEntries", "loreEntry", "title"],
  ["notablePlaces", "notablePlace", "name"],
];

/** Resolves a single reference value (local id from this file's scope,
 * or an exact name/title match against that scope's existing docs) to a
 * real Sanity _id. Returns undefined (dropping the reference, not the
 * whole entry) if neither resolves. */
function resolveRef(value, localIdMap, existingByName, warnings, itemLabel, fieldLabel) {
  if (!value) return undefined;
  if (localIdMap.has(value)) return localIdMap.get(value);
  const existingId = existingByName.get(String(value).toLowerCase());
  if (existingId) return existingId;
  warnings.push(`${itemLabel}: ${fieldLabel} "${value}" not found in this file or in the existing wiki (same scope) — reference dropped`);
  return undefined;
}

function resolveRefList(values, localIdMap, existingByName, warnings, itemLabel, fieldLabel) {
  if (!Array.isArray(values)) return undefined;
  const resolved = values
    .map((v) => resolveRef(v, localIdMap, existingByName, warnings, itemLabel, fieldLabel))
    .filter(Boolean);
  return resolved.length ? resolved.map((id) => ({ _type: "reference", _ref: id, _key: crypto.randomUUID() })) : undefined;
}

/** Builds the createOrReplace mutation for one sub-document, shared by
 * both scopes (unit-scoped and world-level) — unitId is null for
 * world-level entries, which is what leaves `unit` unset on the doc. */
function buildSubDocMutation(type, item, _id, displayName, worldId, unitId, localIdMap, existingByNameFns, warnings, audit) {
  const label = `${type === "loreEntry" ? "Lore Entry" : type[0].toUpperCase() + type.slice(1).replace(/([A-Z])/g, " $1")} "${displayName}"`;
  const base = {
    _id, _type: type,
    slug: { _type: "slug", current: slugify(displayName) },
    world: worldId ? { _type: "reference", _ref: worldId } : undefined,
    unit: unitId ? { _type: "reference", _ref: unitId } : undefined,
    ...audit,
  };

  if (type === "faction") {
    return {
      ...base, name: displayName,
      factionType: item.factionType || undefined,
      description: markdownToBlocks(item.description),
      members: resolveRefList(item.members, localIdMap, existingByNameFns("keyFigures"), warnings, label, "member"),
      dmNotes: markdownToBlocks(item.dmNotes),
    };
  }
  if (type === "keyFigure") {
    return {
      ...base, name: displayName,
      alsoKnownAs: item.alsoKnownAs || undefined,
      status: checkEnum("keyFigure.status", item.status, warnings, label),
      faction: (() => {
        const ref = resolveRef(item.faction, localIdMap, existingByNameFns("factions"), warnings, label, "faction");
        return ref ? { _type: "reference", _ref: ref } : undefined;
      })(),
      role: item.role || undefined,
      threatLevel: checkEnum("keyFigure.threatLevel", item.threatLevel, warnings, label),
      description: markdownToBlocks(item.description),
      dmNotes: markdownToBlocks(item.dmNotes),
    };
  }
  if (type === "magicItem") {
    return {
      ...base, name: displayName,
      itemType: item.itemType || undefined,
      rarity: checkEnum("magicItem.rarity", item.rarity, warnings, label),
      currentHolder: (() => {
        const ref = resolveRef(item.currentHolder, localIdMap, existingByNameFns("keyFigures"), warnings, label, "currentHolder");
        return ref ? { _type: "reference", _ref: ref } : undefined;
      })(),
      foundAt: (() => {
        const ref = resolveRef(item.foundAt, localIdMap, existingByNameFns("notablePlaces"), warnings, label, "foundAt");
        return ref ? { _type: "reference", _ref: ref } : undefined;
      })(),
      lore: markdownToBlocks(item.lore),
      dmNotes: markdownToBlocks(item.dmNotes),
    };
  }
  if (type === "notablePlace") {
    return {
      ...base, name: displayName,
      placeType: item.placeType || undefined,
      dangerLevel: checkEnum("notablePlace.dangerLevel", item.dangerLevel, warnings, label),
      description: markdownToBlocks(item.description),
      keyFigures: resolveRefList(item.keyFigures, localIdMap, existingByNameFns("keyFigures"), warnings, label, "keyFigure"),
      items: resolveRefList(item.items, localIdMap, existingByNameFns("magicItems"), warnings, label, "item"),
      dmNotes: markdownToBlocks(item.dmNotes),
    };
  }
  // loreEntry
  return {
    ...base, title: displayName,
    alsoKnownAs: item.alsoKnownAs || undefined,
    category: checkEnum("loreEntry.category", item.category, warnings, label),
    summary: item.summary || undefined,
    body: markdownToBlocks(item.body),
    canonStatus: checkEnum("loreEntry.canonStatus", item.canonStatus, warnings, label),
    firstAppeared: item.firstAppeared || undefined,
    relatedEntries: resolveRefList(item.relatedEntries, localIdMap, existingByNameFns("loreEntries"), warnings, label, "relatedEntry"),
    tags: Array.isArray(item.tags) && item.tags.length ? item.tags : undefined,
  };
}

/**
 * @param {object} parsed - the uploaded JSON, already JSON.parse()'d
 * @param {object} target - { worldId, existingWorldUnit } — existingWorldUnit is
 *   the current worldUnit doc ({ _id, overview } or null if it doesn't exist yet
 *   under this world) for the computed name, fetched by the caller by _id since
 *   the id is deterministic from worldId + parsed.worldUnit.name. Only read when
 *   parsed.worldUnit?.name is present.
 * @param {object} existing - { unit: {...}, world: {...} } — each an object of
 *   { factions, keyFigures, magicItems, notablePlaces, loreEntries } arrays of
 *   { _id, name|title }, already fetched. `unit` is scoped to the target world
 *   unit (or all-empty if no worldUnit given); `world` is scoped to world-level
 *   (no unit) docs under this world, for worldLevelEntries resolution. loreEntries
 *   in both are actually world-scoped either way (that's the field required on
 *   that type) — kept in both shapes only so callers of either scope's lookup
 *   fn get a consistent set of keys.
 * @param {string} gmEmail
 * @returns {{ mutations: object[], report: { type, name, status: "created"|"updated"|"failed", reason? }[], warnings: string[], worldUnitId?: string }}
 */
export function buildWikiImportTransaction(parsed, target, existing, gmEmail) {
  const warnings = [];
  const report = [];
  const mutations = [];
  const now = new Date().toISOString();
  const audit = { consoleEditedByEmail: gmEmail, consoleEditedAt: now };

  // --- worldUnit is now optional: a file with only `sections` and/or
  // `worldLevelEntries` and no `worldUnit` key at all is valid. Only
  // treat it as an error if worldUnit is PRESENT but its name is blank —
  // that's still very likely a mistake worth surfacing, not a valid
  // "no unit" file (an empty {} worldUnit object rather than omitting
  // the key entirely).
  let worldUnitId = null;
  const worldUnitName = parsed.worldUnit?.name;
  if (parsed.worldUnit && (!worldUnitName || !String(worldUnitName).trim())) {
    report.push({ type: "worldUnit", name: "(missing)", status: "failed", reason: 'worldUnit.name is required when a "worldUnit" object is present — omit "worldUnit" entirely for a file with no unit-scoped content' });
  } else if (worldUnitName && String(worldUnitName).trim()) {
    worldUnitId = wikiDocId("worldUnit", target.worldId, null, worldUnitName);
  }
  target = { ...target, worldUnitId };

  if (Array.isArray(parsed.sessionLogs) && parsed.sessionLogs.length) {
    for (const s of parsed.sessionLogs) {
      report.push({ type: "sessionLog", name: s.title || s.name || "(untitled)", status: "failed", reason: "Session logs aren't supported via bulk Wiki import — excluded" });
    }
  }

  // --- Two scopes: "unit" (parsed[key], attaches to worldUnitId if one
  // was given) and "world" (parsed.worldLevelEntries[key], always
  // unit-less). Each gets its own id computation and its own
  // existing-content lookup — see the file-level comment for why these
  // are kept separate rather than merged into one global name lookup.
  const scopes = [
    { label: "unit", unitId: target.worldUnitId, source: parsed, existing: existing.unit || {} },
    { label: "world", unitId: null, source: parsed.worldLevelEntries || {}, existing: existing.world || {} },
  ];

  const existingIdSet = new Set();
  for (const scope of scopes) for (const key of Object.keys(REF_TYPE)) for (const d of scope.existing[key] || []) existingIdSet.add(d._id);

  for (const scope of scopes) {
    // --- Pass 1: compute every entry's deterministic _id, register local ids ---
    const localIdMap = new Map(); // local "id" string -> real Sanity _id
    const prepared = { factions: [], keyFigures: [], magicItems: [], loreEntries: [], notablePlaces: [] };

    for (const [key, type, nameField] of SUB_TYPES) {
      const items = Array.isArray(scope.source[key]) ? scope.source[key] : [];
      for (const item of items) {
        const displayName = item[nameField];
        if (!displayName || !String(displayName).trim()) {
          report.push({ type, name: "(unnamed)", status: "failed", reason: `Missing required "${nameField}"` });
          continue;
        }
        const _id = wikiDocId(type, target.worldId, scope.unitId, displayName);
        if (item.id) localIdMap.set(item.id, _id);
        prepared[key].push({ item, _id, displayName });
      }
    }

    // --- This scope's existing-content lookup maps (name/title, lowercased, -> _id) ---
    const existingByName = {};
    for (const key of Object.keys(REF_TYPE)) {
      existingByName[key] = new Map((scope.existing[key] || []).map((d) => [String(d.name || d.title).toLowerCase(), d._id]));
    }
    // Also let a reference resolve against something already created
    // earlier in THIS SAME scope of this same import pass (e.g. two
    // factions in the file, one naming the other by exact string
    // instead of by local id).
    const existingByNameWithPrepared = (key) => {
      const map = new Map(existingByName[key]);
      for (const { displayName, _id } of prepared[key]) map.set(displayName.toLowerCase(), _id);
      return map;
    };

    // --- Pass 2: build each mutation, resolving references within this scope ---
    for (const [key, type] of SUB_TYPES) {
      for (const { item, _id, displayName } of prepared[key]) {
        mutations.push({
          createOrReplace: buildSubDocMutation(type, item, _id, displayName, target.worldId, scope.unitId, localIdMap, existingByNameWithPrepared, warnings, audit),
        });
        const suffix = scope.label === "world" ? " (world-level)" : "";
        report.push({ type: type + suffix, name: displayName, status: existingIdSet.has(_id) ? "updated" : "created" });
      }
    }
  }

  // --- sections: full-replace patch on the target world's own
  // world.sections array. Sorted by canonical bucket order; `bucket`
  // itself is discarded, never persisted (worldSection has no such
  // field). Only runs if the file actually has a non-empty sections
  // array — omit the key entirely for a file that's purely
  // worldLevelEntries/worldUnit content.
  if (Array.isArray(parsed.sections) && parsed.sections.length) {
    const rank = (s) => {
      const i = BUCKET_ORDER.indexOf(s.bucket);
      return i === -1 ? BUCKET_ORDER.length : i;
    };
    const sorted = parsed.sections
      .map((s, i) => ({ ...s, _origIndex: i }))
      .sort((a, b) => rank(a) - rank(b) || a._origIndex - b._origIndex);

    const missingHeading = sorted.filter((s) => !s.heading || !String(s.heading).trim());
    if (missingHeading.length) {
      report.push({ type: "worldSections", name: "(sections)", status: "failed", reason: `${missingHeading.length} section(s) missing a "heading" — entire sections array skipped, nothing else in this file was affected` });
    } else {
      const sections = sorted.map((s) => ({
        _key: crypto.randomUUID(),
        _type: "worldSection",
        heading: String(s.heading).trim(),
        body: markdownToBlocks(s.body) || [],
      }));
      mutations.push({ patch: { id: target.worldId, set: { sections } } });
      report.push({ type: "worldSections", name: `${sections.length} section(s)`, status: "updated" });
    }
  }

  // --- worldUnit: create if it doesn't exist yet under this world, else
  // patch it. Unlike a world (admin-only in Studio), a unit is fair game
  // for this import to create. overview is APPENDED to an existing
  // unit's overview, or becomes the whole overview on a freshly created
  // one (nothing to append to). Skipped entirely if no worldUnit was
  // given (or its name failed validation above, in which case a report
  // row was already pushed).
  if (worldUnitId && worldUnitName && String(worldUnitName).trim()) {
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
