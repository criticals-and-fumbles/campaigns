/**
 * XML is the canonical full-fidelity dossier import/export format —
 * nested structure covering every dossier field except binary assets
 * (media references existing Sanity asset IDs; new uploads go through
 * POST /api/upload, not XML import — XML isn't a transport for raw
 * image/audio/video bytes).
 */
import { XMLParser } from "fast-xml-parser";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function factRowsToXml(tag, rows) {
  if (!rows?.length) return `    <${tag}></${tag}>\n`;
  let out = `    <${tag}>\n`;
  for (const r of rows) {
    out += `      <fact label="${esc(r.label)}" value="${esc(r.value)}"/>\n`;
  }
  out += `    </${tag}>\n`;
  return out;
}

export function dossierToXml(d) {
  let xml = `  <dossier id="${esc(d.code || d._id)}" campaignSlug="${esc(d.campaignSlug || "")}">\n`;
  xml += `    <meta>`;
  xml += `<title>${esc(d.title)}</title>`;
  xml += `<classification>${esc(d.classification)}</classification>`;
  xml += `<distribution>${esc(d.distribution)}</distribution>`;
  xml += `<sessionLabel>${esc(d.sessionLabel)}</sessionLabel>`;
  xml += `<location>${esc(d.location)}</location>`;
  xml += `</meta>\n`;
  xml += `    <overview><![CDATA[${d.overview || ""}]]></overview>\n`;
  xml += factRowsToXml("quickFacts", d.quickFacts);
  xml += factRowsToXml("locationFacts", d.locationFacts);

  xml += `    <statTiles>\n`;
  for (const t of d.statTiles || []) {
    xml += `      <tile value="${esc(t.value)}" label="${esc(t.label)}"/>\n`;
  }
  xml += `    </statTiles>\n`;

  xml += `    <threatAssessment>\n`;
  for (const m of d.threatAssessment || []) {
    xml += `      <meter label="${esc(m.label)}" level="${esc(m.level)}"/>\n`;
  }
  xml += `    </threatAssessment>\n`;

  xml += `    <objectives>\n`;
  for (const o of d.objectives || []) {
    xml += `      <objective priority="${esc(o.priority)}" status="${esc(o.status)}">`;
    xml += `<title>${esc(o.title)}</title><description>${esc(o.description)}</description>`;
    xml += `</objective>\n`;
  }
  xml += `    </objectives>\n`;

  xml += `    <media>\n`;
  for (const m of d.media || []) {
    const ref = m.image?.asset?._ref || m.file?.asset?._ref || "";
    xml += `      <item kind="${esc(m.kind)}" assetRef="${esc(ref)}" caption="${esc(m.caption)}"/>\n`;
  }
  xml += `    </media>\n`;

  xml += `    <log>\n`;
  for (const l of d.log || []) {
    xml += `      <entry ts="${esc(l.ts)}">${esc(l.entry)}</entry>\n`;
  }
  xml += `    </log>\n`;

  xml += `  </dossier>\n`;
  return xml;
}

export function dossiersToXmlDocument(dossiers) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<dossiers>\n';
  for (const d of dossiers) xml += dossierToXml(d);
  xml += "</dossiers>";
  return xml;
}

const asArray = (v) => (v === undefined ? [] : [].concat(v));

/**
 * Parses an exported (or hand-edited) XML document back into an array of
 * dossier-shaped mutation objects. Uses fast-xml-parser (Workers-
 * compatible — no DOMParser/browser APIs, unlike admin-console-
 * concept.html's client-side prototype, which used DOMParser since it ran
 * in a browser). Each `<dossier>` carries its parent campaign as a
 * `campaignSlug` attribute (added beyond the original reference
 * implementation's XML shape, which had no campaign concept at all) — the
 * caller (the import route) resolves that slug to a campaign `_id` before
 * writing, since `dossier.campaign` is a required Sanity reference and
 * can't be a bare string.
 */
export function parseDossiersXml(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    cdataPropName: "__cdata",
  });
  const parsed = parser.parse(xmlText);
  const nodes = asArray(parsed?.dossiers?.dossier);
  if (!nodes.length) throw new Error("No <dossier> elements found in XML");

  return nodes.map((n) => {
    const quickFacts = asArray(n.quickFacts?.fact).map((f) => ({
      _type: "factRow",
      _key: crypto.randomUUID(),
      label: f["@_label"],
      value: f["@_value"],
    }));
    const locationFacts = asArray(n.locationFacts?.fact).map((f) => ({
      _type: "factRow",
      _key: crypto.randomUUID(),
      label: f["@_label"],
      value: f["@_value"],
    }));
    const statTiles = asArray(n.statTiles?.tile).map((t) => ({
      _type: "statTile",
      _key: crypto.randomUUID(),
      value: t["@_value"],
      label: t["@_label"],
    }));
    const threatAssessment = asArray(n.threatAssessment?.meter).map((m) => ({
      _type: "meterRow",
      _key: crypto.randomUUID(),
      label: m["@_label"],
      level: m["@_level"],
    }));
    const objectives = asArray(n.objectives?.objective).map((o) => ({
      _type: "objective",
      _key: crypto.randomUUID(),
      priority: o["@_priority"],
      status: o["@_status"],
      title: o.title ?? "",
      description: o.description ?? "",
    }));
    const log = asArray(n.log?.entry).map((l) => ({
      _type: "logEntry",
      _key: crypto.randomUUID(),
      ts: l["@_ts"],
      entry: typeof l === "object" ? (l["#text"] ?? "") : l,
    }));
    // media intentionally NOT reconstructed from XML — assetRef alone
    // isn't enough to safely round-trip without risking a dangling
    // reference; media edits go through the console's upload flow.

    return {
      code: n["@_id"],
      campaignSlug: n["@_campaignSlug"] || "",
      title: n.meta?.title ?? "",
      classification: n.meta?.classification ?? "",
      distribution: n.meta?.distribution ?? "",
      sessionLabel: n.meta?.sessionLabel ?? "",
      location: n.meta?.location ?? "",
      overview: n.overview?.__cdata ?? n.overview ?? "",
      quickFacts,
      locationFacts,
      statTiles,
      threatAssessment,
      objectives,
      log,
    };
  });
}
