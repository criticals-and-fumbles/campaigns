import { Hono } from "hono";
import { configureSanityImage } from "./lib/sanity-image.js";
import dossierRoutes from "./routes/dossier.jsx";

// Console (GM editing UI + every /api/* mutation/upload/import route)
// split out to its own Worker/repo, 2026-09-15 — see
// cnf-website/apps/console and that Worker's own worker.js doc comment.
// This Worker is now public-read-only: dossier/campaign-session pages,
// no auth, no writes. The directory listing that used to live at "/"
// moved to cnf-website's own app/(site)/campaigns/page.tsx even earlier
// the same day — see dossier.jsx's "/" handler, now just a redirect.
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

app.route("/", dossierRoutes);

// Catches anything a route didn't handle itself (e.g. a Sanity API call
// throwing because a required env var is missing/misnamed — the exact
// failure mode that first surfaced this gap) so a misconfiguration shows
// up as a clear message instead of Cloudflare's raw crash page. Route
// handlers should still catch and report *expected* failure modes
// themselves — this is the backstop for everything else.
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

export default app;
