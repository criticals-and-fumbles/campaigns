/**
 * Sanity fetch/mutate helpers. This Worker talks to Sanity directly —
 * same project/dataset as the main criticalsandfumbles.com site (see
 * CLAUDE.md). Env var names deliberately match that site's convention
 * (NEXT_PUBLIC_SANITY_PROJECT_ID etc.) rather than inventing new ones,
 * per an explicit decision to keep settings aligned across both repos
 * since they share the same Sanity project and are meant to have their
 * documents/schema linked later.
 *
 * Two tokens, like the main site: SANITY_API_READ_TOKEN (Viewer role) for
 * every query, SANITY_API_WRITE_TOKEN (Editor role) only for mutations —
 * public dossier rendering never needs write access, so it doesn't get
 * that token's blast radius even though this Worker holds it for the
 * console's edits.
 */

function apiBase(env) {
  return `https://${env.NEXT_PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/${env.NEXT_PUBLIC_SANITY_API_VERSION}`;
}

async function request(env, path, token, init = {}) {
  const res = await fetch(`${apiBase(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sanity API ${res.status}: ${body}`);
  }
  return res.json();
}

/** Read-only GROQ query — uses SANITY_API_READ_TOKEN. */
export async function query(env, groq, params = {}) {
  const qs = new URLSearchParams({ query: groq });
  for (const [key, value] of Object.entries(params)) {
    qs.set(`$${key}`, JSON.stringify(value));
  }
  const data = await request(
    env,
    `/data/query/${env.NEXT_PUBLIC_SANITY_DATASET}?${qs.toString()}`,
    env.SANITY_API_READ_TOKEN,
    { method: "GET" },
  );
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
  return request(
    env,
    `/data/mutate/${env.NEXT_PUBLIC_SANITY_DATASET}`,
    env.SANITY_API_WRITE_TOKEN,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mutations, ...(transactionId ? { transactionId } : {}) }),
    },
  );
}

/** Uploads a raw file/image straight into Sanity's asset pipeline.
 * `kind` is "image" or "file" — Sanity has separate asset endpoints for
 * each. Returns the created asset document; the caller then PATCHes the
 * relevant dossier field with a reference to it. Always uses the write
 * token — asset creation is a mutation. */
export async function uploadAsset(env, bytes, contentType, filename, kind) {
  const endpoint = kind === "image" ? "images" : "files";
  const res = await fetch(
    `${apiBase(env)}/${endpoint}/${env.NEXT_PUBLIC_SANITY_DATASET}?filename=${encodeURIComponent(filename || "upload")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`,
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
