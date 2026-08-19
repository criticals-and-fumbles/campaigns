import { Hono } from "hono";
import { mutate } from "../lib/sanity.js";

const app = new Hono();

// PATCH /api/dossier/:id — body: { field, value, ifRevisionId? }
// Single-field mutation (the core of inline editing — two GMs editing
// different fields of the same document don't clobber each other).
// lastEditedBy/lastEditedAt are always set alongside the requested field,
// server-side, from the Cf-Access identity — never client-supplied.
app.patch("/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const { field, value, ifRevisionId } = await c.req.json();
  if (!field) return c.json({ error: "field is required" }, 400);
  if (field === "lastEditedBy" || field === "lastEditedAt") {
    return c.json({ error: `"${field}" is server-managed, cannot be set directly` }, 400);
  }

  const patch = {
    id,
    set: {
      [field]: value,
      lastEditedBy: c.get("gmEmail"),
      lastEditedAt: new Date().toISOString(),
    },
  };
  if (ifRevisionId) patch.ifRevisionID = ifRevisionId;

  try {
    const result = await mutate(c.env, [{ patch }]);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// POST /api/dossier — body: full new dossier document.
app.post("/", async (c) => {
  const doc = await c.req.json();
  doc._type = "dossier";
  doc._id = doc._id || `dossier.${crypto.randomUUID()}`;
  doc.lastEditedBy = c.get("gmEmail");
  doc.lastEditedAt = new Date().toISOString();

  try {
    const result = await mutate(c.env, [{ createOrReplace: doc }]);
    return c.json({ ok: true, id: doc._id, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
