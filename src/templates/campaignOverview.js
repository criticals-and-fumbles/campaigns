/**
 * Campaign Overview page — GET /:campaignSlug/overview. Genre-themed the
 * same way renderDossierPage/renderCampaignIndexPage are (boot screen,
 * frame borders, fonts/colors, particles) via the shared helpers/CSS/JS
 * exported from templates/dossier.js — but a DELIBERATELY different
 * content structure, not a reskinned dossier. A dossier is one session's
 * event log (objectives, threat assessment, media, timeline); this page
 * answers "what is this campaign, and who's in it" — hook/synopsis,
 * system/status/GM/world metadata, and the player roster. Added so a
 * first-time reader lands on campaign context before a session log they
 * have no background for (see renderCampaignIndexPage's first list item,
 * which points here).
 *
 * Reuses templates/dossier.js's exported SITE_URL/esc/renderOverview/
 * truncate/stripTags/ogTags/shareButtonsHtml/SHARE_JS/kvRows/panelTitle/
 * BASE_CSS/ORNATE_BORDERS_CSS/CUSTOM_BOOT_IMAGE_CSS/BASE_JS rather than
 * duplicating them — single source of truth for the shared visual
 * grammar (frame corners, classbar, panels, kvtable, boot sequence,
 * particles, theme toggle wiring) so the two page types can never drift
 * apart on those pieces, while this file owns its own distinct section
 * markup entirely.
 */
import {
  SITE_URL,
  esc,
  renderOverview,
  truncate,
  stripTags,
  ogTags,
  shareButtonsHtml,
  SHARE_JS,
  kvRows,
  panelTitle,
  BASE_CSS,
  ORNATE_BORDERS_CSS,
  CUSTOM_BOOT_IMAGE_CSS,
  BASE_JS,
} from "./dossier.js";
import { themeToCssVars, resolveLabels, resolveMotif } from "../lib/theme.js";
import { renderMotif } from "./motifs.js";
import { urlFor } from "../lib/sanity-image.js";

function rosterCard(member) {
  const details = [
    member.level ? `Level ${member.level}` : null,
    member.race || null,
    member.characterClass || null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <div class="roster-card">
      <div class="rc-name">${esc(member.characterName)}</div>
      ${details ? `<div class="rc-details">${esc(details)}</div>` : ""}
    </div>
  `;
}

export function renderCampaignOverviewPage({ campaign, theme, embedded, colorMode = "dark" }) {
  const labels = resolveLabels(theme);
  const motifKey = resolveMotif(theme);
  const bootTitle = theme?.loadingScreen?.bootTitle || "LOADING";
  const bootSubtitle = theme?.loadingScreen?.bootSubtitle || "PLEASE WAIT";
  const customImageUrl = theme?.loadingScreen?.customImage
    ? urlFor(theme.loadingScreen.customImage).width(320).height(320).url()
    : null;
  const motif = customImageUrl ? null : renderMotif(motifKey, bootTitle, bootSubtitle, "OVERVIEW");
  const bootHtml = customImageUrl
    ? `
      <div class="boot-symbol"><img src="${esc(customImageUrl)}" alt="" /></div>
      <div class="glyph">${esc(bootTitle)}</div>
      <div class="bootbar"></div>
      <div class="bootline">${esc(bootSubtitle)} · OVERVIEW</div>
    `
    : motif.html;

  const heroUrl = campaign.heroImage ? urlFor(campaign.heroImage).width(1600).height(500).url() : null;

  const pageUrl = `${SITE_URL}/${encodeURIComponent(campaign.slug?.current || "")}/overview`;
  const ogImageUrl = campaign.heroImage ? urlFor(campaign.heroImage).width(1200).height(630).url() : null;
  const ogDescription = truncate(
    stripTags(campaign.hook) || campaign.motto || `About ${campaign.title}.`,
    155,
  );

  const infoRows = [
    campaign.system ? { label: "System", value: campaign.system } : null,
    campaign.status ? { label: "Status", value: campaign.status } : null,
    campaign.gmNames?.length ? { label: campaign.gmNames.length > 1 ? "GMs" : "GM", value: campaign.gmNames.join(", ") } : null,
    typeof campaign.sessionCount === "number" ? { label: "Sessions", value: String(campaign.sessionCount) } : null,
    campaign.world?.title ? { label: "World", value: campaign.world.title } : null,
  ].filter(Boolean);

  const roster = campaign.roster || [];

  return `<!DOCTYPE html>
<html lang="en" data-theme="${colorMode}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>// ${esc(campaign.title)} :: ${esc(labels.campaignOverview)}</title>
${ogTags({
  url: pageUrl,
  title: `${campaign.title} :: ${labels.campaignOverview}`,
  description: ogDescription,
  image: ogImageUrl,
})}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(theme?.fonts?.display || "Space Grotesk")}:wght@500;700;900&family=${encodeURIComponent(theme?.fonts?.body || "Inter")}:wght@400;500;600;700&family=${encodeURIComponent(theme?.fonts?.mono || "JetBrains Mono")}&display=swap" rel="stylesheet">
<style>
${themeToCssVars(theme)}
${BASE_CSS}
${customImageUrl ? CUSTOM_BOOT_IMAGE_CSS : motif.css}
${theme?.ornateBorders ? ORNATE_BORDERS_CSS : ""}
${OVERVIEW_CSS}
</style>
</head>
<body${theme?.ornateBorders ? ' class="ornate"' : ""}>

<div id="boot">
  ${bootHtml}
</div>

<canvas id="particles"></canvas>
<div class="grain"></div>
<div class="scanlines"></div>
<div class="vignette"></div>

${embedded ? "" : `<button id="themeToggle"><span class="dot"></span><span id="themeLabel">DARK</span></button>`}

<div class="wrap">

  <header class="classbar frame"><span class="bl"></span><span class="br"></span>
    <div class="left">
      <div class="badge">◆</div>
      <div class="orgtext"><b>${esc(campaign.title)}</b><br>${esc(campaign.genre || "")}</div>
    </div>
    <div class="right">
      ${campaign.system ? `<div><span class="k">SYSTEM</span><br>${esc(campaign.system)}</div>` : ""}
      ${campaign.status ? `<div><span class="k">STATUS</span><br>${esc(campaign.status).toUpperCase()}</div>` : ""}
      ${typeof campaign.sessionCount === "number" ? `<div><span class="k">SESSIONS</span><br>${esc(String(campaign.sessionCount))}</div>` : ""}
    </div>
  </header>

  <div class="titleblock">
    <div class="eyebrow">${esc(labels.campaignOverview)}</div>
    <h1 class="title" id="mainTitle">${esc(campaign.title)}<span class="glitch-layer" aria-hidden="true">${esc(campaign.title)}</span></h1>
    ${!embedded ? `<div class="subtitle"><a class="ov-back" href="/${esc(campaign.slug?.current || "")}">${esc(labels.dossier)} log &rarr;</a></div>` : ""}
  </div>

  ${embedded ? "" : `<div class="share-row">${shareButtonsHtml({ url: pageUrl, title: campaign.title })}</div>`}

  ${heroUrl ? `
  <div class="frame" style="margin-bottom:40px; aspect-ratio:16/5; overflow:hidden;"><span class="bl"></span><span class="br"></span>
    <img src="${esc(heroUrl)}" alt="${esc(campaign.title)}" style="width:100%;height:100%;object-fit:cover;display:block;" />
  </div>
  ` : ""}

  <section class="in">
    <div class="sechead"><span class="num">01</span><h2>${esc(labels.overview)}</h2><span class="rule"></span></div>
    <div class="grid-2">
      <div class="panel frame"><span class="bl"></span><span class="br"></span>
        <div class="body-copy">${renderOverview(campaign.hook) || `<p style="opacity:.5;">No overview written yet.</p>`}</div>
      </div>
      <div class="panel frame"><span class="bl"></span><span class="br"></span>
        ${panelTitle(labels.quickFactsPanel, infoRows)}
        ${kvRows(infoRows)}
      </div>
    </div>
  </section>

  ${roster.length > 0 ? `
  <section class="in">
    <div class="sechead"><span class="num">02</span><h2>${esc(labels.roster)}</h2><span class="rule"></span></div>
    <div class="roster-grid">
      ${roster.map(rosterCard).join("\n")}
    </div>
  </section>
  ` : ""}

</div>

<footer>
  <div class="starlogo"></div>
  ${campaign.motto ? `<div class="quote">"${esc(campaign.motto)}"</div>` : ""}
  <div class="sig">— ${esc(campaign.signOff || campaign.title)} —</div>
</footer>

${embedded ? "" : `<div id="shareToast" class="share-toast"></div>`}

<script>
${motif ? motif.js || "" : ""}
${BASE_JS}
${embedded ? "" : SHARE_JS}
</script>
</body>
</html>`;
}

// Page-specific additions on top of BASE_CSS — sections here render
// pre-revealed (class="in" set directly in the markup above) rather than
// wired to BASE_JS's IntersectionObserver reveal-on-scroll, since this
// page is short (2 sections max) and usually viewed inside a fixed-height
// iframe pane where a scroll-triggered fade reads as content quietly
// missing rather than as a deliberate effect — the dossier page's much
// longer scroll made it work there.
const OVERVIEW_CSS = `
  .ov-back{font-family:var(--font-mono); font-size:1rem; letter-spacing:2px; color:var(--accent-a); text-decoration:none; opacity:.85;}
  .ov-back:hover{opacity:1; text-decoration:underline;}
  .roster-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px;}
  .roster-card{background:rgba(255,255,255,.03); padding:16px; border-top:2px solid var(--accent-a);}
  .roster-card .rc-name{font-family:var(--font-display); font-weight:700; letter-spacing:.5px; color:var(--text); font-size:1.05rem;}
  .roster-card .rc-details{font-family:var(--font-mono); font-size:1rem; color:var(--text); opacity:.6; letter-spacing:.5px; margin-top:6px;}
`;
