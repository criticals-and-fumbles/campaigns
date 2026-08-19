/**
 * One-off seed: creates the 6 genreTheme documents from genre-themes.json.
 * Idempotent — skips any theme whose _id already exists, so it's safe to
 * re-run. Same dry-run-first pattern as the main criticalsandfumbles.com
 * site's sanity/migrations/*.ts scripts (see that repo's CLAUDE.md /
 * docs/migrations.md) — plain fetch against the Sanity HTTP API, no
 * @sanity/client dependency, matching src/lib/sanity.js's approach.
 *
 * Usage:
 *   npm run seed:dry     # dry run — logs what would be created
 *   npm run seed         # requires DRY_RUN=false in .env, or:
 *   DRY_RUN=false node --env-file=.env seed/seed.js
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const themes = JSON.parse(readFileSync(join(__dirname, "genre-themes.json"), "utf-8"));

const { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION, SANITY_WRITE_TOKEN } = process.env;

function apiBase() {
  return `https://${SANITY_PROJECT_ID}.api.sanity.io/${SANITY_API_VERSION}`;
}

async function sanityFetch(path, init = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SANITY_WRITE_TOKEN}`, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Sanity API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function seedThemes(dryRun) {
  if (!SANITY_PROJECT_ID || !SANITY_WRITE_TOKEN) {
    console.log("[SKIP] SANITY_PROJECT_ID / SANITY_WRITE_TOKEN not set — copy .env.example to .env and fill it in first.");
    return;
  }

  const existingQuery = encodeURIComponent(`*[_type == "genreTheme"]._id`);
  const { result: existingIds } = await sanityFetch(`/data/query/${SANITY_DATASET}?query=${existingQuery}`);
  const existing = new Set(existingIds);

  console.log(`Found ${existing.size} existing genreTheme document(s)`);
  console.log(dryRun ? "--- DRY RUN — no changes written ---" : "--- LIVE RUN — writing changes to Sanity ---");

  for (const theme of themes) {
    if (existing.has(theme._id)) {
      console.log(`[SKIP] "${theme._id}" already exists`);
      continue;
    }
    console.log(`${dryRun ? "[DRY]" : "[CREATE]"} ${theme._id} (genre: ${theme.genre}${theme.campaignOverride ? ", override" : ""})`);
    if (!dryRun) {
      await sanityFetch(`/data/mutate/${SANITY_DATASET}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutations: [{ createIfNotExists: theme }] }),
      });
    }
  }
  console.log("--- Done ---");
}

const isDryRun = process.env.DRY_RUN !== "false";
seedThemes(isDryRun);
