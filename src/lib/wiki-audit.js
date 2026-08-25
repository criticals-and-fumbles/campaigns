/**
 * Shared audit-trail stamping for the six Wiki manual-builder routes
 * (worldUnit, faction, keyFigure, magicItem, loreEntry, notablePlace).
 *
 * Unlike dossier/campaign, these routes have NO ownership scoping (any
 * Cloudflare-Access console GM may create/edit any of these — a
 * deliberate decision, since teamMember has no email field to check
 * world.dms/worldUnit.dmOwner against). consoleEditedByEmail/
 * consoleEditedAt are the only record of who touched a document and
 * when — real tracking without a rollback UI yet, per that decision.
 * Both fields are excluded from every public-facing GROQ query in
 * cnf-website (verified against sanity/lib/queries.ts) — never add them
 * to a public projection.
 *
 * lastEditedBy (reference -> teamMember) is a separate, pre-existing
 * schema field these routes deliberately never touch — there is no way
 * to resolve a Cf-Access email to a teamMember document, so it's left
 * alone rather than guessed at.
 */
export const WIKI_SERVER_MANAGED_FIELDS = ["consoleEditedByEmail", "consoleEditedAt", "lastEditedBy"];

export function rejectServerManagedField(field) {
  return WIKI_SERVER_MANAGED_FIELDS.includes(field);
}

/** Strips any client-supplied server-managed fields from a create body
 * and returns the audit stamp to merge in alongside it. */
export function stampAudit(gmEmail) {
  return {
    consoleEditedByEmail: gmEmail,
    consoleEditedAt: new Date().toISOString(),
  };
}
