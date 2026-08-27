/**
 * Shared audit-trail stamping for the six Wiki manual-builder routes
 * (worldUnit, faction, keyFigure, magicItem, loreEntry, notablePlace).
 *
 * These routes are now access-controlled (see lib/world-access.js) —
 * only a world's collaborators (world.dms) or a unit's owner
 * (worldUnit.dmOwner) may create/edit. Before lib/identity.js existed
 * there was no way to resolve a Cf-Access email to a teamMember
 * document at all, so consoleEditedByEmail/consoleEditedAt were the
 * only record of who touched a document — still stamped for that raw
 * audit trail. lastEditedBy (reference -> teamMember) can now also be
 * set correctly, since the caller's teamMemberId is already resolved by
 * the access check that runs before this. Both consoleEdited* fields
 * are excluded from every public-facing GROQ query in cnf-website
 * (verified against sanity/lib/queries.ts) — never add them to a
 * public projection.
 */
export const WIKI_SERVER_MANAGED_FIELDS = ["consoleEditedByEmail", "consoleEditedAt", "lastEditedBy"];

export function rejectServerManagedField(field) {
  return WIKI_SERVER_MANAGED_FIELDS.includes(field);
}

/** Strips any client-supplied server-managed fields from a create body
 * and returns the audit stamp to merge in alongside it. teamMemberId is
 * the caller's own resolved id (from requireWorldCollaborator) — omit
 * only if truly unresolvable, which shouldn't happen for a request that
 * already passed the access check. */
export function stampAudit(gmEmail, teamMemberId) {
  return {
    consoleEditedByEmail: gmEmail,
    consoleEditedAt: new Date().toISOString(),
    ...(teamMemberId ? { lastEditedBy: { _type: "reference", _ref: teamMemberId } } : {}),
  };
}
