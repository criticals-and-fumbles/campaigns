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
