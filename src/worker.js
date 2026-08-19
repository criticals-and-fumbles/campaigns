import { Hono } from "hono";
import { requireAccessIdentity } from "./lib/auth.js";
import { configureSanityImage } from "./lib/sanity-image.js";
import dossierRoutes from "./routes/dossier.js";
import consoleRoutes from "./routes/console.js";
import apiDossierRoutes from "./routes/api-dossier.js";
import apiUploadRoutes from "./routes/api-upload.js";
import apiExportXmlRoutes from "./routes/api-export-xml.js";
import apiImportXmlRoutes from "./routes/api-import-xml.js";
import apiExportCsvRoutes from "./routes/api-export-csv.js";
import apiImportCsvRoutes from "./routes/api-import-csv.js";

const app = new Hono();

// Binds project ID/dataset once per request so templates can build Sanity
// CDN image URLs without threading env through every render call.
app.use("*", async (c, next) => {
  configureSanityImage({
    projectId: c.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: c.env.NEXT_PUBLIC_SANITY_DATASET,
  });
  await next();
});

// Every /console* and /api/* route must sit behind Cloudflare Access —
// this Worker implements no login/session system of its own, see
// src/lib/auth.js and CLAUDE.md.
app.use("/console/*", requireAccessIdentity);
app.use("/console", requireAccessIdentity);
app.use("/api/*", requireAccessIdentity);

app.route("/console", consoleRoutes);
app.route("/api/dossier", apiDossierRoutes);
app.route("/api/upload", apiUploadRoutes);
app.route("/api/export.xml", apiExportXmlRoutes);
app.route("/api/import", apiImportXmlRoutes);
app.route("/api/export.csv", apiExportCsvRoutes);
app.route("/api/import/csv", apiImportCsvRoutes);

// Public dossier/campaign routes last — most permissive matcher.
app.route("/", dossierRoutes);

// Catches anything a route didn't handle itself (e.g. a Sanity API call
// throwing because a required env var is missing/misnamed — the exact
// failure mode that first surfaced this gap) so a misconfiguration shows
// up as a clear message instead of Cloudflare's raw crash page. Route
// handlers should still catch and report *expected* failure modes
// themselves (see api-upload.js's 413, api-dossier.js's 400s) — this is
// the backstop for everything else.
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

export default app;
