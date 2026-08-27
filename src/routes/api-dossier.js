import { Hono } from "hono";
import { query, mutate } from "../lib/sanity.js";

const app = new Hono();

function dossierDocId(campaignSlug, code) {
  return `dossier.${campaignSlug}.${code}`.replace(/[^a-zA-Z0-9._-]/g, "-");
}

// PATCH /api/dossier/:id — body: { field, value, ifRevisionId? }
// Single-field mutation (the core of inline editing — two GMs editing
// different fields of the same document don't clobber each other).
// lastEditedBy/lastEditedAt are always set alongside the requested field,
// server-side, from the Cf-Access identity — never client-supplied.
// Ownership check: the requester must be the ownerEmail of the dossier's
// *campaign*, not the dossier itself — dossiers have no owner field of
// their own, they inherit access from their parent campaign.
app.patch("/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const { field, value, ifRevisionId } = await c.req.json();
  if (!field) return c.json({ error: "field is required" }, 400);
  if (field === "lastEditedBy" || field === "lastEditedAt") {
    return c.json({ error: `"${field}" is server-managed, cannot be set directly` }, 400);
  }
  if (field === "campaign") {
    return c.json({ error: `"campaign" cannot be reassigned after creation` }, 400);
  }

  const current = await query(c.env, `*[_id == $id][0]{ "ownerEmail": campaign->ownerEmail, "campaignRef": campaign._ref }`, { id });
  if (!current) return c.notFound();
  if (current.ownerEmail !== c.get("gmEmail")) {
    return c.json({ error: "Forbidden — you do not own this dossier's campaign" }, 403);
  }

  // The public dossier route looks documents up by `code` (scoped to the
  // parent campaign), not by _id — see routes/dossier.js's DOSSIER_QUERY.
  // _id is fixed at creation from the *original* campaignSlug+code and
  // never re-derived, so `code` is safe to edit afterward, but two
  // dossiers in the same campaign ending up with the same `code` would
  // make that lookup silently pick one and hide the other. Guard it here
  // since the frontend has no visibility into sibling dossiers' codes.
  if (field === "code") {
    if (!value || !String(value).trim()) {
      return c.json({ error: "Code cannot be empty" }, 400);
    }
    const clash = await query(
      c.env,
      `*[_type == "dossier" && campaign._ref == $campaignRef && code == $code && _id != $id][0]._id`,
      { campaignRef: current.campaignRef, code: value, id },
    );
    if (clash) {
      return c.json({ error: `Another dossier in this campaign already uses code "${value}"` }, 409);
    }
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

// DELETE /api/dossier/:id — same ownership check as PATCH (the requester
// must own the dossier's *campaign*, dossiers have no owner field of
// their own). Hard delete — no soft-delete/undo, so the console prompts
// for confirmation before ever calling this.
app.delete("/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));

  const owner = await query(c.env, `*[_id == $id][0].campaign->ownerEmail`, { id });
  if (owner === null || owner === undefined) return c.notFound();
  if (owner !== c.get("gmEmail")) {
    return c.json({ error: "Forbidden — you do not own this dossier's campaign" }, 403);
  }

  try {
    await mutate(c.env, [{ delete: { id } }]);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// POST /api/dossier — body: { campaign: <campaign _id>, code, title, ... }.
// campaign must be one of the caller's own (ownerEmail == gmEmail) —
// otherwise a GM could publish dossiers into another DM's campaign.
app.post("/", async (c) => {
  const doc = await c.req.json();
  if (!doc.campaign) return c.json({ error: "campaign is required" }, 400);
  if (!doc.code) return c.json({ error: "code is required" }, 400);
  if (!doc.title) return c.json({ error: "title is required" }, 400);

  const campaign = await query(c.env, `*[_id == $id][0]{ ownerEmail, "slug": slug.current }`, {
    id: doc.campaign,
  });
  if (!campaign) return c.json({ error: "No such campaign" }, 404);
  if (campaign.ownerEmail !== c.get("gmEmail")) {
    return c.json({ error: "Forbidden — you do not own this campaign" }, 403);
  }

  doc._type = "dossier";
  doc._id = dossierDocId(campaign.slug, doc.code);
  doc.campaign = { _type: "reference", _ref: doc.campaign };
  doc.lastEditedBy = c.get("gmEmail");
  doc.lastEditedAt = new Date().toISOString();

  try {
    const result = await mutate(c.env, [{ createIfNotExists: doc }]);
    return c.json({ ok: true, id: doc._id, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
