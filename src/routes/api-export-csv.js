import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { objectivesToCsv } from "../lib/csv.js";

const app = new Hono();

// GET /api/export.csv?collection=objectives — flattened CSV of one
// repeating collection across all dossiers. Only "objectives" is
// implemented at scaffold time — see src/lib/csv.js for how to extend.
app.get("/", async (c) => {
  const collection = c.req.query("collection");
  if (collection !== "objectives") {
    return c.json({ error: `Unsupported collection "${collection}" — only "objectives" is implemented` }, 400);
  }

  const dossiers = await query(
    c.env,
    `*[_type == "dossier" && campaign->ownerEmail == $email]{ _id, code, objectives }`,
    { email: c.get("gmEmail") },
  );
  const csv = objectivesToCsv(dossiers);

  return c.body(csv, 200, {
    "content-type": "text/csv",
    "content-disposition": 'attachment; filename="objectives-export.csv"',
  });
});

export default app;
