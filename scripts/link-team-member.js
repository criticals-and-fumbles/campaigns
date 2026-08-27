/**
 * One-off admin script: links a DM's Cloudflare Access login email to a
 * specific teamMember document, so they can edit their own bio and
 * author articles through the console (see src/lib/identity.js).
 *
 * Deliberately NOT a console/API feature — this is the one place a real
 * email address is ever typed, and it never leaves this local run. The
 * script computes HMAC-SHA256(DM_IDENTITY_HMAC_SECRET, email) and
 * PATCHes only that hash onto the document; the plain email is never
 * sent to Sanity, logged, or written anywhere.
 *
 * Usage:
 *   node --env-file=.env scripts/link-team-member.js <email> <teamMemberId>
 *
 * Example:
 *   node --env-file=.env scripts/link-team-member.js jane@example.com teamMember.jane-dm
 *
 * Find a teamMember's _id via Sanity Vision or:
 *   node --env-file=.env scripts/link-team-member.js --list
 */
const {
  NEXT_PUBLIC_SANITY_PROJECT_ID,
  NEXT_PUBLIC_SANITY_DATASET,
  NEXT_PUBLIC_SANITY_API_VERSION,
  SANITY_API_READ_TOKEN,
  SANITY_API_WRITE_TOKEN,
  DM_IDENTITY_HMAC_SECRET,
} = process.env;

function apiBase() {
  return `https://${NEXT_PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/v${NEXT_PUBLIC_SANITY_API_VERSION}`;
}

async function hashEmail(email) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(DM_IDENTITY_HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(email.trim().toLowerCase()),
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function listTeamMembers() {
  const qs = new URLSearchParams({
    query: `*[_type == "teamMember"] | order(handle asc){ _id, handle, realName }`,
  });
  const res = await fetch(`${apiBase()}/data/query/${NEXT_PUBLIC_SANITY_DATASET}?${qs}`, {
    headers: { Authorization: `Bearer ${SANITY_API_READ_TOKEN}` },
  });
  const { result } = await res.json();
  for (const m of result) console.log(`${m._id}\t${m.handle}${m.realName ? ` (${m.realName})` : ""}`);
}

async function main() {
  if (!DM_IDENTITY_HMAC_SECRET) {
    console.error("DM_IDENTITY_HMAC_SECRET is not set in .env — required to compute the hash.");
    process.exit(1);
  }

  const [email, teamMemberId] = process.argv.slice(2);

  if (email === "--list") return listTeamMembers();

  if (!email || !teamMemberId) {
    console.error("Usage: node --env-file=.env scripts/link-team-member.js <email> <teamMemberId>");
    console.error("       node --env-file=.env scripts/link-team-member.js --list");
    process.exit(1);
  }

  const hash = await hashEmail(email);

  const res = await fetch(`${apiBase()}/data/mutate/${NEXT_PUBLIC_SANITY_DATASET}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SANITY_API_WRITE_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mutations: [{ patch: { id: teamMemberId, set: { ownerEmailHash: hash } } }],
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("Failed:", body);
    process.exit(1);
  }
  console.log(`Linked ${teamMemberId} — hash set, plain email was never sent to Sanity.`);
}

main();
