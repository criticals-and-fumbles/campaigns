/**
 * Minimal markdown <-> Sanity Portable Text conversion. Deliberately
 * small (no markdown-parser dependency, per this repo's bundle-budget
 * discipline — see CLAUDE.md) and deliberately lossy in one direction:
 * markdownToBlocks() only supports paragraphs (blank-line separated) and
 * inline bold (**text**) and italic (*text*) — no headings, lists, links,
 * or nested marks.
 * That's the ceiling of what the manual builder's <textarea> fields and
 * the bulk Wiki JSON import ask an AI agent or a GM to produce; anything
 * richer should be added directly in Sanity Studio after import, same
 * scope line already drawn for images/statBlocks/mechanics (see
 * import-templates.js's WIKI_JSON_TEMPLATE "Not supported" note).
 *
 * blocksToMarkdown() is the inverse, used to prefill a <textarea> when
 * opening the edit panel for a document that already has real block
 * content (possibly richer than what markdownToBlocks() can produce,
 * e.g. edited in Studio) — best-effort, drops marks/styles it doesn't
 * recognize rather than throwing, so opening the edit panel never fails.
 */

function makeSpan(text, marks) {
  return { _type: "span", _key: crypto.randomUUID(), text, marks };
}

/** Splits inline **bold** / *italic* into spans. No nesting, no escaping. */
function parseInline(text) {
  const spans = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) spans.push(makeSpan(text.slice(last, m.index), []));
    if (m[2] !== undefined) spans.push(makeSpan(m[2], ["strong"]));
    else spans.push(makeSpan(m[3], ["em"]));
    last = re.lastIndex;
  }
  if (last < text.length) spans.push(makeSpan(text.slice(last), []));
  if (spans.length === 0) spans.push(makeSpan("", []));
  return spans;
}

/**
 * Plain markdown text -> Portable Text block array. Paragraphs are
 * separated by one-or-more blank lines. Returns undefined for
 * empty/whitespace-only input so callers can omit the field entirely
 * rather than writing an empty array.
 */
export function markdownToBlocks(markdown) {
  if (!markdown || !markdown.trim()) return undefined;
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((p) => ({
    _type: "block",
    _key: crypto.randomUUID(),
    style: "normal",
    markDefs: [],
    children: parseInline(p.replace(/\s*\n\s*/g, " ")),
  }));
}

/**
 * Portable Text block array -> plain markdown text, for prefilling an
 * edit form's <textarea>. Only handles "block" type entries with
 * "normal"/heading-ish styles as plain paragraphs and strong/em marks —
 * anything else (images, custom block types like calloutBlock, lists)
 * is skipped rather than guessed at, since re-saving the form would
 * otherwise silently drop content the textarea can't represent anyway.
 */
export function blocksToMarkdown(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  const paragraphs = [];
  for (const block of blocks) {
    if (block._type !== "block" || !Array.isArray(block.children)) continue;
    let text = "";
    for (const child of block.children) {
      if (child._type !== "span") continue;
      const marks = child.marks || [];
      let t = child.text || "";
      if (marks.includes("strong")) t = `**${t}**`;
      else if (marks.includes("em")) t = `*${t}*`;
      text += t;
    }
    if (text) paragraphs.push(text);
  }
  return paragraphs.join("\n\n");
}
