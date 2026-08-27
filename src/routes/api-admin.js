import { Hono } from "hono";
import { query, mutate } from "../lib/sanity.js";
import { hashEmail } from "../lib/identity.js";
import { requireAdmin } from "../lib/admin.js";

const app = new Hono();

const ALL_TEAM_MEMBERS_QUERY = `*[_type == "teamMember"] | order(handle asc){
  _id, handle, realName, tier, "linked": defined(ownerEmailHash)
}`;

// GET /api/admin/team-members — every teamMember doc and whether it's
// linked to a login yet. Never returns the email itself (nothing to
// return — only the hash is ever stored, and this doesn't return that
// either since it's of no use to the UI).
app.get("/team-members", async (c) => {
  const { error } = await requireAdmin(c);
  if (error) return error;
  const members = await query(c.env, ALL_TEAM_MEMBERS_QUERY);
  return c.json({ ok: true, members });
});

// POST /api/admin/link-team-member — body: { email, teamMemberId }.
// Computes the hash server-side and sets it — the plain email in the
// request body is never written anywhere, only ever hashed in memory
// for this one request. Overwrites any existing link on that document
// (re-linking/correcting a mistake), which is intentional.
app.post("/link-team-member", async (c) => {
  const { error } = await requireAdmin(c);
  if (error) return error;

  const { email, teamMemberId } = await c.req.json();
  if (!email || !String(email).trim()) return c.json({ error: "email is required" }, 400);
  if (!teamMemberId) return c.json({ error: "teamMemberId is required" }, 400);

  const exists = await query(c.env, `*[_id == $id][0]._id`, { id: teamMemberId });
  if (!exists) return c.json({ error: "No such team member" }, 404);

  const hash = await hashEmail(c.env, email);
  try {
    const result = await mutate(c.env, [{ patch: { id: teamMemberId, set: { ownerEmailHash: hash } } }]);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// POST /api/admin/unlink-team-member — body: { teamMemberId }. Clears a
// mistaken link (e.g. linked to the wrong person) so it can be redone.
app.post("/unlink-team-member", async (c) => {
  const { error } = await requireAdmin(c);
  if (error) return error;

  const { teamMemberId } = await c.req.json();
  if (!teamMemberId) return c.json({ error: "teamMemberId is required" }, 400);

  try {
    const result = await mutate(c.env, [{ patch: { id: teamMemberId, unset: ["ownerEmailHash"] } }]);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
