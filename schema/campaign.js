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
      title: "Genre",
      type: "string",
      description: 'Matches a genreTheme.genre value, e.g. "Sci-Fi", "Fantasy".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "system",
      title: "System",
      type: "string",
      description:
        'The actual game system, e.g. "D&D 5e", "Pathfinder 2e", "Call of Cthulhu 7e", "Zombicide", "Infinity". Lives here, not per-dossier — it doesn\'t change session to session.',
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
      title: "Theme",
      type: "reference",
      to: [{ type: "genreTheme" }],
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
        "The Cf-Access-Authenticated-User-Email of the DM who created this campaign. Set once, server-side, at creation (see src/routes/api-campaign.js) — never editable directly, here or through the console. Scopes console visibility/edit access: a DM only sees and can edit campaigns (and their dossiers) where this matches their own Access identity.",
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
