import { Hono } from "hono";
import { query, mutate, createOrReplace } from "../lib/sanity.js";
import { wikiDocId } from "../lib/slug.js";
import { markdownToBlocks } from "../lib/portable-text.js";
import { rejectServerManagedField, stampAudit } from "../lib/wiki-audit.js";
import { requireWorldCollaborator } from "../lib/world-access.js";

const app = new Hono();

// POST /api/notable-place — body: { world?, unit?, name, placeType?,
// dangerLevel?, description?, keyFigures? (array of keyFigure _ids),
// items? (array of magicItem _ids), dmNotes? }.
app.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);

  const { member, error } = await requireWorldCollaborator(c, body.world, body.unit);
  if (error) return error;

  const doc = {
    _id: wikiDocId("notablePlace", body.world, body.unit, body.name),
    _type: "notablePlace",
    name: body.name,
    slug: { _type: "slug", current: body.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || undefined },
    world: body.world ? { _type: "reference", _ref: body.world } : undefined,
    unit: body.unit ? { _type: "reference", _ref: body.unit } : undefined,
    placeType: body.placeType || undefined,
    dangerLevel: body.dangerLevel || undefined,
    description: markdownToBlocks(body.description),
    keyFigures: Array.isArray(body.keyFigures) && body.keyFigures.length
      ? body.keyFigures.map((id) => ({ _type: "reference", _ref: id, _key: crypto.randomUUID() }))
      : undefined,
    items: Array.isArray(body.items) && body.items.length
      ? body.items.map((id) => ({ _type: "reference", _ref: id, _key: crypto.randomUUID() }))
      : undefined,
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

// PATCH /api/notable-place/:id — body: { field, value }.
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
  if (field === "description" || field === "dmNotes") setValue = markdownToBlocks(value);
  if (field === "keyFigures" || field === "items") {
    setValue = Array.isArray(value)
      ? value.map((refId) => ({ _type: "reference", _ref: refId, _key: crypto.randomUUID() }))
      : [];
  }

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
