/**
 * Cloudflare Worker — Sanity proxy for the campaign dossier admin console.
 *
 * Purpose: lets GMs update Sanity content and upload media WITHOUT touching
 * Sanity Studio. The browser (admin-console-concept.html, wired up for real)
 * talks only to this Worker; the Worker holds the Sanity write token as a
 * secret and is the only thing that ever calls Sanity's API directly.
 *
 * Auth: expects Cloudflare Access in front of this Worker's route, which
 * injects a verified `Cf-Access-Authenticated-User-Email` header on every
 * request. No separate login system needed — see the write-up in chat for
 * how to configure Access (free up to 50 users).
 *
 * Required secrets (wrangler secret put <NAME>):
 *   SANITY_PROJECT_ID
 *   SANITY_DATASET        e.g. "production"
 *   SANITY_API_VERSION    e.g. "2024-06-24"
 *   SANITY_WRITE_TOKEN    a token with Editor permissions, created in
 *                          sanity.io/manage — never expose this to the browser
 *
 * Routes:
 *   PATCH /api/dossier/:id          body: { field: string, value: any }
 *   POST  /api/dossier               body: full new dossier document
 *   POST  /api/upload                multipart/form-data, field "file"
 *   GET   /api/export.xml            full dossier export
 *   POST  /api/import                multipart/form-data, field "file" (.xml)
 *
 * Notes:
 *   - Image/graphic uploads are hard-capped at 500KB here (defense in depth —
 *     the browser should already downscale/recompress before sending).
 *   - Sanity mutations are field-level PATCHes wherever possible, which is
 *     what lets two GMs edit different fields of the same document at the
 *     same time without clobbering each other.
 */

const MAX_ASSET_BYTES = 500 * 1024; // 500KB hard cap on graphics

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const gmEmail = request.headers.get('Cf-Access-Authenticated-User-Email');

    if (!gmEmail) {
      return json({ error: 'Unauthenticated — this route must sit behind Cloudflare Access.' }, 401);
    }

    try {
      if (url.pathname.startsWith('/api/dossier/') && request.method === 'PATCH') {
        return await patchDossierField(request, env, url);
      }
      if (url.pathname === '/api/dossier' && request.method === 'POST') {
        return await createDossier(request, env);
      }
      if (url.pathname === '/api/upload' && request.method === 'POST') {
        return await uploadAsset(request, env);
      }
      if (url.pathname === '/api/export.xml' && request.method === 'GET') {
        return await exportXml(env);
      }
      if (url.pathname === '/api/import' && request.method === 'POST') {
        return await importXml(request, env);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message || 'Internal error' }, 500);
    }
  },
};

// ---------- helpers ----------

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sanityApiBase(env) {
  return `https://${env.SANITY_PROJECT_ID}.api.sanity.io/${env.SANITY_API_VERSION}`;
}

async function sanityFetch(env, path, init = {}) {
  const res = await fetch(`${sanityApiBase(env)}${path}`, {
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

// ---------- field-level patch (the core of "inline editing") ----------

async function patchDossierField(request, env, url) {
  const id = decodeURIComponent(url.pathname.split('/').pop());
  const { field, value, ifRevisionId } = await request.json();
  if (!field) return json({ error: 'field is required' }, 400);

  const patch = {
    id,
    set: { [field]: value },
  };
  if (ifRevisionId) patch.ifRevisionID = ifRevisionId; // optimistic-concurrency guard

  const result = await sanityFetch(env, `/data/mutate/${env.SANITY_DATASET}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mutations: [{ patch }] }),
  });

  return json({ ok: true, result });
}

async function createDossier(request, env) {
  const doc = await request.json();
  doc._type = doc._type || 'dossier';
  doc._id = doc._id || `dossier.${crypto.randomUUID()}`;

  const result = await sanityFetch(env, `/data/mutate/${env.SANITY_DATASET}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mutations: [{ createOrReplace: doc }] }),
  });

  return json({ ok: true, id: doc._id, result });
}

// ---------- asset upload (images/files land in Sanity's asset pipeline) ----------

async function uploadAsset(request, env) {
  const form = await request.formData();
  const file = form.get('file');
  const kind = (form.get('kind') || 'image'); // "image" | "file"

  if (!file) return json({ error: 'No file provided' }, 400);

  const bytes = await file.arrayBuffer();

  if (kind === 'image' && bytes.byteLength > MAX_ASSET_BYTES) {
    return json({
      error: `Image exceeds 500KB limit (${Math.round(bytes.byteLength / 1024)}KB). ` +
             `Downscale/recompress before uploading — the console's picker should do this automatically.`,
    }, 413);
  }

  const endpoint = kind === 'image' ? 'images' : 'files';
  const filename = encodeURIComponent(file.name || 'upload');

  const res = await fetch(
    `${sanityApiBase(env)}/${endpoint}/${env.SANITY_DATASET}?filename=${filename}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SANITY_WRITE_TOKEN}`,
        'content-type': file.type || 'application/octet-stream',
      },
      body: bytes,
    }
  );
  if (!res.ok) {
    const body = await res.text();
    return json({ error: `Sanity asset upload failed: ${body}` }, 502);
  }
  const asset = await res.json();

  // Caller (the console) then PATCHes the relevant dossier field with:
  // { _type: kind === 'image' ? 'image' : 'file', asset: { _type: 'reference', _ref: asset.document._id } }
  return json({ ok: true, asset: asset.document });
}

// ---------- XML export ----------

async function exportXml(env) {
  const query = encodeURIComponent(`*[_type == "dossier"]{
    _id, code, title, location, overview,
    "threats": threatAssessment[]{label, level},
    "objectives": objectives[]{priority, status, title},
    "log": log[]{ts, entry}
  }`);
  const data = await sanityFetch(env, `/data/query/${env.SANITY_DATASET}?query=${query}`, { method: 'GET' });

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<dossiers>\n';
  for (const d of data.result) {
    xml += `  <dossier id="${esc(d.code || d._id)}">\n`;
    xml += `    <meta><title>${esc(d.title)}</title><location>${esc(d.location)}</location></meta>\n`;
    xml += `    <overview><![CDATA[${d.overview || ''}]]></overview>\n`;
    xml += `    <threatAssessment>\n`;
    for (const t of d.threats || []) xml += `      <threat label="${esc(t.label)}" level="${esc(t.level)}"/>\n`;
    xml += `    </threatAssessment>\n    <objectives>\n`;
    for (const o of d.objectives || []) {
      xml += `      <objective priority="${esc(o.priority)}" status="${esc(o.status)}">${esc(o.title)}</objective>\n`;
    }
    xml += `    </objectives>\n    <log>\n`;
    for (const l of d.log || []) xml += `      <entry ts="${esc(l.ts)}">${esc(l.entry)}</entry>\n`;
    xml += `    </log>\n  </dossier>\n`;
  }
  xml += '</dossiers>';

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml',
      'content-disposition': 'attachment; filename="dossiers-export.xml"',
    },
  });
}

// ---------- XML import (bulk) ----------
// Uses fast-xml-parser (add via `npm install fast-xml-parser`, it's edge/Workers
// compatible — no DOM/browser APIs required, unlike DOMParser).

async function importXml(request, env) {
  const { XMLParser } = await import('fast-xml-parser');
  const form = await request.formData();
  const file = form.get('file');
  if (!file) return json({ error: 'No XML file provided' }, 400);

  const text = await file.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata' });
  const parsed = parser.parse(text);

  const dossierNodes = [].concat(parsed?.dossiers?.dossier || []);
  if (!dossierNodes.length) return json({ error: 'No <dossier> elements found' }, 400);

  const mutations = dossierNodes.map((n) => {
    const objectives = [].concat(n.objectives?.objective || []).map((o) => ({
      _type: 'objective',
      _key: crypto.randomUUID(),
      priority: o['@_priority'],
      status: o['@_status'],
      title: typeof o === 'object' ? o['#text'] ?? '' : o,
    }));
    const threats = [].concat(n.threatAssessment?.threat || []).map((t) => ({
      _type: 'threat',
      _key: crypto.randomUUID(),
      label: t['@_label'],
      level: t['@_level'],
    }));

    return {
      createOrReplace: {
        _id: `dossier.${n['@_id']}`,
        _type: 'dossier',
        code: n['@_id'],
        title: n.meta?.title,
        location: n.meta?.location,
        overview: n.overview?.__cdata ?? n.overview ?? '',
        threatAssessment: threats,
        objectives,
      },
    };
  });

  // Single atomic transaction for the whole batch.
  const result = await sanityFetch(env, `/data/mutate/${env.SANITY_DATASET}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mutations, transactionId: crypto.randomUUID() }),
  });

  return json({ ok: true, imported: mutations.length, result });
}