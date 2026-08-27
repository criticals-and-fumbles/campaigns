import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { renderConsolePage } from "../templates/console.js";
import {
  DOSSIER_XML_TEMPLATE,
  OBJECTIVES_CSV_TEMPLATE,
  WIKI_JSON_TEMPLATE,
  WIKI_IMPORT_PROMPT,
} from "../lib/import-templates.js";
import { blocksToMarkdown } from "../lib/portable-text.js";
import { resolveMyTeamMember, hashEmail } from "../lib/identity.js";

const app = new Hono();

// Both scoped to the requesting DM's own campaigns (ownerEmailHash ==
// hash of gmEmail) — see CLAUDE.md § ownership. Dossiers are scoped via
// their campaign reference since dossiers carry no owner field of their
// own. Full editable field set — the console's Edit Campaign panel
// needs every field it can PATCH, not just what the read-only table
// displays.
const MY_CAMPAIGNS_QUERY = `*[_type == "campaign" && ownerEmailHash == $hash] | order(title asc){
  _id, title, slug, genre, system, status, gmNames, hook, motto, signOff,
  visible, heroImage, "theme": theme._ref
}`;

// Same reasoning — the single dossier editor edits every schema field
// (see schema/dossier.js), so it needs every field fetched up front.
const MY_DOSSIERS_QUERY = `*[_type == "dossier" && campaign->ownerEmailHash == $hash] | order(_createdAt desc){
  _id, code, title, classification, distribution, sessionLabel, location,
  overview, heroImage, quickFacts, locationFacts, statTiles,
  threatAssessment, objectives, log,
  "campaignId": campaign._ref, "campaignTitle": campaign->title
}`;

// Genre themes are shared reference data, not owned by any one DM — every
// DM picks from the same list when creating a campaign.
const GENRE_THEMES_QUERY = `*[_type == "genreTheme"] | order(genre asc){ _id, genre, campaignOverride }`;

// ---- Wiki manual builder data (unscoped — shared content, any console
// GM may edit any of it, see lib/wiki-audit.js) ----
const WORLDS_QUERY = `*[_type == "world"] | order(name asc){ _id, name }`;
const TEAM_MEMBERS_QUERY = `*[_type == "teamMember"] | order(handle asc){ _id, handle }`;

const WORLD_UNITS_QUERY = `*[_type == "worldUnit"] | order(name asc){
  _id, name, overview, developmentStatus, colourAccent, pageFooterCTA, mapImageUrl,
  consoleEditedByEmail, consoleEditedAt,
  "world": world._ref, "dmOwner": dmOwner._ref
}`;

const FACTIONS_QUERY = `*[_type == "faction"] | order(name asc){
  _id, name, factionType, description, dmNotes,
  consoleEditedByEmail, consoleEditedAt,
  "world": world._ref, "unit": unit._ref, "members": members[]._ref
}`;

const KEY_FIGURES_QUERY = `*[_type == "keyFigure"] | order(name asc){
  _id, name, alsoKnownAs, status, role, threatLevel, description,
  hasStatBlock, statBlock, dmNotes,
  consoleEditedByEmail, consoleEditedAt,
  "world": world._ref, "unit": unit._ref, "faction": faction._ref
}`;

const MAGIC_ITEMS_QUERY = `*[_type == "magicItem"] | order(name asc){
  _id, name, itemType, rarity, lore, hasMechanics, mechanics, dmNotes,
  consoleEditedByEmail, consoleEditedAt,
  "world": world._ref, "unit": unit._ref,
  "currentHolder": currentHolder._ref, "foundAt": foundAt._ref
}`;

const NOTABLE_PLACES_QUERY = `*[_type == "notablePlace"] | order(name asc){
  _id, name, placeType, dangerLevel, description, dmNotes,
  consoleEditedByEmail, consoleEditedAt,
  "world": world._ref, "unit": unit._ref,
  "keyFigures": keyFigures[]._ref, "items": items[]._ref
}`;

const LORE_ENTRIES_QUERY = `*[_type == "loreEntry"] | order(title asc){
  _id, title, alsoKnownAs, category, summary, body, canonStatus,
  firstAppeared, tags,
  consoleEditedByEmail, consoleEditedAt,
  "world": world._ref, "unit": unit._ref,
  "relatedEntries": relatedEntries[]._ref, "submittedBy": submittedBy._ref
}`;

// Portable Text fields converted to plain markdown server-side so the
// manual builder's <textarea>s can show/re-save them as text — see
// lib/portable-text.js. Mutates each doc in place for brevity.
function convertBlocksToMarkdown(docs, fields) {
  for (const doc of docs) {
    for (const field of fields) {
      if (doc[field]) doc[field] = blocksToMarkdown(doc[field]);
    }
  }
  return docs;
}

const MY_ARTICLES_QUERY = `*[_type == "article" && author._ref == $authorId] | order(_createdAt desc){
  _id, title, slug, excerpt, category, tags, coverImage, body, status, publishedAt, readTimeMinutes,
  "worlds": worlds[]._ref
}`;

app.get("/", async (c) => {
  const email = c.get("gmEmail");
  const hash = await hashEmail(c.env, email);
  const [
    campaigns,
    dossiers,
    genreThemes,
    worlds,
    teamMembers,
    worldUnits,
    factions,
    keyFigures,
    magicItems,
    notablePlaces,
    loreEntries,
    myTeamMember,
  ] = await Promise.all([
    query(c.env, MY_CAMPAIGNS_QUERY, { hash }),
    query(c.env, MY_DOSSIERS_QUERY, { hash }),
    query(c.env, GENRE_THEMES_QUERY),
    query(c.env, WORLDS_QUERY),
    query(c.env, TEAM_MEMBERS_QUERY),
    query(c.env, WORLD_UNITS_QUERY),
    query(c.env, FACTIONS_QUERY),
    query(c.env, KEY_FIGURES_QUERY),
    query(c.env, MAGIC_ITEMS_QUERY),
    query(c.env, NOTABLE_PLACES_QUERY),
    query(c.env, LORE_ENTRIES_QUERY),
    // Not every DM is linked to a teamMember doc yet (see lib/identity.js)
    // — the console has to render fine either way, so this resolves to
    // null rather than throwing, and myArticles is fetched only if it did.
    resolveMyTeamMember(c.env, email),
  ]);

  const myArticles = myTeamMember
    ? await query(c.env, MY_ARTICLES_QUERY, { authorId: myTeamMember._id })
    : [];

  convertBlocksToMarkdown(worldUnits, ["overview", "pageFooterCTA"]);
  convertBlocksToMarkdown(factions, ["description", "dmNotes"]);
  convertBlocksToMarkdown(keyFigures, ["description", "dmNotes"]);
  convertBlocksToMarkdown(magicItems, ["lore", "dmNotes"]);
  convertBlocksToMarkdown(notablePlaces, ["description", "dmNotes"]);
  convertBlocksToMarkdown(loreEntries, ["body"]);
  convertBlocksToMarkdown(myArticles, ["body"]);

  const html = renderConsolePage({
    campaigns,
    dossiers,
    genreThemes,
    worlds,
    teamMembers,
    worldUnits,
    factions,
    keyFigures,
    magicItems,
    notablePlaces,
    loreEntries,
    myTeamMember,
    myArticles,
    gmEmail: email,
    sanityProjectId: c.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    sanityDataset: c.env.NEXT_PUBLIC_SANITY_DATASET,
  });
  return c.html(html);
});

// Downloadable starter templates for the Bulk Import buttons — content
// lives in lib/import-templates.js so it stays next to (and gets tested
// against) the parsers it has to match. Behind Access same as the rest
// of /console — not sensitive, just consistent with the surrounding
// routes rather than carving out a public exception for two files.
app.get("/templates/dossiers.xml", (c) =>
  c.body(DOSSIER_XML_TEMPLATE, 200, {
    "content-type": "application/xml",
    "content-disposition": 'attachment; filename="dossier-import-template.xml"',
  }),
);

app.get("/templates/objectives.csv", (c) =>
  c.body(OBJECTIVES_CSV_TEMPLATE, 200, {
    "content-type": "text/csv",
    "content-disposition": 'attachment; filename="objectives-import-template.csv"',
  }),
);

app.get("/templates/wiki-import.json", (c) =>
  c.body(WIKI_JSON_TEMPLATE, 200, {
    "content-type": "application/json",
    "content-disposition": 'attachment; filename="wiki-import-template.json"',
  }),
);

// Plain text, not a download — the console's "Copy AI Prompt" button reads
// this via fetch() and writes it to the clipboard directly.
app.get("/templates/wiki-import-prompt.txt", (c) =>
  c.body(WIKI_IMPORT_PROMPT, 200, { "content-type": "text/plain; charset=utf-8" }),
);

export default app;
