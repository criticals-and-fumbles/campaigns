/**
 * Port of concepts/campaign-dossier-concept.html (+ its fantasy/horror/modern
 * reskins) into ONE theme-parameterized template. There is no
 * layout-mode switch — every campaign renders through this same
 * function; only `theme` (colors/fonts/labels/motif) and the dossier's
 * own content differ per campaign/genre.
 *
 * The 4 reference HTMLs' particle backdrop ("starfield" / "embers" /
 * "static" / "datamotes") is the same drifting-dot canvas mechanic in
 * all 4 — only color, count, and drift direction differ, all of which
 * are already theme-driven here — so it's implemented once, not as 4
 * separate canvas systems. Everything else (classbar, title glitch,
 * tabs, sections, meters, objectives, gallery, audio log, footer) is a
 * direct port of the shared structure common to all 4 concept files.
 */
import { themeToCssVars, resolveLabels, resolveMotif, resolveLocationMotif } from "../lib/theme.js";
import { renderMotif } from "./motifs.js";
import { renderLocationMotif } from "./locationMotifs.js";
import { urlFor } from "../lib/sanity-image.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kvRows(rows) {
  return (rows || [])
    .map((r) => `<div class="kv"><span>${esc(r.label)}</span><span>${esc(r.value)}</span></div>`)
    .join("\n");
}

function meterLevelClass(level) {
  const l = String(level || "").toLowerCase();
  if (l.includes("very") || l.includes("v.")) return "vhigh";
  if (l.includes("high")) return "high";
  return "";
}

function meterFill(level) {
  const l = String(level || "").toLowerCase();
  if (l.includes("very") || l.includes("v.")) return 90;
  if (l.includes("high")) return 70;
  if (l.includes("medium")) return 50;
  if (l.includes("low")) return 25;
  return 40;
}

function objectiveTag(priority, labels) {
  const map = {
    primary: labels.objectivePriorityHigh,
    secondary: labels.objectivePriorityMid,
    tertiary: labels.objectivePriorityLow,
  };
  return { cls: priority || "tertiary", text: map[priority] || priority };
}

function mediaThumb(item) {
  const src = item.image ? urlFor(item.image).width(400).height(400).url() : null;
  const inner = src
    ? `<img src="${esc(src)}" alt="${esc(item.caption || "")}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div class="gicon">${item.kind === "audio" ? "♫" : item.kind === "video" ? "▶" : "▣"}</div>`;
  return `<div class="gitem">${inner}<div class="gtag">${esc(item.caption || item.kind)}</div></div>`;
}

export function renderDossierPage({ dossier, campaign, theme, embedded, colorMode = "dark" }) {
  const labels = resolveLabels(theme);
  const motifKey = resolveMotif(theme);
  const code = dossier.code || "";
  const bootTitle = theme?.loadingScreen?.bootTitle || "LOADING";
  const bootSubtitle = theme?.loadingScreen?.bootSubtitle || "PLEASE WAIT";
  const motif = renderMotif(motifKey, bootTitle, bootSubtitle, code);
  const locationMotif = renderLocationMotif(resolveLocationMotif(theme));

  const heroUrl = dossier.heroImage
    ? urlFor(dossier.heroImage).width(1600).height(800).url()
    : null;

  // Separate from heroUrl above — headerImage is the banner shown right
  // below the nav tabs; heroUrl still only appears in the Evidence
  // section further down. Two distinct image slots per dossier.
  const headerUrl = dossier.headerImage
    ? urlFor(dossier.headerImage).width(1600).height(500).url()
    : null;

  const statPanel =
    dossier.statTiles && dossier.statTiles.length > 0
      ? `
        <div class="sechead" style="margin-top:34px;"><span class="num"></span><h2>${esc(labels.statPanel || "Status")}</h2><span class="rule"></span></div>
        <div class="stattiles">
          ${dossier.statTiles
            .map(
              (t) =>
                `<div class="pstat"><div class="val">${esc(t.value)}</div><div class="lbl">${esc(t.label)}</div></div>`,
            )
            .join("\n")}
        </div>
      `
      : "";

  const objectives = (dossier.objectives || [])
    .map((o, i) => {
      const tag = objectiveTag(o.priority, labels);
      return `
        <div class="obj">
          <div class="idx">${String(i + 1).padStart(2, "0")}</div>
          <div><h3>${esc(o.title)}</h3><p>${esc(o.description)}</p></div>
          <div class="tag ${esc(tag.cls)}">${esc(tag.text)}</div>
        </div>
      `;
    })
    .join("\n");

  const threatRows = (dossier.threatAssessment || [])
    .map(
      (m) => `
        <div class="threat-row">
          <div class="label">${esc(m.label)}</div>
          <div class="meter ${meterLevelClass(m.level)}" data-fill="${meterFill(m.level)}"><i></i></div>
          <div class="pct">${esc(m.level)}</div>
        </div>
      `,
    )
    .join("\n");

  const gallery = (dossier.media || []).filter((m) => m.kind === "image" || !m.kind ? true : m.kind !== "audio")
    .map(mediaThumb)
    .join("\n");

  const audioItems = (dossier.media || []).filter((m) => m.kind === "audio");

  const logLines = (dossier.log || [])
    .map(
      (l) =>
        `<div class="logline"><div class="ts">${esc(l.ts)}</div><div class="entry">${esc(l.entry)}</div></div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" data-theme="${colorMode}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>// ${esc(campaign.title)} :: ${esc(dossier.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(theme?.fonts?.display || "Space Grotesk")}:wght@500;700;900&family=${encodeURIComponent(theme?.fonts?.body || "Inter")}:wght@400;500;600;700&family=${encodeURIComponent(theme?.fonts?.mono || "JetBrains Mono")}&display=swap" rel="stylesheet">
<style>
${themeToCssVars(theme)}
${BASE_CSS}
${motif.css}
${locationMotif.css}
${theme?.ornateBorders ? ORNATE_BORDERS_CSS : ""}
</style>
</head>
<body${theme?.ornateBorders ? ' class="ornate"' : ""}>

<div id="boot">
  ${motif.html}
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
      <div class="orgtext"><b>${esc(campaign.title)}</b><br>${esc(campaign.system || "")}</div>
    </div>
    <div class="right">
      <div><span class="k">CLASS</span><br>${esc(dossier.classification || "—")}</div>
      <div><span class="k">DIST</span><br>${esc(dossier.distribution || "—")}</div>
      <div><span class="k">${esc(dossier.sessionLabel ? "SESSION" : "")}</span><br>${esc(dossier.sessionLabel || "")}</div>
      <div><span class="k">CODE</span><br>${esc(code)}</div>
    </div>
  </header>

  <div class="titleblock">
    <div class="eyebrow">${esc(labels.dossier)}</div>
    <h1 class="title" id="mainTitle">${esc(dossier.title)}<span class="glitch-layer" aria-hidden="true">${esc(dossier.title)}</span></h1>
    <div class="subtitle">${esc(dossier.location || "")}</div>
  </div>

  <nav class="tabs">
    <a href="#overview">01 ${esc(labels.overview)}</a>
    <a href="#location">02 ${esc(labels.location)}</a>
    <a href="#threat">03 ${esc(labels.meterSection)}</a>
    <a href="#objectives">04 ${esc(labels.objectives)}</a>
    <a href="#media">05 ${esc(labels.media)}</a>
    <a href="#log">06 ${esc(labels.log)}</a>
  </nav>

  ${headerUrl ? `
  <div class="frame" style="margin-bottom:40px; aspect-ratio:16/5; overflow:hidden;"><span class="bl"></span><span class="br"></span>
    <img src="${esc(headerUrl)}" alt="${esc(dossier.title)}" style="width:100%;height:100%;object-fit:cover;display:block;" />
  </div>
  ` : ""}

  <section id="overview">
    <div class="sechead"><span class="num">01</span><h2>${esc(labels.overview)}</h2><span class="rule"></span></div>
    <div class="grid-2">
      <div class="panel frame"><span class="bl"></span><span class="br"></span>
        <p class="body-copy">${esc(dossier.overview || "")}</p>
      </div>
      <div class="panel frame"><span class="bl"></span><span class="br"></span>
        ${kvRows(dossier.quickFacts)}
      </div>
    </div>
  </section>

  <section id="location">
    <div class="sechead"><span class="num">02</span><h2>${esc(labels.location)}</h2><span class="rule"></span></div>
    <div class="grid-2">
      <div class="panel frame"><span class="bl"></span><span class="br"></span>
        <div class="mapbox">
          ${locationMotif.html}
        </div>
      </div>
      <div class="panel frame"><span class="bl"></span><span class="br"></span>
        <p class="body-copy"><b>${esc(dossier.location || "")}</b></p>
        ${kvRows(dossier.locationFacts)}
      </div>
    </div>
  </section>

  <section id="threat">
    <div class="sechead"><span class="num">03</span><h2>${esc(labels.meterSection)}</h2><span class="rule"></span></div>
    <div class="panel frame"><span class="bl"></span><span class="br"></span>
      ${threatRows}
    </div>
    ${statPanel}
  </section>

  <section id="objectives">
    <div class="sechead"><span class="num">04</span><h2>${esc(labels.objectives)}</h2><span class="rule"></span></div>
    ${objectives}
  </section>

  <section id="media">
    <div class="sechead"><span class="num">05</span><h2>${esc(labels.media)}</h2><span class="rule"></span></div>

    ${
      heroUrl
        ? `<div class="panel frame" style="margin-bottom:16px;"><span class="bl"></span><span class="br"></span>
            <div class="feed">
              <div class="feedlabel"><span class="rec"></span>${esc(labels.media)}</div>
              <img src="${esc(heroUrl)}" alt="${esc(dossier.title)}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" />
            </div>
          </div>`
        : ""
    }

    ${gallery ? `<div class="gallery" style="margin-bottom:16px;">${gallery}</div>` : ""}

    ${audioItems
      .map(
        (a) => `
        <div class="audiolog frame"><span class="bl"></span><span class="br"></span>
          <div class="playbtn playbtn-toggle">▶</div>
          <div class="waveform"></div>
          <div class="meta">${esc(a.caption || "AUDIO LOG")}</div>
        </div>
      `,
      )
      .join("\n")}
  </section>

  <section id="log">
    <div class="sechead"><span class="num">06</span><h2>${esc(labels.log)}</h2><span class="rule"></span></div>
    <div class="panel frame"><span class="bl"></span><span class="br"></span>
      ${logLines}
    </div>
  </section>

</div>

<footer>
  <div class="starlogo"></div>
  ${campaign.motto ? `<div class="quote">"${esc(campaign.motto)}"</div>` : ""}
  <div class="sig">— ${esc(campaign.signOff || "END OF DOSSIER")} —</div>
</footer>

<script>
${motif.js}
${BASE_JS}
</script>
</body>
</html>`;
}

const BASE_CSS = `
  *{box-sizing:border-box; margin:0; padding:0;}
  html{scroll-behavior:smooth; -webkit-text-size-adjust:100%; text-size-adjust:100%;}
  body{background:var(--bg); color:var(--text); font-family:var(--font-body); overflow-x:hidden; transition:background .6s ease, color .6s ease; position:relative;}
  #particles{position:fixed; inset:0; z-index:0; pointer-events:none; opacity:.8;}
  .grain{position:fixed; inset:0; z-index:1; pointer-events:none; mix-blend-mode:overlay; opacity:.05;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
  .scanlines{position:fixed; inset:0; z-index:2; pointer-events:none; background:repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.12) 3px, rgba(0,0,0,0) 4px); animation:scandrift 9s linear infinite; opacity:.35;}
  @keyframes scandrift{0%{background-position-y:0;}100%{background-position-y:200px;}}
  .vignette{position:fixed; inset:0; z-index:2; pointer-events:none; background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.55) 100%);}
  /* Vignette is a dark-mode-only effect — darkening the edges of an
     already-light page just muddies it, it doesn't read as atmosphere. */
  html[data-theme="light"] .vignette{opacity:0;}
  #boot{position:fixed; inset:0; z-index:999; background:#000; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; font-family:var(--font-mono); color:var(--accent-a); transition:opacity .8s ease, visibility .8s ease;}
  #boot.hide{opacity:0; visibility:hidden;}
  #boot .bootbar{width:min(420px,70vw); height:3px; background:rgba(255,255,255,.08); position:relative; overflow:hidden;}
  #boot .bootbar::after{content:''; position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg,var(--accent-a),var(--accent-b)); animation:bootfill 2.4s cubic-bezier(.3,.9,.4,1) forwards;}
  @keyframes bootfill{0%{width:0%}100%{width:100%}}
  #themeToggle{position:fixed; top:18px; right:18px; z-index:60; display:flex; align-items:center; gap:10px; background:rgba(0,0,0,.4); border:1px solid var(--accent-a); padding:8px 14px; cursor:pointer; font-family:var(--font-mono); font-size:1rem; letter-spacing:2px; color:var(--text); backdrop-filter:blur(6px);}
  #themeToggle .dot{width:8px; height:8px; border-radius:50%; background:var(--accent-a); box-shadow:0 0 8px var(--accent-a);}
  .wrap{position:relative; z-index:5; max-width:1180px; margin:0 auto; padding:90px 24px 120px;}
  .frame{position:relative; border:1px solid rgba(255,255,255,.12);}
  .frame::before,.frame::after,.frame .bl,.frame .br{content:''; position:absolute; width:14px; height:14px; pointer-events:none;}
  .frame::before{top:-1px; left:-1px; border-top:2px solid var(--accent-a); border-left:2px solid var(--accent-a);}
  .frame::after{top:-1px; right:-1px; border-top:2px solid var(--accent-b); border-right:2px solid var(--accent-b);}
  .frame .bl{bottom:-1px; left:-1px; border-bottom:2px solid var(--accent-b);}
  .frame .br{bottom:-1px; right:-1px; border-bottom:2px solid var(--accent-a); border-right:2px solid var(--accent-a);}
  header.classbar{display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; padding:14px 20px; margin-bottom:26px; background:rgba(255,255,255,.03); border-top:2px solid var(--accent-b); border-bottom:1px solid rgba(255,255,255,.08);}
  .classbar .left{display:flex; align-items:center; gap:12px;}
  .classbar .badge{width:34px; height:34px; border:1px solid var(--accent-a); border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative;}
  .classbar .orgtext{font-family:var(--font-mono); font-size:1rem; letter-spacing:3px; color:var(--text); opacity:.7; line-height:1.5;}
  .classbar .orgtext b{color:var(--text); font-family:var(--font-display); letter-spacing:1px; opacity:1;}
  .classbar .right{display:flex; gap:22px; font-family:var(--font-mono); font-size:1rem; color:var(--text); opacity:.7; letter-spacing:1px; text-align:right;}
  .classbar .right .k{color:var(--accent-b); opacity:1;}
  .titleblock{margin:34px 0 40px; text-align:center;}
  .titleblock .eyebrow{font-family:var(--font-mono); font-size:1rem; letter-spacing:8px; color:var(--accent-a); display:flex; align-items:center; justify-content:center; gap:14px; margin-bottom:14px;}
  .titleblock .eyebrow::before,.titleblock .eyebrow::after{content:''; height:1px; width:60px; background:linear-gradient(90deg,transparent,var(--accent-a));}
  .titleblock .eyebrow::after{background:linear-gradient(90deg,var(--accent-a),transparent);}
  h1.title{font-family:var(--font-display); font-weight:900; text-transform:uppercase; font-size:clamp(2rem,6vw,4.2rem); letter-spacing:2px; line-height:1.05; color:var(--text); position:relative; display:inline-block;}
  h1.title .glitch-layer{position:absolute; inset:0; color:var(--accent-b); opacity:0;}
  h1.title.glitching .glitch-layer{opacity:.7; animation:glitchmove .18s steps(2) 3;}
  @keyframes glitchmove{0%{clip-path:inset(0 0 80% 0); transform:translate(-4px,-1px)}50%{clip-path:inset(40% 0 30% 0); transform:translate(4px,1px)}100%{clip-path:inset(80% 0 0 0); transform:translate(-2px,0)}}
  .subtitle{font-family:var(--font-mono); font-size:1rem; letter-spacing:3px; color:var(--text); opacity:.6; margin-top:10px;}
  nav.tabs{position:sticky; top:0; z-index:40; display:flex; gap:2px; flex-wrap:wrap; justify-content:center; margin:0 -24px 40px; padding:12px 24px; background:linear-gradient(180deg, var(--bg) 60%, transparent); backdrop-filter:blur(8px); -webkit-text-size-adjust:100%; text-size-adjust:100%;}
  /* -webkit-text-size-adjust/text-size-adjust re-asserted here, not just
     relying on html's declaration cascading down — reported intermittent
     oversized nav text, in some browsers, that survives a refresh, is the
     signature of WebKit/Blink's mobile font-boost heuristic misfiring on
     a cluster of short flex-wrapped text runs like these pills; it's most
     likely to misbehave for exactly this element since (a) short isolated
     text in a wrapping flex row is the case that heuristic is worst at,
     and (b) this page is also loaded inside a freshly-inserted iframe
     (session-index's iframe element is recreated via innerHTML on every
     session click, not just re-pointed at a new src — see templates/
     console.js), which is a known trigger for a fresh document not
     reliably re-establishing text-size-adjust from its outer context in
     every engine. A per-site browser zoom/font-boost preference, once
     set, persists across refreshes since the browser stores it outside
     the page — explaining "doesn't reset on refresh" without there being
     any state this app itself is holding onto. */
  nav.tabs a{font-family:var(--font-mono); font-size:1rem; letter-spacing:2px; color:var(--text); opacity:.6; text-decoration:none; padding:8px 14px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.02); text-transform:uppercase; transition:.25s; -webkit-text-size-adjust:100%; text-size-adjust:100%;}
  nav.tabs a:hover{opacity:1; color:var(--bg); background:var(--accent-a); border-color:var(--accent-a);}
  /* On narrow viewports (phones, or this page embedded in the session
     browser's constrained iframe) the sticky section nav eats screen
     real estate the whole time you're reading — let it scroll past
     with the rest of the content instead of staying pinned. */
  @media(max-width:820px){nav.tabs{position:static; backdrop-filter:none;}}
  section{margin-bottom:56px; opacity:0; transform:translateY(24px); transition:opacity .7s ease, transform .7s ease;}
  section.in{opacity:1; transform:translateY(0);}
  .sechead{display:flex; align-items:baseline; gap:14px; margin-bottom:18px;}
  .sechead .num{font-family:var(--font-mono); color:var(--accent-b); font-size:1rem;}
  .sechead h2{font-family:var(--font-display); text-transform:uppercase; font-size:1.15rem; letter-spacing:3px; color:var(--text);}
  .sechead .rule{flex:1; height:1px; background:linear-gradient(90deg,rgba(255,255,255,.2),transparent);}
  .panel{background:rgba(255,255,255,.03); padding:22px; position:relative;}
  .grid-2{display:grid; grid-template-columns:1.3fr 1fr; gap:20px;}
  @media(max-width:820px){.grid-2{grid-template-columns:1fr;}}
  p.body-copy{font-size:1rem; line-height:1.75; color:var(--text); opacity:.85; margin-bottom:14px;}
  .kv{display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed rgba(255,255,255,.15); font-family:var(--font-mono); font-size:1rem;}
  .kv span:first-child{color:var(--text); opacity:.5; letter-spacing:1px;}
  .kv span:last-child{color:var(--accent-a);}
  /* Container only — background + moving parts are genre-driven, see
     templates/locationMotifs.js (injected into the page style block
     right after BASE_CSS, near the top of renderDossierPage's markup). */
  .mapbox{height:220px; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;}
  .feed{aspect-ratio:16/8; position:relative; overflow:hidden; background:linear-gradient(135deg,rgba(0,0,0,.3),rgba(255,255,255,.03)); display:flex; align-items:center; justify-content:center;}
  .feed .feedlabel{position:absolute; top:12px; left:12px; font-family:var(--font-mono); font-size:1rem; letter-spacing:2px; color:var(--accent-a); display:flex; align-items:center; gap:6px; z-index:2;}
  .feed .feedlabel .rec{width:7px; height:7px; border-radius:50%; background:#ff4f6a; animation:blink 1.1s steps(2) infinite;}
  @keyframes blink{50%{opacity:.15}}
  .threat-row{display:grid; grid-template-columns:200px 1fr 70px; align-items:center; gap:16px; padding:11px 0; border-bottom:1px solid rgba(255,255,255,.1);}
  .threat-row .label{font-family:var(--font-mono); font-size:1rem; letter-spacing:1px; color:var(--text);}
  .meter{height:8px; background:rgba(255,255,255,.08); position:relative; overflow:hidden; clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%);}
  .meter i{position:absolute; inset:0; width:0%; background:linear-gradient(90deg,var(--accent-a),var(--accent-b)); transition:width 1.4s cubic-bezier(.2,.8,.2,1);}
  .meter.high i{background:linear-gradient(90deg,#ffb84f,#ff4f6a);}
  .meter.vhigh i{background:linear-gradient(90deg,#ff4f6a,var(--accent-b));}
  .threat-row .pct{font-family:var(--font-mono); font-size:1rem; color:var(--text); opacity:.6; text-align:right;}
  .stattiles{display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:18px;}
  @media(max-width:700px){.stattiles{grid-template-columns:repeat(2,1fr);}}
  .pstat{background:rgba(255,255,255,.03); padding:16px; text-align:center; border-top:2px solid var(--accent-a);}
  .pstat .val{font-family:var(--font-display); font-size:1.6rem; color:var(--accent-b);}
  .pstat .lbl{font-family:var(--font-mono); font-size:1rem; color:var(--text); opacity:.6; letter-spacing:1px; margin-top:4px;}
  .obj{display:grid; grid-template-columns:44px 1fr auto; gap:16px; align-items:start; padding:18px; background:rgba(255,255,255,.03); margin-bottom:10px; border-left:2px solid rgba(255,255,255,.15); transition:.3s; transform:translateX(-12px); opacity:0;}
  .obj.in{transform:translateX(0); opacity:1;}
  .obj .idx{font-family:var(--font-display); font-size:1.4rem; color:var(--accent-a); opacity:.6;}
  .obj h3{font-family:var(--font-body); font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:1rem; margin-bottom:6px;}
  .obj p{color:var(--text); opacity:.7; font-size:1rem; line-height:1.5;}
  .tag{font-family:var(--font-mono); font-size:1rem; letter-spacing:2px; padding:5px 10px; border:1px solid; white-space:nowrap; height:fit-content;}
  .tag.primary{color:var(--accent-b); border-color:var(--accent-b);}
  .tag.secondary{color:#ffb84f; border-color:#ffb84f;}
  .tag.tertiary{color:var(--accent-a); border-color:var(--accent-a);}
  .gallery{display:grid; grid-template-columns:repeat(4,1fr); gap:12px;}
  @media(max-width:820px){.gallery{grid-template-columns:repeat(2,1fr);}}
  .gitem{aspect-ratio:1; position:relative; overflow:hidden; background:rgba(255,255,255,.03); cursor:pointer;}
  .gitem .gtag{position:absolute; bottom:8px; left:8px; font-family:var(--font-mono); font-size:1rem; letter-spacing:1px; color:var(--accent-a); z-index:2;}
  .gitem .gicon{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.6rem; color:var(--text); opacity:.3;}
  .audiolog{display:flex; align-items:center; gap:16px; padding:16px 20px; background:rgba(255,255,255,.03);}
  .playbtn{width:38px; height:38px; border-radius:50%; border:1px solid var(--accent-a); display:flex; align-items:center; justify-content:center; color:var(--accent-a); cursor:pointer; flex-shrink:0;}
  .waveform{display:flex; align-items:center; gap:3px; height:30px; flex:1;}
  .waveform span{width:3px; background:linear-gradient(180deg,var(--accent-a),var(--accent-b)); animation:wave 1.2s ease-in-out infinite; border-radius:2px;}
  @keyframes wave{0%,100%{height:20%;}50%{height:100%;}}
  .audiolog .meta{font-family:var(--font-mono); font-size:1rem; color:var(--text); opacity:.6; letter-spacing:1px; white-space:nowrap;}
  .logline{display:grid; grid-template-columns:auto 1fr; gap:16px; padding:10px 0; border-bottom:1px dotted rgba(255,255,255,.12); font-size:1rem;}
  .logline .ts{font-family:var(--font-mono); color:var(--accent-b); font-size:1rem; padding-top:2px;}
  .logline .entry{color:var(--text); opacity:.75;}
  footer{text-align:center; padding:50px 20px 10px; position:relative; z-index:5;}
  footer .quote{font-family:var(--font-mono); font-style:italic; color:var(--text); opacity:.7; font-size:1rem; max-width:520px; margin:0 auto 8px;}
  footer .sig{font-family:var(--font-mono); font-size:1rem; color:var(--text); opacity:.5; letter-spacing:3px;}
  footer .starlogo{width:26px; height:26px; margin:0 auto 16px; position:relative;}
  footer .starlogo::before{content:'\\2726'; color:var(--accent-a); font-size:22px; display:block; text-align:center; animation:pulse 3s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:.5; transform:scale(1);}50%{opacity:1; transform:scale(1.15);}}
`;

// Opt-in per theme (theme.ornateBorders) — swaps the plain corner-accent
// panel borders for a gilded double-line border with filigree corner
// flourishes. Built for the Ancient Asia theme's wood-and-gold look, but
// gated on the flag, not the genre name, per this file's own
// data-driven-not-genre-keyed rule — see themeToCssVars/resolveMotif.
// The flourish's gold tone is baked into the SVG itself (data URIs can't
// read CSS custom properties), so this is tuned for a gold accent
// specifically, not guaranteed to match every future theme that opts in.
const ORNATE_BORDERS_CSS = `
  body.ornate .frame{border:2px solid var(--accent-a); box-shadow:inset 0 0 0 1px var(--accent-b), 0 2px 10px rgba(0,0,0,.35);}
  body.ornate .frame::before, body.ornate .frame::after, body.ornate .frame .bl, body.ornate .frame .br{
    width:30px; height:30px; border:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M2 30 C2 14 14 2 30 2' stroke='%23D4AF37' stroke-width='1.6' fill='none'/%3E%3Cpath d='M2 22 C2 12 12 2 22 2' stroke='%23D4AF37' stroke-width='1' fill='none' opacity='.55'/%3E%3Ccircle cx='30' cy='2' r='2.1' fill='%23D4AF37'/%3E%3Ccircle cx='2' cy='30' r='1.5' fill='%23D4AF37'/%3E%3Cpath d='M7 25 Q11 21 9 17 Q7 21 3 23' stroke='%23D4AF37' stroke-width='1' fill='none' opacity='.65'/%3E%3C/svg%3E");
    background-repeat:no-repeat; opacity:.9;
  }
  body.ornate .frame::before{top:-6px; left:-6px; transform:scaleY(-1);}
  body.ornate .frame::after{top:-6px; right:-6px; transform:scale(-1,-1);}
  body.ornate .frame .bl{bottom:-6px; left:-6px;}
  body.ornate .frame .br{bottom:-6px; right:-6px; transform:scaleX(-1);}
  body.ornate .panel{
    background:repeating-linear-gradient(180deg, rgba(212,175,55,.035) 0px, rgba(212,175,55,.035) 2px, transparent 2px, transparent 7px), rgba(0,0,0,.18);
    border:1px solid rgba(212,175,55,.18);
  }
  body.ornate header.classbar{border-top:3px double var(--accent-a); border-bottom:1px solid rgba(212,175,55,.25);}
  body.ornate .sechead .rule{height:2px; background:linear-gradient(90deg, var(--accent-a), rgba(212,175,55,.1), transparent);}
  body.ornate .titleblock .eyebrow::before, body.ornate .titleblock .eyebrow::after{background:linear-gradient(90deg, transparent, var(--accent-a));}
`;

const BASE_JS = `
  window.addEventListener('load', ()=>{
    setTimeout(()=>{ document.getElementById('boot').classList.add('hide'); }, 2200);
  });

  const html = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const label = document.getElementById('themeLabel');
  // Exposed globally so the session browser (when this page is loaded in
  // its iframe, see renderCampaignIndexPage) can drive this page's theme
  // from its own toggle instead of duplicating one inside the iframe —
  // same-origin, so contentWindow.setDossierTheme(...) is a direct call,
  // no postMessage plumbing needed. Standalone (non-embedded) visits still
  // use the local toggle button, which calls this same function.
  window.setDossierTheme = function(theme){
    html.setAttribute('data-theme', theme);
    if(label) label.textContent = theme === 'light' ? 'LIGHT' : 'DARK';
    makeParticles();
    // Shared with www.criticalsandfumbles.com via a cookie scoped to the
    // parent domain (localStorage can't cross subdomains) — same cookie
    // name/domain cnf-website's ThemeProvider writes.
    document.cookie = 'cnf-theme=' + theme + '; domain=.criticalsandfumbles.com; path=/; max-age=31536000; SameSite=Lax; Secure';
  };
  if(toggle){
    toggle.addEventListener('click', ()=>{
      const isLight = html.getAttribute('data-theme') === 'light';
      window.setDossierTheme(isLight ? 'dark' : 'light');
    });
  }

  const titleEl = document.getElementById('mainTitle');
  if(titleEl){
    setInterval(()=>{
      titleEl.classList.add('glitching');
      setTimeout(()=>titleEl.classList.remove('glitching'), 260);
    }, 4200);
  }

  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
  function makeParticles(){
    const light = html.getAttribute('data-theme') === 'light';
    const count = light ? 60 : 120;
    particles = Array.from({length:count}, ()=>({
      x: Math.random()*canvas.width, y: Math.random()*canvas.height,
      r: Math.random()*1.4 + .3, s: Math.random()*.4 + .05, a: Math.random()
    }));
  }
  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const accent = getComputedStyle(html).getPropertyValue('--accent-a').trim() || '#17e9a0';
    ctx.fillStyle = accent;
    particles.forEach(p=>{
      p.a += 0.01 * (Math.random()>.5?1:-1);
      p.a = Math.max(0,Math.min(1,p.a));
      p.y += p.s * 0.4;
      if(p.y > canvas.height) p.y = 0;
      ctx.globalAlpha = p.a * 0.8;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }
  resize(); makeParticles(); animate();
  window.addEventListener('resize', ()=>{ resize(); makeParticles(); });

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('in');
        e.target.querySelectorAll('.obj').forEach((o,i)=> setTimeout(()=>o.classList.add('in'), i*90));
        e.target.querySelectorAll('.meter').forEach(m=>{
          m.querySelector('i').style.width = m.dataset.fill + '%';
        });
        io.unobserve(e.target);
      }
    });
  // threshold:.2 previously required 20% of a section's own height to
  // already be scrolled into view before it started revealing — for a
  // long section (the Log/Timeline section especially, which can run to
  // dozens of entries) that meant hundreds of px of pure blank scroll
  // between sections, since section{opacity:0} until .in is added but
  // still occupies its full layout height. rootMargin brings the trigger
  // point down near the bottom of the viewport instead, so a section
  // starts revealing as soon as it enters view, not once a fifth of it
  // already has.
  }, {threshold:0, rootMargin:'0px 0px -10% 0px'});
  document.querySelectorAll('section').forEach(s=>io.observe(s));

  document.querySelectorAll('.audiolog').forEach(log=>{
    const wf = log.querySelector('.waveform');
    for(let i=0;i<40;i++){
      const bar = document.createElement('span');
      bar.style.animationDelay = (Math.random()*1.2)+'s';
      bar.style.animationDuration = (0.7+Math.random()*0.8)+'s';
      wf.appendChild(bar);
    }
    let playing = true;
    const btn = log.querySelector('.playbtn-toggle');
    btn.addEventListener('click', function(){
      playing = !playing;
      this.textContent = playing ? '▶' : '❘❘';
      wf.style.animationPlayState = playing ? 'running':'paused';
      wf.querySelectorAll('span').forEach(s=> s.style.animationPlayState = playing?'running':'paused');
    });
  });
`;

/**
 * Per-campaign session index — GET /:campaignSlug. Genre-themed (via the
 * same themeToCssVars/resolveLabels helpers the dossier page itself uses)
 * since this is a "dossier list page," not part of the main site's own
 * chrome — see CLAUDE.md § Visual design for the split (directory "/" and
 * the console are main-site-styled; this page and the dossier page below
 * it are genre-themed).
 *
 * Ported from concepts/session-browser-concept-C-command-deck.html
 * ("Concept C: Command Deck") — structure, class names, and breakpoints
 * kept as close to that file as possible; only the mock session data and
 * the .iframe-mock placeholder were swapped for real data and a real
 * <iframe> (loading the selected dossier's own unchanged page — reusing
 * renderDossierPage as-is rather than re-implementing dossier rendering
 * inline, so the two never drift apart). Two structural additions beyond
 * the concept, both necessary for this being a real site rather than an
 * isolated mockup: a "← All Campaigns" link in the topbar (the concept
 * had no surrounding site to link back to), and the derived color-mix()
 * tokens block (the concept defined its 7 base tokens directly in :root;
 * here they come from themeToCssVars(theme) instead, so the derived
 * tokens are computed from whichever genre's tokens that resolves to,
 * not redefined per page).
 *
 * Desktop/tablet-landscape: fixed two-column layout, centered "stage"
 * capped at 1760px (1900px above 1600px) so it doesn't stretch full-
 * bleed on ultrawide monitors. Below ~1000px portrait / 760px: the list
 * becomes an off-canvas drawer opened via "☰ Sessions". Below 640px: the
 * same drawer presents as a bottom sheet instead of a full-height side
 * panel. The most recent session (dossiers is already sorted
 * most-recent-first by the caller's GROQ query) auto-selects on load.
 */
export function renderCampaignIndexPage({ campaign, dossiers, theme, colorMode = "dark" }) {
  const labels = resolveLabels(theme);
  const themeVars = themeToCssVars(theme);
  const slugJson = JSON.stringify(campaign.slug?.current || "");
  const list = dossiers || [];

  const items = list
    .map((d, i) => {
      const date = d._createdAt ? new Date(d._createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
      return `<button type="button" class="session-item${i === 0 ? " active" : ""}" data-code="${esc(d.code)}" data-title="${esc(d.title)}" data-date="${esc(date)}">
  <div class="s-title">${esc(d.title)}</div>
  <div class="s-meta"><span>${esc(d.code)}</span><span>${esc(date)}</span></div>
</button>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" data-theme="${colorMode}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(campaign.title)} — ${esc(labels.dossier || "Sessions")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(theme?.fonts?.display || "Orbitron")}:wght@600;700&family=${encodeURIComponent(theme?.fonts?.body || "Rajdhani")}:wght@400;500;600&family=${encodeURIComponent(theme?.fonts?.mono || "Share Tech Mono")}&display=swap" rel="stylesheet">
<style>
${themeVars}
:root{
  /* derived tokens -- never set these directly, they read from the 7 above
     (see themeToCssVars in lib/theme.js for --bg/--accent-a/--accent-b/
     --text/--font-display/--font-body/--font-mono) */
  --panel: color-mix(in srgb, var(--bg) 88%, var(--accent-a) 12%);
  --panel-2: color-mix(in srgb, var(--bg) 94%, var(--accent-a) 6%);
  --line: color-mix(in srgb, var(--accent-a) 22%, transparent);
  --line-strong: color-mix(in srgb, var(--accent-a) 45%, transparent);
  --text-dim: color-mix(in srgb, var(--text) 62%, var(--bg) 38%);
  --overlay: color-mix(in srgb, var(--bg) 70%, transparent);
}
*{box-sizing:border-box; margin:0; padding:0;}
html,body{height:100%;}
html{-webkit-text-size-adjust:100%; text-size-adjust:100%;}
body{background:var(--bg); color:var(--text); font-family:var(--font-body); overflow:hidden;}

.app{position:relative; z-index:5; height:100vh; height:100dvh; display:flex; flex-direction:column;}

/* ---------- TOPBAR ---------- */
.topbar{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:12px 18px; background:var(--panel-2); border-bottom:1px solid var(--line);
  flex-shrink:0;
}
.topbar-left{display:flex; align-items:center; gap:14px; min-width:0;}
.back-link{flex-shrink:0; font-family:var(--font-mono); font-size:11px; letter-spacing:1px; color:var(--text-dim); text-decoration:none;}
.back-link:hover{color:var(--accent-a);}
.topbar h1{font-family:var(--font-display); font-size:.95rem; letter-spacing:2px; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.topbar h1 span{color:var(--accent-a);}
.deck-btn{
  display:none; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px;
  letter-spacing:1px; text-transform:uppercase; color:var(--bg); background:var(--accent-a);
  border:1px solid var(--accent-a); padding:8px 14px; cursor:pointer; flex-shrink:0;
}
.deck-btn b{font-family:var(--font-display); font-size:12px;}

/* ---------- PANES (desktop/tablet default: fixed two-column, centered stage) ---------- */
.stage{flex:1; min-height:0; max-width:1760px; width:100%; margin:0 auto; display:flex; position:relative;}

.panes{flex:1; min-height:0; display:flex; width:100%;}

.list-pane{
  width:clamp(260px, 24vw, 360px); flex-shrink:0;
  display:flex; flex-direction:column; min-height:0;
  border-right:1px solid var(--line); background:var(--panel);
}
.list-head{
  padding:14px 16px; font-family:var(--font-mono); font-size:10.5px; letter-spacing:2px;
  color:var(--text-dim); border-bottom:1px solid var(--line); flex-shrink:0;
  display:flex; align-items:center; justify-content:space-between;
}
.list-head .close-deck{display:none; background:none; border:none; color:var(--text-dim); font-family:var(--font-mono); font-size:16px; cursor:pointer;}
.list-head-text{overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.list-head-controls{display:flex; align-items:center; gap:8px; flex-shrink:0;}
/* Small icon toggle, moved here from the dossier page's own floating
   text-label button (top-right of the standalone page) — this is the
   one control for both this page's chrome and the embedded dossier
   iframe's theme, see the script block below and renderDossierPage's
   window.setDossierTheme(). */
.icon-btn{display:flex; align-items:center; justify-content:center; width:26px; height:26px; flex-shrink:0; background:none; border:1px solid var(--line); border-radius:4px; color:var(--text-dim); cursor:pointer; padding:0; transition:.15s;}
.icon-btn:hover{color:var(--accent-a); border-color:var(--accent-a);}
.icon-btn svg{width:14px; height:14px; display:block;}
.icon-btn .icon-moon{display:none;}
html[data-theme="light"] .icon-btn .icon-sun{display:none;}
html[data-theme="light"] .icon-btn .icon-moon{display:block;}
.list-scroll{overflow-y:auto; flex:1; min-height:0;}

.session-item{
  width:100%; display:block; text-align:left; background:none; border:none;
  border-bottom:1px solid var(--line); border-left:3px solid transparent;
  padding:12px 16px; cursor:pointer; color:var(--text); font-family:var(--font-body);
  transition:.15s;
}
.session-item:hover{background:var(--panel-2);}
.session-item.active{border-left-color:var(--accent-a); background:var(--panel-2);}
.session-item .s-title{font-weight:600; font-size:.95rem; margin-bottom:4px;}
.session-item .s-meta{
  display:flex; justify-content:space-between; gap:8px;
  font-family:var(--font-mono); font-size:10px; letter-spacing:.5px; color:var(--text-dim);
}
.session-item.active .s-meta{color:var(--accent-a);}
.empty{padding:16px; opacity:.6; font-family:var(--font-mono); font-size:.75rem;}

/* flex column, not overflow:auto — the iframe fills all remaining
   vertical space itself (flex:1 below) and scrolls its own content
   internally, rather than being capped at a fixed height that leaves
   empty space beneath it on tall/widescreen viewports. */
.detail-pane{flex:1; min-width:0; overflow:hidden; padding:clamp(20px,3vw,44px); display:flex; flex-direction:column;}
/* No max-width here on purpose — the iframe's own document (renderDossierPage's
   .wrap) already caps its prose at a readable width internally, so capping this
   outer wrapper too just doubled up and left a growing empty gutter on wide
   screens instead of letting the iframe fill the pane. */
.detail-inner{width:100%; margin:0 auto; display:flex; flex-direction:column; flex:1; min-height:0;}

.detail-title{font-family:var(--font-display); font-size:clamp(1.3rem,2.4vw,1.9rem); letter-spacing:1px; margin-bottom:6px; flex-shrink:0;}
.detail-meta{font-family:var(--font-mono); font-size:11px; letter-spacing:1px; color:var(--text-dim); margin-bottom:22px; display:flex; gap:18px; flex-wrap:wrap; flex-shrink:0;}
.detail-meta b{color:var(--accent-a);}

.detail-frame{width:100%; flex:1; min-height:0; border:1px solid var(--line); background:var(--panel); display:block;}

.empty-state{
  flex:1; min-height:0; width:100%; border:1px dashed var(--line-strong);
  background:var(--panel); display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:8px; color:var(--text-dim); font-family:var(--font-mono); font-size:11px; letter-spacing:1px;
  text-align:center; padding:20px;
}

/* Scrim used by the drawer/bottom-sheet on phone and the slide-out on tablet portrait */
.scrim{
  display:none; position:fixed; inset:0; background:var(--overlay);
  backdrop-filter:blur(2px); z-index:20;
}
.app[data-deck="open"] .scrim{display:block;}

/* ---------- RESPONSIVE ---------- */

/* Tablet portrait: list becomes a slide-out drawer from the left, full detail behind it */
@media (max-width:1000px) and (orientation:portrait), (max-width:760px){
  .deck-btn{display:inline-flex;}
  .stage{max-width:none;}
  .list-pane{
    position:fixed; top:0; bottom:0; left:0; width:min(340px, 82vw);
    z-index:21; transform:translateX(-100%); transition:transform .22s ease;
    border-right:1px solid var(--line-strong);
  }
  .list-head .close-deck{display:block;}
  .app[data-deck="open"] .list-pane{transform:translateX(0);}
  .detail-pane{width:100%;}
}

/* Phone: same slide-out drawer, but presented as a bottom sheet (feels closer to a
   thumb-reachable action on a small screen) instead of a full-height side drawer */
@media (max-width:640px){
  .topbar h1{font-size:.8rem;}
  .list-pane{
    top:auto; left:0; right:0; bottom:0; width:100%; height:78vh; height:78dvh;
    border-right:none; border-top:1px solid var(--line-strong);
    transform:translateY(100%); border-radius:14px 14px 0 0;
  }
  .app[data-deck="open"] .list-pane{transform:translateY(0);}
  .list-head{position:relative;}
  .list-head::before{
    content:''; position:absolute; top:8px; left:50%; transform:translateX(-50%);
    width:36px; height:4px; border-radius:2px; background:var(--line-strong);
  }
  .list-head{padding-top:20px;}
  .detail-pane{padding:18px;}
}

/* Large desktop / 1440p+: keep the stage from thinning out into a sea of empty
   side-gutters -- widen the cap and give the detail column more breathing room
   rather than letting either pane stretch full-bleed */
@media (min-width:1600px){
  .stage{max-width:1900px;}
  .list-pane{width:clamp(300px, 18vw, 380px);}
  .detail-pane{padding:56px;}
}
.grain{position:fixed; inset:0; z-index:1; pointer-events:none; mix-blend-mode:overlay; opacity:.05;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.scanlines{position:fixed; inset:0; z-index:2; pointer-events:none; background:repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.12) 3px, rgba(0,0,0,0) 4px); animation:scandrift 9s linear infinite; opacity:.35;}
@keyframes scandrift{0%{background-position-y:0;}100%{background-position-y:200px;}}
.vignette{position:fixed; inset:0; z-index:2; pointer-events:none; background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.55) 100%);}
/* Vignette is a dark-mode-only effect — see dossier.js's same rule. */
html[data-theme="light"] .vignette{opacity:0;}
</style>
</head>
<body>

<div class="grain"></div>
<div class="scanlines"></div>
<div class="vignette"></div>

<div class="app" id="app" data-deck="closed">
  <header class="topbar">
    <div class="topbar-left">
      <a class="back-link" href="/">&larr; All Campaigns</a>
      <h1><span>//</span> ${esc(campaign.title)}</h1>
    </div>
    <button class="deck-btn" id="openDeck"><b>&#9776;</b> Sessions</button>
  </header>

  <div class="stage">
    <div class="panes">
      <aside class="list-pane">
        <div class="list-head">
          <span class="list-head-text">SESSION LOG — ${list.length} ENTR${list.length === 1 ? "Y" : "IES"}</span>
          <div class="list-head-controls">
            <button class="icon-btn" id="themeToggle" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
              <svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
              <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            </button>
            <button class="close-deck" id="closeDeck">&#10005;</button>
          </div>
        </div>
        <div class="list-scroll" id="listScroll">${items || `<p class="empty">No sessions published yet.</p>`}</div>
      </aside>

      <section class="detail-pane">
        <div class="detail-inner" id="detailInner"></div>
      </section>
    </div>
  </div>

  <div class="scrim" id="scrim"></div>
</div>

<script>
  const SLUG = ${slugJson};
  const listScroll = document.getElementById('listScroll');
  const detailInner = document.getElementById('detailInner');
  const appEl = document.getElementById('app');
  const htmlEl = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');

  function openDeck(){ appEl.setAttribute('data-deck', 'open'); }
  function closeDeck(){ appEl.setAttribute('data-deck', 'closed'); }

  // One toggle drives both this page's own chrome AND the embedded
  // dossier iframe's theme — same-origin, so contentWindow.setDossierTheme
  // (exposed by renderDossierPage) is a direct call, no postMessage
  // plumbing needed. Applied on toggle click AND whenever a new iframe
  // finishes loading (each session click replaces detailInner's iframe
  // with a fresh one, which always starts server-rendered dark).
  function currentTheme(){ return htmlEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function syncFrameTheme(){
    const frame = detailInner.querySelector('.detail-frame');
    if(frame && frame.contentWindow && typeof frame.contentWindow.setDossierTheme === 'function'){
      frame.contentWindow.setDossierTheme(currentTheme());
    }
  }
  themeToggle.addEventListener('click', ()=>{
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    htmlEl.setAttribute('data-theme', next);
    syncFrameTheme();
    // Shared with www.criticalsandfumbles.com — see setDossierTheme's
    // matching comment in the dossier page template for why this needs
    // a cookie rather than localStorage.
    document.cookie = 'cnf-theme=' + next + '; domain=.criticalsandfumbles.com; path=/; max-age=31536000; SameSite=Lax; Secure';
  });

  function renderDetail(item){
    if(!item){
      detailInner.innerHTML = '<div class="empty-state"><strong>NO SESSIONS YET</strong><span>Sessions published to this campaign will appear here.</span></div>';
      return;
    }
    const code = item.dataset.code, title = item.dataset.title, date = item.dataset.date;
    detailInner.innerHTML =
      '<div class="detail-title">' + title + '</div>' +
      '<div class="detail-meta"><span>CODE <b>' + code + '</b></span>' + (date ? '<span>DATE <b>' + date + '</b></span>' : '') + '</div>' +
      '<iframe class="detail-frame" title="Session detail" src="/' + encodeURIComponent(SLUG) + '/' + encodeURIComponent(code) + '?embed=1"></iframe>';
    detailInner.querySelector('.detail-frame').addEventListener('load', syncFrameTheme);
  }

  function selectItem(item){
    listScroll.querySelectorAll('.session-item').forEach(i=> i.classList.remove('active'));
    item.classList.add('active');
    renderDetail(item);
    closeDeck();
  }

  listScroll.querySelectorAll('.session-item').forEach(item=>{
    item.addEventListener('click', ()=> selectItem(item));
  });

  document.getElementById('openDeck').addEventListener('click', openDeck);
  document.getElementById('closeDeck').addEventListener('click', closeDeck);
  document.getElementById('scrim').addEventListener('click', closeDeck);

  renderDetail(listScroll.querySelector('.session-item.active'));
</script>
</body>
</html>`;
}
