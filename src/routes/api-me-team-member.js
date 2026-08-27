import { Hono } from "hono";
import { mutate } from "../lib/sanity.js";
import { resolveMyTeamMember } from "../lib/identity.js";

const app = new Hono();

// Personal/flavor fields only — deliberately excludes handle, slug,
// roles, tier, division, active, worlds, pageFooterCTA. Those are
// org-structure/identity fields; a DM self-editing their own bio should
// not be able to touch their own org standing or the URL their public
// page lives at. See CLAUDE.md-style reasoning in lib/identity.js.
const SELF_EDITABLE_FIELDS = new Set([
  "realName",
  "dndClass",
  "race",
  "alignment",
  "stats",
  "backstory",
  "signatureMove",
  "socialLinks",
  "avatar",
]);

// GET /api/me/team-member — resolves the caller's own linked teamMember
// doc from their Cf-Access email (never client-supplied). 404 with a
// clear message if this email hasn't been linked to one yet — linking
// is a one-off admin action (scripts/link-team-member.js), not
// something a DM can do themselves.
app.get("/", async (c) => {
  const email = c.get("gmEmail");
  const member = await resolveMyTeamMember(c.env, email);
  if (!member) {
    return c.json(
      { error: "No team member profile is linked to this email yet — ask an admin to link one." },
      404,
    );
  }
  return c.json({ ok: true, member });
});

// PATCH /api/me/team-member — body: { field, value }. Same single-field
// pattern as api-dossier.js/api-campaign.js, but the target document is
// resolved server-side from the caller's own email, never accepted from
// the client — a DM can only ever reach this branch for their own doc.
app.patch("/", async (c) => {
  const email = c.get("gmEmail");
  const member = await resolveMyTeamMember(c.env, email);
  if (!member) {
    return c.json(
      { error: "No team member profile is linked to this email yet — ask an admin to link one." },
      404,
    );
  }

  const { field, value } = await c.req.json();
  if (!field) return c.json({ error: "field is required" }, 400);
  if (!SELF_EDITABLE_FIELDS.has(field)) {
    return c.json({ error: `"${field}" is not self-editable — ask an admin to change it` }, 400);
  }

  try {
    const result = await mutate(c.env, [{ patch: { id: member._id, set: { [field]: value } } }]);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
