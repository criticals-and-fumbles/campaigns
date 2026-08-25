import { Hono } from "hono";
import { query, mutate, createOrReplace } from "../lib/sanity.js";
import { wikiDocId } from "../lib/slug.js";
import { markdownToBlocks } from "../lib/portable-text.js";
import { rejectServerManagedField, stampAudit } from "../lib/wiki-audit.js";

const app = new Hono();

// statBlock.traits/actions/legendaryActions/reactions items are
// anonymous `{ type: "object", fields: [name, text] }` in
// schema/keyFigure.ts (no explicit type "name" given) — Sanity assigns
// them the generic "object" _type, not a custom alias.
function namedTextItems(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  return rows
    .filter((r) => r && (r.name || r.text))
    .map((r) => ({ _type: "object", _key: crypto.randomUUID(), name: r.name || undefined, text: r.text || undefined }));
}

function buildStatBlock(sb) {
  if (!sb) return undefined;
  return {
    size: sb.size || undefined,
    creatureType: sb.creatureType || undefined,
    alignment: sb.alignment || undefined,
    ac: sb.ac || undefined,
    hp: sb.hp || undefined,
    speed: sb.speed || undefined,
    abilities: sb.abilities
      ? {
          str: sb.abilities.str ?? undefined,
          dex: sb.abilities.dex ?? undefined,
          con: sb.abilities.con ?? undefined,
          int: sb.abilities.int ?? undefined,
          wis: sb.abilities.wis ?? undefined,
          cha: sb.abilities.cha ?? undefined,
        }
      : undefined,
    savingThrows: sb.savingThrows || undefined,
    skills: sb.skills || undefined,
    resistances: sb.resistances || undefined,
    immunities: sb.immunities || undefined,
    vulnerabilities: sb.vulnerabilities || undefined,
    conditionImmunities: sb.conditionImmunities || undefined,
    senses: sb.senses || undefined,
    passivePerception: sb.passivePerception ?? undefined,
    languages: sb.languages || undefined,
    challengeRating: sb.challengeRating || undefined,
    traits: namedTextItems(sb.traits),
    actions: namedTextItems(sb.actions),
    legendaryActions: namedTextItems(sb.legendaryActions),
    reactions: namedTextItems(sb.reactions),
  };
}

// POST /api/key-figure — body: { world?, unit?, name, alsoKnownAs?,
// status?, faction? (keyFigure's faction _id), role?, threatLevel?,
// description?, hasStatBlock?, statBlock?, dmNotes? }.
app.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);

  const doc = {
    _id: wikiDocId("keyFigure", body.world, body.unit, body.name),
    _type: "keyFigure",
    name: body.name,
    slug: { _type: "slug", current: body.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || undefined },
    world: body.world ? { _type: "reference", _ref: body.world } : undefined,
    unit: body.unit ? { _type: "reference", _ref: body.unit } : undefined,
    alsoKnownAs: body.alsoKnownAs || undefined,
    status: body.status || undefined,
    faction: body.faction ? { _type: "reference", _ref: body.faction } : undefined,
    role: body.role || undefined,
    threatLevel: body.threatLevel || undefined,
    description: markdownToBlocks(body.description),
    hasStatBlock: body.hasStatBlock === true,
    statBlock: body.hasStatBlock === true ? buildStatBlock(body.statBlock) : undefined,
    dmNotes: markdownToBlocks(body.dmNotes),
    ...stampAudit(c.get("gmEmail")),
  };

  try {
    const result = await createOrReplace(c.env, doc);
    return c.json({ ok: true, id: doc._id, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// PATCH /api/key-figure/:id — body: { field, value }. statBlock is
// PATCHed as one whole-object field (not per-sub-field), same as
// dossier's array fields are replaced wholesale, not merged.
app.patch("/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const { field, value } = await c.req.json();
  if (!field) return c.json({ error: "field is required" }, 400);
  if (rejectServerManagedField(field)) {
    return c.json({ error: `"${field}" is server-managed, cannot be set directly` }, 400);
  }

  const exists = await query(c.env, `*[_id == $id][0]._id`, { id });
  if (!exists) return c.notFound();

  let setValue = value;
  if (field === "description" || field === "dmNotes") setValue = markdownToBlocks(value);
  if (field === "statBlock") setValue = buildStatBlock(value);

  try {
    const result = await mutate(c.env, [
      { patch: { id, set: { [field]: setValue, ...stampAudit(c.get("gmEmail")) } } },
    ]);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
