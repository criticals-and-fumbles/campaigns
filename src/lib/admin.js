/**
 * Admin gate for the console's team-member-linking panel. "Admin" here
 * means teamMember.tier === "Horsemen" — the only tier this app treats
 * as meaning anything; every other tier value is purely descriptive
 * elsewhere (main site's /team page). Tier itself is Studio-only: it's
 * not in api-me-team-member.js's SELF_EDITABLE_FIELDS allow-list, and
 * there is no console flow that creates a teamMember document or sets
 * tier — both are deliberately left to Sanity Studio (an admin sets a
 * new member's tier by hand when adding them), per explicit instruction.
 */
import { resolveMyTeamMember } from "./identity.js";

const ADMIN_TIER = "Horsemen";

/** Returns { member } if the caller is an admin, or { error } (a
 * ready-to-return c.json(...) response) otherwise. */
export async function requireAdmin(c) {
  const email = c.get("gmEmail");
  const member = await resolveMyTeamMember(c.env, email);
  if (!member || member.tier !== ADMIN_TIER) {
    return { error: c.json({ error: "Forbidden — admin access requires Horsemen tier" }, 403) };
  }
  return { member };
}
