/**
 * Sanity fetch/mutate helpers. This Worker is the ONLY thing that ever
 * talks to Sanity directly — SANITY_WRITE_TOKEN never reaches the browser.
 * Same project/dataset as the main criticalsandfumbles.com site.
 */

function apiBase(env) {
  return `https://${env.SANITY_PROJECT_ID}.api.sanity.io/${env.SANITY_API_VERSION}`;
}

async function request(env, path, init = {}) {
  const res = await fetch(`${apiBase(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.SANITY_WRITE_TOKEN}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sanity API ${res.status}: ${body}`);
  }
  return res.json();
}

/** Read-only GROQ query. Uses the same write-token-bearing client — this
 * Worker has no separate read-only token, since every route already sits
 * behind Cloudflare Access or is intentionally public read access to
 * published content only (dossiers/campaigns/themes have no private
 * fields). */
export async function query(env, groq, params = {}) {
  const qs = new URLSearchParams({ query: groq });
  for (const [key, value] of Object.entries(params)) {
    qs.set(`$${key}`, JSON.stringify(value));
  }
  const data = await request(env, `/data/query/${env.SANITY_DATASET}?${qs.toString()}`, {
    method: "GET",
  });
  return data.result;
}

/** Single-field PATCH — the core of inline editing. Two GMs editing
 * different fields of the same document don't clobber each other. */
export async function patchField(env, id, field, value, ifRevisionId) {
  const patch = { id, set: { [field]: value } };
  if (ifRevisionId) patch.ifRevisionID = ifRevisionId;
  return mutate(env, [{ patch }]);
}

export async function createOrReplace(env, doc) {
  return mutate(env, [{ createOrReplace: doc }]);
}

export async function mutate(env, mutations, transactionId) {
  return request(env, `/data/mutate/${env.SANITY_DATASET}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations, ...(transactionId ? { transactionId } : {}) }),
  });
}

/** Uploads a raw file/image straight into Sanity's asset pipeline.
 * `kind` is "image" or "file" — Sanity has separate asset endpoints for
 * each. Returns the created asset document; the caller then PATCHes the
 * relevant dossier field with a reference to it. */
export async function uploadAsset(env, bytes, contentType, filename, kind) {
  const endpoint = kind === "image" ? "images" : "files";
  const res = await fetch(
    `${apiBase(env)}/${endpoint}/${env.SANITY_DATASET}?filename=${encodeURIComponent(filename || "upload")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SANITY_WRITE_TOKEN}`,
        "content-type": contentType || "application/octet-stream",
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sanity asset upload failed (${res.status}): ${body}`);
  }
  const asset = await res.json();
  return asset.document;
}
