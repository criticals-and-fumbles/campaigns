/** Shared by every Wiki-type API route (api-world-unit.js, api-faction.js,
 * etc.) — same slugify logic api-campaign.js already has inline, factored
 * out here since six new route files need the identical function rather
 * than one. */
export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/** Deterministic doc id for a Wiki sub-document, scoped by its optional
 * world/unit reference ids (not their slugs — avoids an extra Sanity
 * read just to build an id) plus a slug of its own name/title. Same
 * name re-submitted under the same world+unit resolves to the same id,
 * so createOrReplace() updates it in place instead of duplicating it. */
export function wikiDocId(type, worldId, unitId, name) {
  const scope = `${worldId || "global"}.${unitId || "nounit"}`;
  return `${type}.${scope}.${slugify(name)}`.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200);
}
