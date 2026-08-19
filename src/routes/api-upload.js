import { Hono } from "hono";
import { uploadAsset } from "../lib/sanity.js";

const MAX_IMAGE_BYTES = 500 * 1024; // 500KB — server-side hard cap, authoritative
// regardless of what the client already downscaled/recompressed to (defense in depth).

const app = new Hono();

app.post("/", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  const kind = form.get("kind") || "image";

  if (!file) return c.json({ error: "No file provided" }, 400);

  const bytes = await file.arrayBuffer();

  if (kind === "image" && bytes.byteLength > MAX_IMAGE_BYTES) {
    return c.json(
      {
        error: `Image exceeds 500KB limit (${Math.round(bytes.byteLength / 1024)}KB). Downscale/recompress before uploading — the console's picker should do this automatically.`,
      },
      413,
    );
  }

  try {
    const asset = await uploadAsset(c.env, bytes, file.type, file.name, kind);
    return c.json({ ok: true, asset });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
