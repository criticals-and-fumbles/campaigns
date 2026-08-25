/**
 * Downloadable starter templates for the console's Bulk Import buttons —
 * matches the exact shapes src/lib/xml.js's parseDossiersXml() and
 * src/lib/csv.js's parseObjectivesCsv() expect. Kept here as string
 * constants (not physical files) since a Worker can't serve arbitrary
 * repo files at runtime; these ARE what gets downloaded, served by
 * src/routes/console.js.
 *
 * If either parser's expected shape ever changes, update the matching
 * template here in the same commit — nothing else keeps them in sync.
 *
 * WIKI_JSON_TEMPLATE below is template-only for now — there is no
 * src/lib/wiki-import.js parser yet, so nothing consumes this shape at
 * runtime. It's shipped ahead of the parser so the template/schema
 * design can be reviewed before the import route is built against it.
 * Whoever builds that parser should treat this file as the spec.
 */

export const DOSSIER_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Bulk dossier import template — Criticals & Fumbles Campaign Log

  Usage:
  - Duplicate the <dossier> block below for each session you're importing.
  - id            — becomes the dossier's code. Must be unique within its campaign.
  - campaignSlug  — must match an existing campaign of yours (the part of its
                    URL after the domain, e.g. "stonemount" for
                    campaigns.criticalsandfumbles.com/stonemount). A slug that
                    doesn't match one of YOUR campaigns fails that row, not the
                    whole import — see the console's import result message.
  - Every field below is optional except id and campaignSlug — delete
    elements you don't need, or leave them empty.
  - threatAssessment meter "level" should be one of: low, medium, high, very-high
    (the dossier page's meter bar only recognizes these four).
  - objective "priority" should be one of: primary, secondary, tertiary
  - objective "status" should be one of: open, done
  - Re-importing the same id + campaignSlug updates that dossier in place
    (createOrReplace) rather than creating a duplicate.
  - Media (images/audio/video) isn't part of this format — add those from
    the console's dossier editor after import, or directly in Sanity Studio.
-->
<dossiers>
  <dossier id="EXAMPLE-01" campaignSlug="your-campaign-slug">
    <meta><title>Example Session Title</title><classification>TOP SECRET</classification><distribution>PLAYER-FACING</distribution><sessionLabel>1</sessionLabel><location>The Steps</location></meta>
    <overview><![CDATA[What happened this session — the main recap players will read first.]]></overview>
    <quickFacts>
      <fact label="STATUS" value="Active"/>
      <fact label="LOOT" value="A rusted key of unknown origin"/>
    </quickFacts>
    <locationFacts>
      <fact label="REGION" value="Northern Reach"/>
    </locationFacts>
    <statTiles>
      <tile value="12" label="Party Morale"/>
    </statTiles>
    <threatAssessment>
      <meter label="Local Faction Tension" level="medium"/>
    </threatAssessment>
    <objectives>
      <objective priority="primary" status="open"><title>Find the missing courier</title><description>Last seen heading north along the old trade road.</description></objective>
    </objectives>
    <media>
    </media>
    <log>
      <entry ts="Day 1">Party arrived at the Steps and made contact with the local guard.</entry>
    </log>
  </dossier>
</dossiers>
`;

export const OBJECTIVES_CSV_TEMPLATE = `dossier_id,priority,status,title,description
EXAMPLE-01,primary,open,Find the missing courier,Last seen heading north along the old trade road.
EXAMPLE-01,secondary,done,Deliver the sealed letter,Handed off to the garrison captain.
`;

export const WIKI_JSON_TEMPLATE = JSON.stringify(
  {
    _instructions: [
      "Bulk Wiki import template — Criticals & Fumbles Wiki",
      "",
      "The WORLD this content goes into is chosen in the console UI when you",
      "upload this file (dropdown) — do not add a world field to any entry",
      "below. Worlds themselves can only be created in Sanity Studio",
      "(admin-only); this tool works within an existing world.",
      "",
      "worldUnit.name (required) says which unit WITHIN that world this",
      "import targets — every faction/keyFigure/magicItem/loreEntry/",
      "notablePlace below attaches to this one unit. If no unit with this",
      "exact name exists yet in the selected world, one is created (this is",
      "allowed without admin rights, unlike creating a whole world);",
      "if it already exists, it's updated in place.",
      "",
      "worldUnit.overview — anything that doesn't fit one of the six typed",
      "sections below goes here as plain text/markdown. If the unit already",
      "existed, this is APPENDED to its existing overview, not replaced; if",
      "the unit is being created fresh, it becomes the whole overview.",
      "  developmentStatus: one of draft | in-progress | established | canonical",
      "  colourAccent: hex color, e.g. #8B2E2E",
      "",
      "factions / keyFigures / magicItems / loreEntries / notablePlaces /",
      "sessionLogs — each is an array; leave an array empty ([]) or delete",
      "its key if you have nothing of that type. Duplicate the example",
      "object in an array for each entry you're adding.",
      "",
      "Cross-references between entries in THIS file: give an entry an",
      "\"id\" (any string you make up, must be unique within this file) and",
      "reference it elsewhere via that same string — e.g. a magicItem's",
      "currentHolder can be the \"id\" of a keyFigure defined in this same",
      "file. \"id\" is never saved — it only resolves links within this",
      "import.",
      "",
      "Cross-references to content that ALREADY EXISTS in the selected",
      "world unit: use the existing entry's exact name/title as a plain",
      "string instead of a local id (e.g. currentHolder: \"Elyra Voss\" if",
      "Elyra already exists there). If it can't be found, that one",
      "reference is left blank and reported after import — it does not",
      "fail the whole entry.",
      "",
      "Rich text fields (description/body/overview/etc.) are plain",
      "markdown text, not Sanity's block format — write normal paragraphs,",
      "blank line between paragraphs.",
      "",
      "Only \"name\"/\"title\" is required on any entry. Every other field is",
      "optional — omit fields you don't have content for rather than",
      "leaving them empty strings.",
      "",
      "Enum fields (reject/flag if not one of these exact values):",
      "  keyFigure.status: alive | dead | unknown | missing",
      "  keyFigure.threatLevel: friendly | neutral | cautious | dangerous | deadly",
      "  magicItem.rarity: common | uncommon | rare | very-rare | legendary | artifact",
      "  loreEntry.category: Location | Faction | NPC | History | Creature | Artefact | Magic | Pantheon | Culture",
      "  loreEntry.canonStatus: canon | homebrew | disputed | rumour | retconned | dm-eyes-only",
      "  notablePlace.dangerLevel: safe | low-risk | dangerous | deadly",
      "  sessionLog.tone: Epic | Comedic | Tragic | Tense | Investigative | Social | Combat-Heavy | Mixed",
      "",
      "Not supported by this import (add via Sanity Studio after, if needed):",
      "  keyFigure stat blocks, magicItem mechanics, images, DM notes,",
      "  session dm/players assignment.",
    ].join("\n"),
    worldUnit: {
      name: "The Docks District",
      overview: "Anything that doesn't fit the sections below — loose notes, background, half-formed ideas. Appended to the world unit's existing overview (or becomes the whole overview if this unit is being created fresh).",
      developmentStatus: "draft",
      colourAccent: "",
      pageFooterCTA: "",
    },
    factions: [
      {
        id: "faction-thorne-cabal",
        name: "The Thorne Cabal",
        factionType: "smuggling ring",
        description: "A loose network of smugglers operating out of the docks, nominally led by Elyra Voss.",
      },
    ],
    keyFigures: [
      {
        id: "npc-elyra",
        name: "Elyra Voss",
        alsoKnownAs: "The Red Gull",
        status: "alive",
        faction: "faction-thorne-cabal",
        role: "Smuggler captain",
        threatLevel: "cautious",
        description: "Runs the Thorne Cabal from the back room of the Rusted Anchor tavern.",
      },
    ],
    magicItems: [
      {
        id: "item-rusted-key",
        name: "The Rusted Key",
        itemType: "key",
        rarity: "uncommon",
        currentHolder: "npc-elyra",
        foundAt: "",
        lore: "Opens something in the old harbor vault — nobody currently alive knows what.",
      },
    ],
    loreEntries: [
      {
        title: "The Founding of the Docks",
        category: "History",
        summary: "How the harbor district came to be independently governed.",
        body: "Three generations ago, the harbor district broke from central rule after...",
        canonStatus: "canon",
        firstAppeared: "Session 3",
        relatedEntries: [],
        tags: ["docks", "history"],
      },
    ],
    notablePlaces: [
      {
        id: "place-rusted-anchor",
        name: "The Rusted Anchor",
        placeType: "tavern",
        dangerLevel: "low-risk",
        description: "A dockside tavern that's really the Thorne Cabal's front.",
        keyFigures: ["npc-elyra"],
        items: [],
      },
    ],
    sessionLogs: [
      {
        title: "The Missing Courier",
        sessionNumber: 4,
        campaignName: "",
        sessionDate: "",
        sessionTitle: "",
        synopsis: "The party tracked a missing courier to the docks and met Elyra Voss for the first time.",
        fullRecap: "The session opened with the party investigating...",
        notableMoments: "",
        loreUpdates: "",
        npcStatusChanges: "",
        nextSession: "",
        tone: "Investigative",
      },
    ],
  },
  null,
  2,
);

/**
 * Copy-paste prompt for users to hand to their own AI agent (Claude,
 * ChatGPT, Gemini, etc.) along with WIKI_JSON_TEMPLATE and their raw
 * notes, to get back JSON matching the template. Deliberately redundant
 * with WIKI_JSON_TEMPLATE's "_instructions" field rather than relying on
 * one or the other — this prompt is the primary framing for a fresh
 * conversion, "_instructions" is the fallback that survives if the
 * template file is later reused/reshared without this prompt attached.
 * If the template's fields, enums, or rules change, update BOTH this and
 * "_instructions" in the same commit — nothing keeps them in sync.
 */
export const WIKI_IMPORT_PROMPT = `You are converting my raw tabletop campaign notes into a structured JSON
file for a Wiki bulk-import tool. I'm giving you three things: this
prompt, the JSON template below, and my raw notes below that.

Rules — follow exactly, do not deviate:

1. Output ONLY valid JSON matching the template's structure. No markdown
   code fences, no commentary before or after, no explanations — just
   the JSON object, so I can paste your output directly into a file.

2. Keep the template's top-level keys: worldUnit, factions, keyFigures,
   magicItems, loreEntries, notablePlaces, sessionLogs. Delete the
   "_instructions" key from your output — it's guidance for you, not
   data to include.

3. Sort my notes into the right section by what they actually describe:
   an NPC → keyFigures, a group/organization → factions, a magic item →
   magicItems, background/history/culture writing → loreEntries, a
   location → notablePlaces, a session recap → sessionLogs. If something
   doesn't clearly fit any of those, put it as plain text/markdown in
   worldUnit.overview instead of forcing it into the wrong section.

4. worldUnit.name is required — it says which world unit within the
   selected world this import targets (creating it if it doesn't exist
   yet). For every other entry, only "name" (or "title" for loreEntries/
   sessionLogs) is required. Omit every other field you don't have real
   content for — do not invent placeholder values, do not write
   "unknown" or "TBD" into a field just to fill it in.

5. Enum fields must use EXACTLY one of the allowed values listed in the
   template's instructions (e.g. threatLevel must be exactly "friendly",
   "neutral", "cautious", "dangerous", or "deadly" — not a synonym, not
   a different case). If none of the allowed values fit, omit the field
   entirely rather than guessing.

6. If one entry references another (e.g. an item's current holder, a
   place's notable figures), and that other entry is ALSO in my notes,
   give both entries a short lowercase-hyphenated "id" and use that id
   to link them — do not invent a real database ID. If the reference is
   to something that already exists in the wiki (not in my notes), use
   its exact name as a plain string instead of an id.

7. Description/body/overview/lore fields are plain markdown text
   (paragraphs separated by a blank line) — not any special block
   format.

8. Never add a "world" field anywhere — which world this goes into is
   chosen separately when the file is uploaded, not in the file itself.
   Do set worldUnit.name (rule 4) — that part IS in the file.

9. If my notes contain something you're not confident how to categorize
   or which enum value fits, still include it — put it in worldUnit.overview
   with a short note, rather than dropping it or guessing.

Template:
<paste the downloaded template JSON here>

My notes:
<paste raw notes here>
`;
