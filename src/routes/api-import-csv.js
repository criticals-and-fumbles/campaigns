import { Hono } from "hono";
import { query, mutate } from "../lib/sanity.js";
import { parseObjectivesCsv } from "../lib/csv.js";

const app = new Hono();

// POST /api/import/csv?collection=objectives — bulk-patches the objectives
// collection back in from an edited CSV. Each dossier's whole objectives
// array is replaced with whatever rows the sheet has for it (bulk
// spreadsheet edit semantics, not a per-row merge — see src/lib/csv.js).
app.post("/", async (c) => {
  const collection = c.req.query("collection");
  if (collection !== "objectives") {
    return c.json({ error: `Unsupported collection "${collection}" — only "objectives" is implemented` }, 400);
  }

  const form = await c.req.formData();
  const file = form.get("file");
  if (!file) return c.json({ error: "No CSV file provided" }, 400);

  const text = await file.text();
  const byDossierCode = parseObjectivesCsv(text);

  // Scoped to the caller's own dossiers — code isn't globally unique
  // across campaigns/DMs, so without this an ambiguous code could patch
  // another DM's dossier.
  const dossiers = await query(
    c.env,
    `*[_type == "dossier" && code in $codes && campaign->ownerEmail == $email]{ _id, code }`,
    { codes: [...byDossierCode.keys()], email: c.get("gmEmail") },
  );
  const idByCode = new Map(dossiers.map((d) => [d.code, d._id]));

  const mutations = [];
  const notFound = [];
  for (const [code, objectives] of byDossierCode) {
    const id = idByCode.get(code);
    if (!id) {
      notFound.push(code);
      continue;
    }
    mutations.push({
      patch: {
        id,
        set: {
          objectives,
          lastEditedBy: c.get("gmEmail"),
          lastEditedAt: new Date().toISOString(),
        },
      },
    });
  }

  let result = null;
  if (mutations.length > 0) {
    try {
      result = await mutate(c.env, mutations, crypto.randomUUID());
    } catch (err) {
      return c.json({ error: `Sanity transaction failed: ${err.message}` }, 502);
    }
  }

  return c.json({
    ok: true,
    updatedDossiers: mutations.length,
    notFoundCodes: notFound,
    result,
  });
});

export default app;
