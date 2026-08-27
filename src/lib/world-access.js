/**
 * Access control for the six Wiki manual-builder routes (worldUnit,
 * faction, keyFigure, magicItem, loreEntry, notablePlace). Previously
 * none of these had any ownership check at all — see the comment this
 * replaces in lib/wiki-audit.js — because there was no way to resolve a
 * Cf-Access email to a teamMember document. lib/identity.js (added for
 * the console's self-service bio/article editing) removes that
 * blocker, so this reuses the same resolution.
 *
 * A caller may create/edit world-building content when they're either:
 *   - listed in that world's `dms` array (world.ts schema), or
 *   - the `dmOwner` of that specific worldUnit (worldUnit.ts schema)
 * Both fields already existed before this — nothing new added to
 * schema, no existing data touched. An unlinked email (no teamMember
 * profile) can never pass, by definition of "collaborator."
 */
import { query } from "./sanity.js";
import { resolveMyTeamMember } from "./identity.js";

/**
 * @param {object} c - Hono context
 * @param {string|null|undefined} worldId
 * @param {string|null|undefined} unitId
 * @returns {Promise<{member: object} | {error: Response}>}
 */
export async function requireWorldCollaborator(c, worldId, unitId) {
  const email = c.get("gmEmail");
  const member = await resolveMyTeamMember(c.env, email);
  if (!member) {
    return {
      error: c.json(
        { error: "No team member profile is linked to this email yet — ask an admin to link one before you can build world content." },
        403,
      ),
    };
  }

  if (!worldId && !unitId) {
    return {
      error: c.json(
        { error: "This document has no world or unit set — ask an admin to assign one in Sanity Studio before it can be edited here." },
        403,
      ),
    };
  }

  const [world, unit] = await Promise.all([
    worldId ? query(c.env, `*[_id == $id][0]{ "dms": dms[]._ref }`, { id: worldId }) : null,
    unitId ? query(c.env, `*[_id == $id][0]{ "dmOwner": dmOwner._ref, "world": world._ref }`, { id: unitId }) : null,
  ]);

  const inWorldDms = Array.isArray(world?.dms) && world.dms.includes(member._id);
  const ownsUnit = !!unit && unit.dmOwner === member._id;
  // If only a unit was given (no world on the target doc itself), its
  // own parent world's dms list still counts — a world collaborator can
  // edit any unit's content within their world, not just units they
  // personally own.
  const inParentWorldDms = !!unit?.world
    ? (await query(c.env, `*[_id == $id][0]{ "dms": dms[]._ref }`, { id: unit.world }))?.dms?.includes(member._id)
    : false;

  if (!inWorldDms && !ownsUnit && !inParentWorldDms) {
    return {
      error: c.json(
        { error: "Forbidden — you are not a collaborator on this world or the owner of this world unit." },
        403,
      ),
    };
  }

  return { member };
}
