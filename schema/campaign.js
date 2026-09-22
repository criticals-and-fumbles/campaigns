import { defineField, defineType } from "sanity";

/**
 * campaign — additive to the main criticalsandfumbles.com Sanity schema
 * (same project/dataset). One document per GM-run campaign; each of its
 * session dossiers references it via `dossier.campaign`.
 *
 * `worldRef` points at the main site's existing `world` document type
 * (confirmed against the actual registered schema — the original scaffold
 * spec's placeholder name "wikiWorld" doesn't exist in that schema, the
 * real type is `world`; see cnf-website/sanity/schemas/world.ts).
 */
export default defineType({
  name: "campaign",
  title: "Campaign",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "genre",
      title: "Genre (derived)",
      type: "string",
      description:
        'Always mirrors the referenced Genre Theme\'s own "genre" value — set automatically, never hand-typed (both here and in the console), so it can never drift from the theme actually driving this campaign\'s colors/labels. Change the Genre field below instead.',
      // No rule.required() here — readOnly + required together would
      // block publishing any document a Studio editor started from
      // Studio's own "create new" form. The console's POST /api/campaign
      // already enforces theme is present and derives genre from it
      // before the document is ever created.
      readOnly: true,
    }),
    defineField({
      name: "system",
      title: "System",
      type: "string",
      description:
        'The actual game system, e.g. "D&D 5e", "Pathfinder 2e", "Call of Cthulhu 7e", "Zombicide", "Infinity". Lives here, not per-dossier — it doesn\'t change session to session.',
    }),
    defineField({
      name: "classification",
      title: "Default Classification",
      type: "string",
      description:
        'Default Classification for every dossier in this campaign (e.g. "TOP SECRET") — a dossier only needs its own value if it\'s an exception. Falls back to the campaign\'s Genre Theme\'s default if left blank here too. Optional — added so a DM doesn\'t have to retype the same value on every session.',
    }),
    defineField({
      name: "distribution",
      title: "Default Distribution",
      type: "string",
      description:
        'Default Distribution for every dossier in this campaign (e.g. "PLAYER-FACING") — same fallback order as Default Classification above.',
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Active", value: "active" },
          { title: "Recruiting", value: "recruiting" },
          { title: "Hiatus", value: "hiatus" },
          { title: "Concluded", value: "concluded" },
        ],
      },
      initialValue: "active",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "gmNames",
      title: "GM Name(s)",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "theme",
      title: "Genre",
      type: "reference",
      to: [{ type: "genreTheme" }],
      description:
        "Picking a Genre here drives everything genre-specific about this campaign's dossiers — colors, fonts, section-label copy (\"Quest Objectives\" vs. \"Mission Objectives\", etc.) — and also sets the Genre (derived) field above automatically.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "heroImage",
      title: "Hero Image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "hook",
      title: "Hook",
      type: "text",
      description: "Short description for the campaign directory card.",
    }),
    defineField({
      name: "sessionCount",
      title: "Session Count",
      type: "number",
      initialValue: 0,
    }),
    defineField({
      name: "motto",
      title: "Motto",
      type: "string",
      description:
        'Campaign-level flavor line shown in the dossier footer, e.g. "Arachne is not a system...", "Where titans fell...".',
    }),
    defineField({
      name: "signOff",
      title: "Sign-Off",
      type: "string",
      description: 'Footer attribution, e.g. "BUREAU NOIR COMMAND", "THE GUILDMASTER".',
    }),
    defineField({
      name: "worldRef",
      title: "World",
      type: "reference",
      to: [{ type: "world" }],
      description:
        "Optional — link to the main site's wiki world this campaign is set in, if any.",
    }),
    defineField({
      name: "ownerEmail",
      title: "Owner (DM) Email",
      type: "string",
      description:
        "Legacy plaintext — being phased out in favor of ownerEmailHash (this dataset is publicly readable with no auth, same reasoning as teamMember.ownerEmailHash). No longer read by any app logic; kept only until existing campaigns are confirmed working via the hash.",
      readOnly: true,
    }),
    defineField({
      name: "ownerEmailHash",
      title: "Owner (DM) Email Hash",
      type: "string",
      description:
        "HMAC-SHA256 of the owning DM's Cf-Access email, same scheme as teamMember.ownerEmailHash (see lib/identity.js) — replaces ownerEmail as the actual scoping mechanism. Set once, server-side, at creation.",
      readOnly: true,
    }),
    defineField({
      name: "visible",
      title: "Visible",
      type: "boolean",
      description:
        'Whether this campaign (and its dossiers) appear on the public campaign directory and session-index pages at campaigns.criticalsandfumbles.com. Off by default so a DM can build out a campaign before publishing it — toggle on from the console when ready. Enforced on both the "/" directory listing and the "/:campaignSlug" / "/:campaignSlug/:dossierCode" pages themselves (a direct link to a non-visible campaign 404s, it is not merely unlisted).',
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "genre", media: "heroImage" },
  },
});
