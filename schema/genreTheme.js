import { defineField, defineType } from "sanity";

/**
 * genreTheme — additive to the main criticalsandfumbles.com Sanity schema
 * (same project/dataset, see CLAUDE.md). Not a singleton: multiple theme
 * documents coexist (one default per genre, plus optional per-campaign
 * overrides via `campaignOverride: true`). A campaign points at exactly
 * one genreTheme via `campaign.theme`.
 *
 * The dossier template is genre-agnostic — colors/fonts/labels/loading
 * motif here are the ONLY thing that changes per genre. Do not add a
 * layout-mode switch anywhere that reads genre directly; everything
 * should flow through the referenced genreTheme document instead.
 */
export default defineType({
  name: "genreTheme",
  title: "Genre Theme",
  type: "document",
  fields: [
    defineField({
      name: "genre",
      title: "Genre",
      type: "string",
      description:
        '"Sci-Fi" | "Fantasy" | "Horror" | "Modern" | "Site" | ... — free text, not a fixed enum, since new genres can be added without a schema change.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "campaignOverride",
      title: "Campaign Override",
      type: "boolean",
      description:
        "true if this is a one-off override for a specific campaign rather than a shared default for the genre.",
      initialValue: false,
    }),
    defineField({
      name: "colors",
      title: "Colors",
      type: "object",
      fields: [
        defineField({
          name: "dark",
          title: "Dark",
          type: "object",
          fields: [
            defineField({ name: "bg", title: "Background", type: "string" }),
            defineField({ name: "accentA", title: "Accent A", type: "string" }),
            defineField({ name: "accentB", title: "Accent B", type: "string" }),
            defineField({ name: "text", title: "Text", type: "string" }),
          ],
        }),
        defineField({
          name: "light",
          title: "Light",
          type: "object",
          fields: [
            defineField({ name: "bg", title: "Background", type: "string" }),
            defineField({ name: "accentA", title: "Accent A", type: "string" }),
            defineField({ name: "accentB", title: "Accent B", type: "string" }),
            defineField({ name: "text", title: "Text", type: "string" }),
          ],
        }),
      ],
    }),
    defineField({
      name: "fonts",
      title: "Fonts",
      type: "object",
      fields: [
        defineField({ name: "display", title: "Display", type: "string" }),
        defineField({ name: "body", title: "Body", type: "string" }),
        defineField({ name: "mono", title: "Mono", type: "string" }),
      ],
    }),
    defineField({
      name: "labels",
      title: "Section Labels",
      type: "object",
      description:
        "Section-label copy that varies per genre (e.g. sci-fi's \"Threat Assessment\" vs. fantasy's \"Encounter Standing\").",
      fields: [
        defineField({ name: "dossier", title: "Dossier", type: "string" }),
        defineField({ name: "overview", title: "Overview", type: "string" }),
        defineField({ name: "location", title: "Location", type: "string" }),
        defineField({ name: "meterSection", title: "Meter Section", type: "string" }),
        defineField({ name: "meterItem", title: "Meter Item", type: "string" }),
        defineField({ name: "objectives", title: "Objectives", type: "string" }),
        defineField({
          name: "objectivePriorityHigh",
          title: "Objective Priority — High",
          type: "string",
        }),
        defineField({
          name: "objectivePriorityMid",
          title: "Objective Priority — Mid",
          type: "string",
        }),
        defineField({
          name: "objectivePriorityLow",
          title: "Objective Priority — Low",
          type: "string",
        }),
        defineField({ name: "log", title: "Log", type: "string" }),
        defineField({ name: "media", title: "Media", type: "string" }),
        defineField({
          name: "statPanel",
          title: "Stat Panel",
          type: "string",
          description:
            'Titles the optional statTiles strip (e.g. "Party Status", "Survivor Status"). Leave unset for genres that don\'t use the panel — the section only renders when a dossier\'s statTiles array is non-empty.',
        }),
      ],
    }),
    defineField({
      name: "loadingScreen",
      title: "Loading Screen",
      type: "object",
      fields: [
        defineField({
          name: "motif",
          title: "Motif",
          type: "string",
          description:
            "Selects which reusable boot-screen animation module renders — NOT tied to genre/campaign name directly, the template picks the module by this value alone.",
          options: {
            list: [
              { title: "Terminal Decrypt (sci-fi)", value: "terminal-decrypt" },
              { title: "Wax Seal (fantasy)", value: "wax-seal" },
              { title: "VHS Tracking (horror)", value: "vhs-tracking" },
              { title: "File Unlock (modern)", value: "file-unlock" },
              { title: "Wayang Shadow (ancient asia)", value: "wayang-shadow" },
            ],
          },
        }),
        defineField({ name: "bootTitle", title: "Boot Title", type: "string" }),
        defineField({ name: "bootSubtitle", title: "Boot Subtitle", type: "string" }),
        defineField({
          name: "customImage",
          title: "Custom Boot Image (replaces the animated motif)",
          type: "image",
          description:
            'Optional. When set, the boot screen shows this image (with a subtle pulse/glow) instead of the "motif" animation above — motif is ignored for this theme once an image is set. Leave unset to keep the built-in animated motif. A square-ish image with a transparent or dark background works best; it renders at roughly 120×120px. Studio-only field — not editable from the console.',
        }),
      ],
    }),
    defineField({
      name: "locationMotif",
      title: "Location Motif",
      type: "string",
      description:
        "Selects which decorative visual renders in the dossier page's Location section (the radar-sweep-style panel) — NOT tied to genre/campaign name directly, the template picks the module by this value alone. See src/templates/locationMotifs.js.",
      options: {
        list: [
          { title: "Radar Sweep (sci-fi)", value: "radar-sweep" },
          { title: "Parchment Map (fantasy)", value: "parchment-map" },
          { title: "Static Scan (horror)", value: "static-scan" },
          { title: "Grid Scan (modern)", value: "grid-scan" },
          { title: "End of Broadcast (apocalyptic)", value: "end-of-broadcast" },
        ],
      },
    }),
    defineField({
      name: "ornateBorders",
      title: "Ornate Borders",
      type: "boolean",
      description:
        "Swaps the dossier page's plain corner-accent panel borders for a gilded double-line border with filigree corner flourishes — an opt-in look for a theme, not tied to genre/campaign name directly (same rule as loadingScreen.motif/locationMotif). Off/unset for every existing theme.",
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: "genre", subtitle: "campaignOverride" },
    prepare({ title, subtitle }) {
      return {
        title,
        subtitle: subtitle ? "Campaign override" : "Genre default",
      };
    },
  },
});
