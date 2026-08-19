/**
 * CSV is a secondary, flattened view scoped to ONE repeating collection
 * across all dossiers at a time (e.g. every objective, for fast bulk
 * spreadsheet edits) — not a full-dossier format like XML. Only
 * "objectives" is implemented at scaffold time (the only collection the
 * reference concepts/admin-console-concept.html actually exercises); add another
 * `case` in both functions below if a second collection needs this
 * later, following the same shape.
 */

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** dossiers: array of { _id, code, objectives: [...] } (as returned by a GROQ query). */
export function objectivesToCsv(dossiers) {
  const rows = [["dossier_id", "priority", "status", "title", "description"]];
  for (const d of dossiers) {
    for (const o of d.objectives || []) {
      rows.push([d.code || d._id, o.priority, o.status, o.title, o.description]);
    }
  }
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

/** Parses one CSV line respecting quoted fields (handles embedded commas/quotes). */
function parseCsvLine(line) {
  const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
  return matches.map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
}

/**
 * Parses an objectives CSV back into per-dossier patch instructions.
 * Returns { byDossierCode: Map<code, objective[]> } — the caller (the
 * route handler) resolves each code to a document _id and issues a
 * `set: { objectives: [...] }` patch per dossier, replacing that
 * dossier's whole objectives array with what's in the sheet for it (this
 * is a full-collection replace per dossier, not a per-row merge — matches
 * "bulk spreadsheet edit" intent: the sheet is the new source of truth
 * for whichever dossiers appear in it).
 */
export function parseObjectivesCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name) => header.indexOf(name);

  const byDossierCode = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const dossierCode = cells[idx("dossier_id")];
    if (!dossierCode) continue;

    const obj = {
      _type: "objective",
      _key: crypto.randomUUID(),
      priority: cells[idx("priority")],
      status: cells[idx("status")],
      title: cells[idx("title")],
      description: idx("description") >= 0 ? cells[idx("description")] : undefined,
    };

    if (!byDossierCode.has(dossierCode)) byDossierCode.set(dossierCode, []);
    byDossierCode.get(dossierCode).push(obj);
  }
  return byDossierCode;
}
