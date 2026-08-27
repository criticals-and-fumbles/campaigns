import { Hono } from "hono";
import { query, mutate } from "../lib/sanity.js";
import { resolveMyTeamMember } from "../lib/identity.js";
import { markdownToBlocks } from "../lib/portable-text.js";

const app = new Hono();

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

// ~200 words/minute, same rough convention the schema's own field
// description implies ("Auto-calculated hint — override if needed").
function estimateReadTime(markdown) {
  const words = String(markdown || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const MY_ARTICLES_QUERY = `*[_type == "article" && author._ref == $authorId] | order(_createdAt desc){
  _id, title, slug, excerpt, category, tags, coverImage, status, publishedAt, readTimeMinutes
}`;

async function requireMyTeamMember(c) {
  const email = c.get("gmEmail");
  const member = await resolveMyTeamMember(c.env, email);
  if (!member) {
    return {
      error: c.json(
        { error: "No team member profile is linked to this email yet — ask an admin to link one." },
        404,
      ),
    };
  }
  return { member };
}

// GET /api/me/articles — the caller's own articles (any status), most
// recent first. Scoped by resolved teamMemberId, never client-supplied.
app.get("/", async (c) => {
  const { member, error } = await requireMyTeamMember(c);
  if (error) return error;
  const articles = await query(c.env, MY_ARTICLES_QUERY, { authorId: member._id });
  return c.json({ ok: true, articles });
});

// POST /api/me/articles — body: { title, excerpt, category, tags,
// coverImageAssetId?, body (markdown string), worlds? }. Same "body"
// name PATCH below uses, so the console's create/edit forms can share
// one field map. author/status are always server-set — status is
// always "draft" here, never auto-published; a Studio admin flips it to
// Published after review. slug is derived from title the same way
// campaign/dossier already do, checked for collision (article has no
// deterministic _id scheme to fall back on like those two, so a plain
// uniqueness check is the whole guard).
app.post("/", async (c) => {
  const { member, error } = await requireMyTeamMember(c);
  if (error) return error;

  const payload = await c.req.json();
  if (!payload.title || !String(payload.title).trim()) {
    return c.json({ error: "title is required" }, 400);
  }

  const slug = slugify(payload.title);
  if (!slug) return c.json({ error: "title must contain at least one letter/number" }, 400);

  const existing = await query(c.env, `*[_type == "article" && slug.current == $slug][0]._id`, { slug });
  if (existing) return c.json({ error: `An article with slug "${slug}" already exists — try a different title` }, 409);

  // Deterministic _id (same pattern as campaign/dossier/worldUnit) rather
  // than a plain `create` mutation with an auto-generated id — Sanity's
  // mutate response doesn't echo the new document's id back unless the
  // caller supplies it (or opts into returnIds), so this is simpler than
  // parsing that out, and createIfNotExists gives a second guard against
  // the same slug race the uniqueness check above already covers.
  const id = `article.${slug}`;
  const doc = {
    _id: id,
    _type: "article",
    title: String(payload.title).trim(),
    slug: { _type: "slug", current: slug },
    excerpt: payload.excerpt ? String(payload.excerpt).trim().slice(0, 200) : undefined,
    author: { _type: "reference", _ref: member._id },
    category: payload.category || undefined,
    tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : undefined,
    coverImage: payload.coverImageAssetId
      ? { _type: "image", asset: { _type: "reference", _ref: payload.coverImageAssetId } }
      : undefined,
    body: markdownToBlocks(payload.body),
    readTimeMinutes: estimateReadTime(payload.body),
    worlds: Array.isArray(payload.worlds) && payload.worlds.length
      ? payload.worlds.map((id) => ({ _type: "reference", _ref: id }))
      : undefined,
    featured: false,
    status: "draft",
  };

  try {
    const result = await mutate(c.env, [{ createIfNotExists: doc }]);
    return c.json({ ok: true, id, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

// PATCH /api/me/articles/:id — body: { field, value }. Same single-field
// pattern as api-dossier.js. author/status/featured/publishedAt are not
// self-editable — status changes (draft -> published) go through
// Studio's review step by design (see the article-status product
// decision this route implements); a DM can revise their own draft's
// content freely but can't publish it themselves.
const SELF_EDITABLE_FIELDS = new Set(["title", "excerpt", "category", "tags", "coverImage", "body", "worlds"]);

app.patch("/:id", async (c) => {
  const { member, error } = await requireMyTeamMember(c);
  if (error) return error;

  const id = decodeURIComponent(c.req.param("id"));
  const current = await query(c.env, `*[_id == $id][0]{ "authorId": author._ref }`, { id });
  if (!current) return c.notFound();
  if (current.authorId !== member._id) {
    return c.json({ error: "Forbidden — you are not the author of this article" }, 403);
  }

  const { field, value } = await c.req.json();
  if (!field) return c.json({ error: "field is required" }, 400);
  if (!SELF_EDITABLE_FIELDS.has(field)) {
    return c.json({ error: `"${field}" is not self-editable — ask an admin to change it` }, 400);
  }

  // "body" arrives as markdown from the console's textarea, same
  // markdown->blocks conversion as creation, not raw Portable Text.
  // "worlds" arrives as a plain array of world _ids from the console's
  // multiSelect, same reference-object wrapping POST already does for
  // it — sending plain strings into a reference-array field would
  // silently store the wrong shape.
  let finalValue = value;
  if (field === "body") finalValue = markdownToBlocks(value) ?? [];
  else if (field === "worlds") {
    finalValue = Array.isArray(value) ? value.map((wid) => ({ _type: "reference", _ref: wid })) : [];
  }

  try {
    const result = await mutate(c.env, [{ patch: { id, set: { [field]: finalValue } } }]);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: err.message }, 502);
  }
});

export default app;
