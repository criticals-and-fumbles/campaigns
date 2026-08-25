import { Hono } from "hono";
import { query, mutate, createOrReplace } from "../lib/sanity.js";
import { wikiDocId } from "../lib/slug.js";
import { markdownToBlocks } from "../lib/portable-text.js";
import { rejectServerManagedField, stampAudit } from "../lib/wiki-audit.js";

const app = new Hono();

// POST /api/world-unit — body: { world, name, dmOwner?, overview?,
// developmentStatus?, colourAccent?, pageFooterCTA?, mapImageUrl? }.
// world/dmOwner are Sanity document _ids (reference targets), not slugs.
// overview/pageFooterCTA are plain markdown strings from the client —
// converted to Portable Text server-side (see lib/portable-text.js).
// No ownership check — any console GM may create/edit any world unit
// (see lib/wiki-audit.js for why, and what IS tracked instead).
app.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.world) return c.json({ error: "world is required" }, 400);
  if (!body.name) return c.json({ error: "name is required" }, 400);

  const slug = body.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  if (!slug) return c.json({ error: "name must contain at least one letter/number" }, 400);

  const doc = {
    _id: wikiDocId("worldUnit", body.world, null, body.name),
    _type: "worldUnit",
    name: body.name,
    slug: { _type: "slug", current: slug },
    world: { _type: "reference", _ref: body.world },
    dmOwner: body.dmOwner ? { _type: "reference", _ref: body.dmOwner } : undefined,
    overview: markdownToBlocks(body.overview),
    developmentStatus: body.developmentStatus || undefined,
    colourAccent: body.colourAccent || undefined,
    pageFooterCTA: markdownToBlocks(body.pageFooterCTA),
    mapImageUrl: body.mapImageUrl || undefined,
    ...stampAudit(c.get("gmEmail")),
  };

  try {
    const result = await createOrReplace(c.env, doc);
    return c.json({ ok: true, id: doc._id, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// PATCH /api/world-unit/:id — body: { field, value }. Single-field
// mutation, same shape as api-dossier.js. Portable-text fields
// (overview, pageFooterCTA) expect `value` to be a plain markdown
// string — converted here, not by the caller.
app.patch("/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const { field, value } = await c.req.json();
  if (!field) return c.json({ error: "field is required" }, 400);
  if (rejectServerManagedField(field)) {
    return c.json({ error: `"${field}" is server-managed, cannot be set directly` }, 400);
  }
  if (field === "world") {
    return c.json({ error: `"world" cannot be reassigned after creation` }, 400);
  }

  const exists = await query(c.env, `*[_id == $id][0]._id`, { id });
  if (!exists) return c.notFound();

  const portableTextFields = new Set(["overview", "pageFooterCTA"]);
  const setValue = portableTextFields.has(field) ? markdownToBlocks(value) : value;

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
