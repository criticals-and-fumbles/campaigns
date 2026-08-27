/**
 * Resolves a Cloudflare Access-authenticated email to "their own"
 * teamMember document — without ever storing or querying by the plain
 * email itself. Both cnf-website and campaigns are PUBLIC repos, and the
 * shared Sanity dataset is publicly readable with no auth at all (see
 * teamMember schema's ownerEmailHash field description) — so the link
 * between a DM's login and their public bio can't be a plain email
 * field, or anyone can scrape it straight off the dataset.
 *
 * Instead: HMAC-SHA256(secret, normalized email) → ownerEmailHash. The
 * secret (env.DM_IDENTITY_HMAC_SECRET) lives only as a Worker secret —
 * never in either repo, never in the dataset. Without that secret, the
 * hash can't be reversed or even confirmed against a guessed email, so
 * the public dataset carries no recoverable trace of anyone's address.
 *
 * Linking a real DM's email to their document is a one-off admin action
 * — see scripts/link-team-member.js — not something this app's console
 * ever writes itself.
 */

import { query } from "./sanity.js";

const MY_TEAM_MEMBER_QUERY = `*[_type == "teamMember" && ownerEmailHash == $hash][0]{
  _id, handle, realName, dndClass, race, alignment, stats, backstory,
  signatureMove, socialLinks, avatar
}`;

/** Same normalization on both the write side (scripts/link-team-member.js)
 * and this read side, or a real match silently fails to resolve. */
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function hashEmail(env, email) {
  if (!env.DM_IDENTITY_HMAC_SECRET) {
    throw new Error("DM_IDENTITY_HMAC_SECRET is not configured");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.DM_IDENTITY_HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(normalizeEmail(email)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Returns the caller's own teamMember doc (full self-editable field set),
 * or null if this email hasn't been linked to one yet. */
export async function resolveMyTeamMember(env, email) {
  const hash = await hashEmail(env, email);
  return query(env, MY_TEAM_MEMBER_QUERY, { hash });
}
