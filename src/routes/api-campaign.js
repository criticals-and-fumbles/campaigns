import { Hono } from "hono";
import { query, mutate } from "../lib/sanity.js";

const app = new Hono();

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

// POST /api/campaign — body: { title, genre, system, status, gmNames, theme,
// hook, motto, signOff, visible? }. ownerEmail is always server-set, never
// client-supplied — see Schema Safety Protocol / CLAUDE.md § ownership.
// visible defaults to false (draft) but the client may opt into publishing
// immediately at creation time — it's a publish flag, not an access
// boundary, so accepting it here (unlike ownerEmail) is safe.
app.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.title) return c.json({ error: "title is required" }, 400);
  if (!body.genre) return c.json({ error: "genre is required" }, 400);
  if (!body.theme) return c.json({ error: "theme is required" }, 400);

  const slug = slugify(body.title);
  if (!slug) return c.json({ error: "title must contain at least one letter/number" }, 400);

  const existing = await query(c.env, `*[_type == "campaign" && slug.current == $slug][0]._id`, { slug });
  if (existing) return c.json({ error: `A campaign with slug "${slug}" already exists` }, 409);

  const doc = {
    _id: `campaign.${slug}`,
    _type: "campaign",
    title: body.title,
    slug: { _type: "slug", current: slug },
    genre: body.genre,
    system: body.system || undefined,
    status: body.status || "active",
    gmNames: Array.isArray(body.gmNames) ? body.gmNames : undefined,
    theme: { _type: "reference", _ref: body.theme },
    hook: body.hook || undefined,
    motto: body.motto || undefined,
    signOff: body.signOff || undefined,
    heroImage: body.heroImage || undefined,
    ownerEmail: c.get("gmEmail"),
    visible: body.visible === true,
  };

  try {
    const result = await mutate(c.env, [{ createIfNotExists: doc }]);
    return c.json({ ok: true, id: doc._id, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// PATCH /api/campaign/:id — body: { field, value }. Single-field mutation,
// same shape as api-dossier.js's PATCH. Requires the caller's Access
// identity to match the campaign's ownerEmail — this is the enforcement
// point for "only the DM who created a campaign can edit it" (CLAUDE.md).
app.patch("/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const { field, value } = await c.req.json();
  if (!field) return c.json({ error: "field is required" }, 400);
  if (field === "ownerEmail") {
    return c.json({ error: `"ownerEmail" is server-managed, cannot be set directly` }, 400);
  }

  const owner = await query(c.env, `*[_id == $id][0].ownerEmail`, { id });
  if (owner === null || owner === undefined) return c.notFound();
  if (owner !== c.get("gmEmail")) {
    return c.json({ error: "Forbidden — you did not create this campaign" }, 403);
  }

  try {
    const result = await mutate(c.env, [{ patch: { id, set: { [field]: value } } }]);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
