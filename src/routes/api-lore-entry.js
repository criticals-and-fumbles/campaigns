import { Hono } from "hono";
import { query, mutate, createOrReplace } from "../lib/sanity.js";
import { wikiDocId } from "../lib/slug.js";
import { markdownToBlocks } from "../lib/portable-text.js";
import { rejectServerManagedField, stampAudit } from "../lib/wiki-audit.js";

const app = new Hono();

// POST /api/lore-entry — body: { world, unit?, title, alsoKnownAs?,
// category?, summary?, body? (markdown -> Portable Text; named "body"
// in the schema, kept as `input.body` here to avoid clashing with the
// request payload variable), canonStatus?, firstAppeared?,
// relatedEntries? (array of loreEntry _ids), tags?, submittedBy?
// (teamMember _id). world is required per schema/loreEntry.ts.
app.post("/", async (c) => {
  const input = await c.req.json();
  if (!input.world) return c.json({ error: "world is required" }, 400);
  if (!input.title) return c.json({ error: "title is required" }, 400);

  const doc = {
    _id: wikiDocId("loreEntry", input.world, input.unit, input.title),
    _type: "loreEntry",
    title: input.title,
    slug: { _type: "slug", current: input.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || undefined },
    world: { _type: "reference", _ref: input.world },
    unit: input.unit ? { _type: "reference", _ref: input.unit } : undefined,
    alsoKnownAs: input.alsoKnownAs || undefined,
    category: input.category || undefined,
    // summary is schema type "text" (plain string, max 300) — not Portable Text.
    summary: input.summary || undefined,
    body: markdownToBlocks(input.body),
    canonStatus: input.canonStatus || undefined,
    firstAppeared: input.firstAppeared || undefined,
    relatedEntries: Array.isArray(input.relatedEntries) && input.relatedEntries.length
      ? input.relatedEntries.map((id) => ({ _type: "reference", _ref: id, _key: crypto.randomUUID() }))
      : undefined,
    tags: Array.isArray(input.tags) && input.tags.length ? input.tags : undefined,
    submittedBy: input.submittedBy ? { _type: "reference", _ref: input.submittedBy } : undefined,
    ...stampAudit(c.get("gmEmail")),
  };

  try {
    const result = await createOrReplace(c.env, doc);
    return c.json({ ok: true, id: doc._id, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// PATCH /api/lore-entry/:id — body: { field, value }.
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

  let setValue = value;
  if (field === "body") setValue = markdownToBlocks(value);
  if (field === "relatedEntries") {
    setValue = Array.isArray(value)
      ? value.map((refId) => ({ _type: "reference", _ref: refId, _key: crypto.randomUUID() }))
      : [];
  }

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
