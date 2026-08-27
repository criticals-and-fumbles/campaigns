/**
 * One-off backfill: computes ownerEmailHash for every existing campaign
 * from its own existing plaintext ownerEmail field — no need to know
 * DMs' emails separately, the plaintext value already on the document is
 * the source data. Same HMAC scheme/secret as teamMember.ownerEmailHash
 * (see lib/identity.js's hashEmail) — reused directly, not reimplemented,
 * so the two can never drift out of sync with each other (see the
 * session note on this: identical secret + identical normalization
 * always produces identical hashes for the same real email).
 *
 * SAFETY: only ever .set()s ownerEmailHash. The plaintext ownerEmail
 * field is never touched, unset, or removed by this script — it stays
 * exactly as-is as a legacy/transition value until every route is
 * confirmed working off the hash alone (already done, see
 * lib/world-access.js's sibling migration for the same "verify, don't
 * assume" discipline).
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-campaign-owner-hash.js            # dry run
 *   DRY_RUN=false node --env-file=.env scripts/backfill-campaign-owner-hash.js  # live
 */
import { query, mutate } from "../src/lib/sanity.js";
import { hashEmail } from "../src/lib/identity.js";

const env = {
  NEXT_PUBLIC_SANITY_PROJECT_ID: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  NEXT_PUBLIC_SANITY_DATASET: process.env.NEXT_PUBLIC_SANITY_DATASET,
  NEXT_PUBLIC_SANITY_API_VERSION: process.env.NEXT_PUBLIC_SANITY_API_VERSION,
  SANITY_API_READ_TOKEN: process.env.SANITY_API_READ_TOKEN,
  SANITY_API_WRITE_TOKEN: process.env.SANITY_API_WRITE_TOKEN,
  DM_IDENTITY_HMAC_SECRET: process.env.DM_IDENTITY_HMAC_SECRET,
};

async function run(dryRun) {
  const campaigns = await query(
    env,
    `*[_type == "campaign" && defined(ownerEmail)]{ _id, title, ownerEmail, ownerEmailHash }`,
  );

  console.log(`Found ${campaigns.length} campaigns with a plaintext ownerEmail`);
  console.log(dryRun ? "--- DRY RUN — no changes written ---" : "--- LIVE RUN — writing changes to Sanity ---");

  for (const cmp of campaigns) {
    if (cmp.ownerEmailHash) {
      console.log(`[SKIP] ${cmp.title} (${cmp._id}): ownerEmailHash already set`);
      continue;
    }
    const hash = await hashEmail(env, cmp.ownerEmail);
    console.log(`${dryRun ? "[DRY]" : "[PATCH]"} ${cmp.title} (${cmp._id}): ownerEmailHash -> ${hash.slice(0, 12)}...`);
    if (!dryRun) {
      await mutate(env, [{ patch: { id: cmp._id, set: { ownerEmailHash: hash } } }]);
    }
  }

  console.log("--- Done — ownerEmail (plaintext) untouched on every document above ---");
}

const isDryRun = process.env.DRY_RUN !== "false";
run(isDryRun);
