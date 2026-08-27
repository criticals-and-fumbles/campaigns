import { Hono } from "hono";
import { query, mutate, createOrReplace } from "../lib/sanity.js";
import { wikiDocId } from "../lib/slug.js";
import { markdownToBlocks } from "../lib/portable-text.js";
import { rejectServerManagedField, stampAudit } from "../lib/wiki-audit.js";
import { requireWorldCollaborator } from "../lib/world-access.js";

const app = new Hono();

function buildMechanics(m) {
  if (!m) return undefined;
  return {
    itemTypeDetail: m.itemTypeDetail || undefined,
    attunement: m.attunement || undefined,
    // mechanics.text is schema type "text" (plain string), NOT Portable
    // Text — do not run through markdownToBlocks.
    text: m.text || undefined,
  };
}

// POST /api/magic-item — body: { world?, unit?, name, itemType?,
// rarity?, currentHolder? (keyFigure _id), foundAt? (notablePlace _id),
// lore?, hasMechanics?, mechanics?, dmNotes? }.
app.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);

  const { member, error } = await requireWorldCollaborator(c, body.world, body.unit);
  if (error) return error;

  const doc = {
    _id: wikiDocId("magicItem", body.world, body.unit, body.name),
    _type: "magicItem",
    name: body.name,
    slug: { _type: "slug", current: body.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || undefined },
    world: body.world ? { _type: "reference", _ref: body.world } : undefined,
    unit: body.unit ? { _type: "reference", _ref: body.unit } : undefined,
    itemType: body.itemType || undefined,
    rarity: body.rarity || undefined,
    currentHolder: body.currentHolder ? { _type: "reference", _ref: body.currentHolder } : undefined,
    foundAt: body.foundAt ? { _type: "reference", _ref: body.foundAt } : undefined,
    lore: markdownToBlocks(body.lore),
    hasMechanics: body.hasMechanics === true,
    mechanics: body.hasMechanics === true ? buildMechanics(body.mechanics) : undefined,
    dmNotes: markdownToBlocks(body.dmNotes),
    ...stampAudit(c.get("gmEmail"), member._id),
  };

  try {
    const result = await createOrReplace(c.env, doc);
    return c.json({ ok: true, id: doc._id, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// PATCH /api/magic-item/:id — body: { field, value }.
app.patch("/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const { field, value } = await c.req.json();
  if (!field) return c.json({ error: "field is required" }, 400);
  if (rejectServerManagedField(field)) {
    return c.json({ error: `"${field}" is server-managed, cannot be set directly` }, 400);
  }

  const existing = await query(c.env, `*[_id == $id][0]{ "world": world._ref, "unit": unit._ref }`, { id });
  if (!existing) return c.notFound();

  const { member, error } = await requireWorldCollaborator(c, existing.world, existing.unit);
  if (error) return error;

  let setValue = value;
  if (field === "lore" || field === "dmNotes") setValue = markdownToBlocks(value);
  if (field === "mechanics") setValue = buildMechanics(value);

  try {
    const result = await mutate(c.env, [
      { patch: { id, set: { [field]: setValue, ...stampAudit(c.get("gmEmail"), member._id) } } },
    ]);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
