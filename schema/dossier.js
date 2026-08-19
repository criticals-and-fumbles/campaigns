import { defineField, defineType } from "sanity";

/**
 * dossier — additive to the main criticalsandfumbles.com Sanity schema
 * (same project/dataset). One document per session update, referencing
 * its parent `campaign`.
 *
 * `quickFacts`/`locationFacts` are intentionally generic label/value
 * arrays rather than fixed fields — every genre/campaign tracks a
 * different set of facts (sci-fi: "Nomad Relations"; fantasy: "Guild
 * Standing"; horror: "Comms Status"). Modeling each as a named field
 * would mean a schema change per new genre/campaign; this lets a GM
 * define whatever's relevant through the console with zero schema
 * changes. Same reasoning as this project family's existing pattern for
 * open-ended per-instance data (see e.g. cnf-website's `resource.division`
 * — though note that one is a cautionary example of an under-specified
 * field, not a pattern to copy; this genuinely needs to be free-form).
 *
 * `media.asset` — the spec described this as "image|file", which isn't a
 * single Sanity field type. Implemented as two optional fields (`image`,
 * `file`) on the mediaItem object, each hidden unless `kind` matches —
 * same conditional-field pattern the main site already uses for
 * keyFigure.statBlock (hidden unless keyFigure.hasStatBlock).
 */

const factRow = {
  type: "object",
  name: "factRow",
  fields: [
    defineField({ name: "label", title: "Label", type: "string" }),
    defineField({ name: "value", title: "Value", type: "string" }),
  ],
  preview: { select: { title: "label", subtitle: "value" } },
};

const statTile = {
  type: "object",
  name: "statTile",
  fields: [
    defineField({ name: "value", title: "Value", type: "string" }),
    defineField({ name: "label", title: "Label", type: "string" }),
  ],
  preview: { select: { title: "value", subtitle: "label" } },
};

const meterRow = {
  type: "object",
  name: "meterRow",
  fields: [
    defineField({ name: "label", title: "Label", type: "string" }),
    defineField({
      name: "level",
      title: "Level",
      type: "string",
      description: 'e.g. "low" | "medium" | "high" | "very-high" — free text, genre-flavored labels vary (see the concept dossiers).',
    }),
  ],
  preview: { select: { title: "label", subtitle: "level" } },
};

const objective = {
  type: "object",
  name: "objective",
  fields: [
    defineField({
      name: "priority",
      title: "Priority",
      type: "string",
      options: {
        list: [
          { title: "Primary", value: "primary" },
          { title: "Secondary", value: "secondary" },
          { title: "Tertiary", value: "tertiary" },
        ],
      },
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Open", value: "open" },
          { title: "Done", value: "done" },
        ],
      },
      initialValue: "open",
    }),
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({ name: "description", title: "Description", type: "text" }),
  ],
  preview: {
    select: { title: "title", subtitle: "priority" },
  },
};

const mediaItem = {
  type: "object",
  name: "mediaItem",
  fields: [
    defineField({
      name: "kind",
      title: "Kind",
      type: "string",
      options: {
        list: [
          { title: "Image", value: "image" },
          { title: "Audio", value: "audio" },
          { title: "Video", value: "video" },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.kind !== "image",
    }),
    defineField({
      name: "file",
      title: "File",
      type: "file",
      description: "Used for kind = audio or video.",
      hidden: ({ parent }) => parent?.kind === "image",
    }),
    defineField({ name: "caption", title: "Caption", type: "string" }),
  ],
  preview: { select: { title: "caption", subtitle: "kind" } },
};

const logEntry = {
  type: "object",
  name: "logEntry",
  fields: [
    defineField({
      name: "ts",
      title: "Timestamp",
      type: "string",
      description: 'Free text — "22:04 IC", "Day 41", "TBD" — not a strict datetime, matches the in-fiction log style.',
    }),
    defineField({ name: "entry", title: "Entry", type: "text" }),
  ],
  preview: { select: { title: "ts", subtitle: "entry" } },
};

export default defineType({
  name: "dossier",
  title: "Dossier",
  type: "document",
  fields: [
    defineField({
      name: "code",
      title: "Code",
      type: "string",
      description: 'e.g. "BN-DAWN-119-08".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "campaign",
      title: "Campaign",
      type: "reference",
      to: [{ type: "campaign" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "classification",
      title: "Classification",
      type: "string",
      description: 'e.g. "TOP SECRET", "RESTRICTED", "Party Eyes Only".',
    }),
    defineField({
      name: "distribution",
      title: "Distribution",
      type: "string",
      description: 'e.g. "PLAYER-FACING", "SURVIVOR CELL ONLY".',
    }),
    defineField({
      name: "sessionLabel",
      title: "Session Label",
      type: "string",
      description:
        'Free text — "8", "Day 41", "28.06.119 IC". The genreTheme\'s labels decide whether the classbar calls this "SESSION" or "DATE".',
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "string",
      description: "Short location name, used as the page subtitle.",
    }),
    defineField({ name: "overview", title: "Overview", type: "text" }),
    defineField({
      name: "heroImage",
      title: "Hero Image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "quickFacts",
      title: "Quick Facts",
      type: "array",
      of: [factRow],
      description: "The kv-panel beside Overview — fully free-form per campaign.",
    }),
    defineField({
      name: "locationFacts",
      title: "Location Facts",
      type: "array",
      of: [factRow],
      description: "Same free-form pattern as Quick Facts, scoped to the location section.",
    }),
    defineField({
      name: "statTiles",
      title: "Stat Tiles",
      type: "array",
      of: [statTile],
      description:
        'Optional 4-tile status strip under the meters section (e.g. fantasy\'s Party Status, horror\'s Survivor Status). Leave empty for genres/campaigns that don\'t use one — the section only renders when non-empty.',
    }),
    defineField({
      name: "threatAssessment",
      title: "Threat Assessment",
      type: "array",
      of: [meterRow],
    }),
    defineField({
      name: "objectives",
      title: "Objectives",
      type: "array",
      of: [objective],
    }),
    defineField({
      name: "media",
      title: "Media",
      type: "array",
      of: [mediaItem],
    }),
    defineField({
      name: "log",
      title: "Log",
      type: "array",
      of: [logEntry],
    }),
    defineField({
      name: "lastEditedBy",
      title: "Last Edited By",
      type: "string",
      description:
        "Populated server-side from the Cf-Access-Authenticated-User-Email request header — never editable directly by a GM through the console UI.",
      readOnly: true,
    }),
    defineField({
      name: "lastEditedAt",
      title: "Last Edited At",
      type: "datetime",
      readOnly: true,
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "code" },
  },
});
