/**
 * Port of campaign-dossier-concept.html (+ its fantasy/horror/modern
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
import { themeToCssVars, resolveLabels, resolveMotif } from "../lib/theme.js";
import { renderMotif } from "./motifs.js";
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

export function renderDossierPage({ dossier, campaign, theme }) {
  const labels = resolveLabels(theme);
  const motifKey = resolveMotif(theme);
  const code = dossier.code || "";
  const bootTitle = theme?.loadingScreen?.bootTitle || "LOADING";
  const bootSubtitle = theme?.loadingScreen?.bootSubtitle || "PLEASE WAIT";
  const motif = renderMotif(motifKey, bootTitle, bootSubtitle, code);

  const heroUrl = dossier.heroImage
    ? urlFor(dossier.heroImage).width(1600).height(800).url()
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
<html lang="en" data-theme="dark">
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
</style>
</head>
<body>

<div id="boot">
  ${motif.html}
</div>

<canvas id="particles"></canvas>
<div class="grain"></div>
<div class="scanlines"></div>
<div class="vignette"></div>

<button id="themeToggle"><span class="dot"></span><span id="themeLabel">DARK</span></button>

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
          <div class="sweep"></div>
          <div class="rings"></div>
          <div class="ping"></div>
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
  html{scroll-behavior:smooth;}
  body{background:var(--bg); color:var(--text); font-family:var(--font-body); overflow-x:hidden; transition:background .6s ease, color .6s ease; position:relative;}
  #particles{position:fixed; inset:0; z-index:0; pointer-events:none; opacity:.8;}
  .grain{position:fixed; inset:0; z-index:1; pointer-events:none; mix-blend-mode:overlay; opacity:.05;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
  .scanlines{position:fixed; inset:0; z-index:2; pointer-events:none; background:repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.12) 3px, rgba(0,0,0,0) 4px); animation:scandrift 9s linear infinite; opacity:.35;}
  @keyframes scandrift{0%{background-position-y:0;}100%{background-position-y:200px;}}
  .vignette{position:fixed; inset:0; z-index:2; pointer-events:none; background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.55) 100%);}
  #boot{position:fixed; inset:0; z-index:999; background:#000; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; font-family:var(--font-mono); color:var(--accent-a); transition:opacity .8s ease, visibility .8s ease;}
  #boot.hide{opacity:0; visibility:hidden;}
  #boot .bootbar{width:min(420px,70vw); height:3px; background:rgba(255,255,255,.08); position:relative; overflow:hidden;}
  #boot .bootbar::after{content:''; position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg,var(--accent-a),var(--accent-b)); animation:bootfill 2.4s cubic-bezier(.3,.9,.4,1) forwards;}
  @keyframes bootfill{0%{width:0%}100%{width:100%}}
  #themeToggle{position:fixed; top:18px; right:18px; z-index:60; display:flex; align-items:center; gap:10px; background:rgba(0,0,0,.4); border:1px solid var(--accent-a); padding:8px 14px; cursor:pointer; font-family:var(--font-mono); font-size:10px; letter-spacing:2px; color:var(--text); backdrop-filter:blur(6px);}
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
  .classbar .orgtext{font-family:var(--font-mono); font-size:10px; letter-spacing:3px; color:var(--text); opacity:.7; line-height:1.5;}
  .classbar .orgtext b{color:var(--text); font-family:var(--font-display); letter-spacing:1px; opacity:1;}
  .classbar .right{display:flex; gap:22px; font-family:var(--font-mono); font-size:10px; color:var(--text); opacity:.7; letter-spacing:1px; text-align:right;}
  .classbar .right .k{color:var(--accent-b); opacity:1;}
  .titleblock{margin:34px 0 40px; text-align:center;}
  .titleblock .eyebrow{font-family:var(--font-mono); font-size:12px; letter-spacing:8px; color:var(--accent-a); display:flex; align-items:center; justify-content:center; gap:14px; margin-bottom:14px;}
  .titleblock .eyebrow::before,.titleblock .eyebrow::after{content:''; height:1px; width:60px; background:linear-gradient(90deg,transparent,var(--accent-a));}
  .titleblock .eyebrow::after{background:linear-gradient(90deg,var(--accent-a),transparent);}
  h1.title{font-family:var(--font-display); font-weight:900; text-transform:uppercase; font-size:clamp(2rem,6vw,4.2rem); letter-spacing:2px; line-height:1.05; color:var(--text); position:relative; display:inline-block;}
  h1.title .glitch-layer{position:absolute; inset:0; color:var(--accent-b); opacity:0;}
  h1.title.glitching .glitch-layer{opacity:.7; animation:glitchmove .18s steps(2) 3;}
  @keyframes glitchmove{0%{clip-path:inset(0 0 80% 0); transform:translate(-4px,-1px)}50%{clip-path:inset(40% 0 30% 0); transform:translate(4px,1px)}100%{clip-path:inset(80% 0 0 0); transform:translate(-2px,0)}}
  .subtitle{font-family:var(--font-mono); font-size:12px; letter-spacing:3px; color:var(--text); opacity:.6; margin-top:10px;}
  nav.tabs{position:sticky; top:0; z-index:40; display:flex; gap:2px; flex-wrap:wrap; justify-content:center; margin:0 -24px 40px; padding:12px 24px; background:linear-gradient(180deg, var(--bg) 60%, transparent); backdrop-filter:blur(8px);}
  nav.tabs a{font-family:var(--font-mono); font-size:10.5px; letter-spacing:2px; color:var(--text); opacity:.6; text-decoration:none; padding:8px 14px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.02); text-transform:uppercase; transition:.25s;}
  nav.tabs a:hover{opacity:1; color:var(--bg); background:var(--accent-a); border-color:var(--accent-a);}
  section{margin-bottom:56px; opacity:0; transform:translateY(24px); transition:opacity .7s ease, transform .7s ease;}
  section.in{opacity:1; transform:translateY(0);}
  .sechead{display:flex; align-items:baseline; gap:14px; margin-bottom:18px;}
  .sechead .num{font-family:var(--font-mono); color:var(--accent-b); font-size:13px;}
  .sechead h2{font-family:var(--font-display); text-transform:uppercase; font-size:1.15rem; letter-spacing:3px; color:var(--text);}
  .sechead .rule{flex:1; height:1px; background:linear-gradient(90deg,rgba(255,255,255,.2),transparent);}
  .panel{background:rgba(255,255,255,.03); padding:22px; position:relative;}
  .grid-2{display:grid; grid-template-columns:1.3fr 1fr; gap:20px;}
  @media(max-width:820px){.grid-2{grid-template-columns:1fr;}}
  p.body-copy{font-size:1rem; line-height:1.75; color:var(--text); opacity:.85; margin-bottom:14px;}
  .kv{display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed rgba(255,255,255,.15); font-family:var(--font-mono); font-size:11.5px;}
  .kv span:first-child{color:var(--text); opacity:.5; letter-spacing:1px;}
  .kv span:last-child{color:var(--accent-a);}
  .mapbox{height:220px; position:relative; overflow:hidden; background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.04), rgba(0,0,0,.2) 70%); display:flex; align-items:center; justify-content:center;}
  .mapbox .rings{position:absolute; width:180px; height:180px; border-radius:50%; border:1px solid rgba(255,255,255,.15);}
  .mapbox .rings::before,.mapbox .rings::after{content:''; position:absolute; inset:20px; border:1px solid rgba(255,255,255,.15); border-radius:50%;}
  .mapbox .ping{width:10px; height:10px; border-radius:50%; background:var(--accent-b); box-shadow:0 0 0 0 var(--accent-b); animation:ping 2s ease-out infinite;}
  @keyframes ping{0%{box-shadow:0 0 0 0 rgba(255,79,174,.6)}70%{box-shadow:0 0 0 26px rgba(255,79,174,0)}100%{box-shadow:0 0 0 0 rgba(255,79,174,0)}}
  .mapbox .sweep{position:absolute; inset:0; background:conic-gradient(from 0deg, transparent 0deg, var(--accent-a) 8deg, transparent 40deg); animation:sweep 4s linear infinite; opacity:.5; mix-blend-mode:screen;}
  @keyframes sweep{to{transform:rotate(360deg)}}
  .feed{aspect-ratio:16/8; position:relative; overflow:hidden; background:linear-gradient(135deg,rgba(0,0,0,.3),rgba(255,255,255,.03)); display:flex; align-items:center; justify-content:center;}
  .feed .feedlabel{position:absolute; top:12px; left:12px; font-family:var(--font-mono); font-size:10px; letter-spacing:2px; color:var(--accent-a); display:flex; align-items:center; gap:6px; z-index:2;}
  .feed .feedlabel .rec{width:7px; height:7px; border-radius:50%; background:#ff4f6a; animation:blink 1.1s steps(2) infinite;}
  @keyframes blink{50%{opacity:.15}}
  .threat-row{display:grid; grid-template-columns:200px 1fr 70px; align-items:center; gap:16px; padding:11px 0; border-bottom:1px solid rgba(255,255,255,.1);}
  .threat-row .label{font-family:var(--font-mono); font-size:11.5px; letter-spacing:1px; color:var(--text);}
  .meter{height:8px; background:rgba(255,255,255,.08); position:relative; overflow:hidden; clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%);}
  .meter i{position:absolute; inset:0; width:0%; background:linear-gradient(90deg,var(--accent-a),var(--accent-b)); transition:width 1.4s cubic-bezier(.2,.8,.2,1);}
  .meter.high i{background:linear-gradient(90deg,#ffb84f,#ff4f6a);}
  .meter.vhigh i{background:linear-gradient(90deg,#ff4f6a,var(--accent-b));}
  .threat-row .pct{font-family:var(--font-mono); font-size:11px; color:var(--text); opacity:.6; text-align:right;}
  .stattiles{display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:18px;}
  @media(max-width:700px){.stattiles{grid-template-columns:repeat(2,1fr);}}
  .pstat{background:rgba(255,255,255,.03); padding:16px; text-align:center; border-top:2px solid var(--accent-a);}
  .pstat .val{font-family:var(--font-display); font-size:1.6rem; color:var(--accent-b);}
  .pstat .lbl{font-family:var(--font-mono); font-size:10px; color:var(--text); opacity:.6; letter-spacing:1px; margin-top:4px;}
  .obj{display:grid; grid-template-columns:44px 1fr auto; gap:16px; align-items:start; padding:18px; background:rgba(255,255,255,.03); margin-bottom:10px; border-left:2px solid rgba(255,255,255,.15); transition:.3s; transform:translateX(-12px); opacity:0;}
  .obj.in{transform:translateX(0); opacity:1;}
  .obj .idx{font-family:var(--font-display); font-size:1.4rem; color:var(--accent-a); opacity:.6;}
  .obj h3{font-family:var(--font-body); font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:.98rem; margin-bottom:6px;}
  .obj p{color:var(--text); opacity:.7; font-size:.9rem; line-height:1.5;}
  .tag{font-family:var(--font-mono); font-size:9.5px; letter-spacing:2px; padding:5px 10px; border:1px solid; white-space:nowrap; height:fit-content;}
  .tag.primary{color:var(--accent-b); border-color:var(--accent-b);}
  .tag.secondary{color:#ffb84f; border-color:#ffb84f;}
  .tag.tertiary{color:var(--accent-a); border-color:var(--accent-a);}
  .gallery{display:grid; grid-template-columns:repeat(4,1fr); gap:12px;}
  @media(max-width:820px){.gallery{grid-template-columns:repeat(2,1fr);}}
  .gitem{aspect-ratio:1; position:relative; overflow:hidden; background:rgba(255,255,255,.03); cursor:pointer;}
  .gitem .gtag{position:absolute; bottom:8px; left:8px; font-family:var(--font-mono); font-size:9px; letter-spacing:1px; color:var(--accent-a); z-index:2;}
  .gitem .gicon{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.6rem; color:var(--text); opacity:.3;}
  .audiolog{display:flex; align-items:center; gap:16px; padding:16px 20px; background:rgba(255,255,255,.03);}
  .playbtn{width:38px; height:38px; border-radius:50%; border:1px solid var(--accent-a); display:flex; align-items:center; justify-content:center; color:var(--accent-a); cursor:pointer; flex-shrink:0;}
  .waveform{display:flex; align-items:center; gap:3px; height:30px; flex:1;}
  .waveform span{width:3px; background:linear-gradient(180deg,var(--accent-a),var(--accent-b)); animation:wave 1.2s ease-in-out infinite; border-radius:2px;}
  @keyframes wave{0%,100%{height:20%;}50%{height:100%;}}
  .audiolog .meta{font-family:var(--font-mono); font-size:10px; color:var(--text); opacity:.6; letter-spacing:1px; white-space:nowrap;}
  .logline{display:grid; grid-template-columns:110px 1fr; gap:16px; padding:10px 0; border-bottom:1px dotted rgba(255,255,255,.12); font-size:.92rem;}
  .logline .ts{font-family:var(--font-mono); color:var(--accent-b); font-size:10.5px; padding-top:2px;}
  .logline .entry{color:var(--text); opacity:.75;}
  footer{text-align:center; padding:50px 20px 10px; position:relative; z-index:5;}
  footer .quote{font-family:var(--font-mono); font-style:italic; color:var(--text); opacity:.7; font-size:.9rem; max-width:520px; margin:0 auto 8px;}
  footer .sig{font-family:var(--font-mono); font-size:10px; color:var(--text); opacity:.5; letter-spacing:3px;}
  footer .starlogo{width:26px; height:26px; margin:0 auto 16px; position:relative;}
  footer .starlogo::before{content:'\\2726'; color:var(--accent-a); font-size:22px; display:block; text-align:center; animation:pulse 3s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:.5; transform:scale(1);}50%{opacity:1; transform:scale(1.15);}}
`;

const BASE_JS = `
  window.addEventListener('load', ()=>{
    setTimeout(()=>{ document.getElementById('boot').classList.add('hide'); }, 2200);
  });

  const html = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const label = document.getElementById('themeLabel');
  toggle.addEventListener('click', ()=>{
    const isLight = html.getAttribute('data-theme') === 'light';
    html.setAttribute('data-theme', isLight ? 'dark' : 'light');
    label.textContent = isLight ? 'DARK' : 'LIGHT';
    makeParticles();
  });

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
  }, {threshold:.2});
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
 * Two-pane layout: left is the session list (already sorted most-recent-
 * first by the caller's GROQ query), right is an <iframe> that loads the
 * selected dossier's own full page unchanged — reusing renderDossierPage
 * as-is rather than re-implementing dossier rendering inline, so the two
 * never drift apart. The most recent session auto-selects on load so the
 * right pane isn't empty by default.
 */
export function renderCampaignIndexPage({ campaign, dossiers, theme }) {
  const labels = resolveLabels(theme);
  const themeVars = themeToCssVars(theme);
  const slugJson = JSON.stringify(campaign.slug?.current || "");

  const items = (dossiers || [])
    .map((d, i) => {
      const date = d._createdAt ? new Date(d._createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
      return `<button type="button" class="session-item${i === 0 ? " active" : ""}" data-code="${esc(d.code)}">
  <span class="s-title">${esc(d.sessionLabel || d.code)} — ${esc(d.title)}</span>
  <span class="s-meta"><span>${esc(d.code)}</span>${date ? `<span>${esc(date)}</span>` : ""}</span>
</button>`;
    })
    .join("\n");

  const firstCode = dossiers && dossiers[0] ? dossiers[0].code : null;

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(campaign.title)} — ${esc(labels.dossier || "Sessions")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&family=Share%20Tech%20Mono&display=swap" rel="stylesheet">
<style>
${themeVars}
*{box-sizing:border-box; margin:0; padding:0;}
html,body{height:100%;}
body{background:var(--bg); color:var(--text); font-family:var(--font-body); overflow:hidden;}
.shell{display:grid; grid-template-columns:340px 1fr; height:100vh;}
@media(max-width:820px){.shell{grid-template-columns:1fr; height:auto;}
  .detail-pane{height:70vh;}}
.list-pane{border-right:1px solid rgba(255,255,255,.12); padding:22px 18px; overflow-y:auto;}
.back-link{display:inline-block; font-family:var(--font-mono); font-size:.75rem; color:var(--text); opacity:.6; text-decoration:none; margin-bottom:14px;}
.back-link:hover{opacity:1; color:var(--accent-a);}
.list-pane h1{font-family:var(--font-display); font-size:1.6rem; letter-spacing:.02em; margin-bottom:.35rem;}
.hook{opacity:.75; font-size:.9rem; margin-bottom:.5rem;}
.meta-line{display:flex; gap:10px; font-family:var(--font-mono); font-size:.7rem; opacity:.6; margin-bottom:18px; text-transform:uppercase; letter-spacing:.05em;}
.session-item{display:block; width:100%; text-align:left; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.12); border-radius:6px; padding:12px 14px; margin-bottom:10px; color:var(--text); cursor:pointer; font-family:var(--font-body); transition:border-color .15s ease, background .15s ease;}
.session-item:hover{border-color:var(--accent-a);}
.session-item.active{border-color:var(--accent-a); background:rgba(255,255,255,.06);}
.s-title{display:block; font-size:.95rem; margin-bottom:6px;}
.s-meta{display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:.65rem; opacity:.55; letter-spacing:.03em;}
.empty{opacity:.5; font-family:var(--font-mono); font-size:.8rem;}
.detail-pane{position:relative; height:100%;}
.detail-pane iframe{width:100%; height:100%; border:none; display:none;}
.empty-state{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:.85rem; opacity:.4; text-align:center; padding:2rem;}
</style>
</head>
<body>
<div class="shell">
  <aside class="list-pane">
    <a class="back-link" href="/">&larr; All Campaigns</a>
    <h1>${esc(campaign.title)}</h1>
    ${campaign.hook ? `<p class="hook">${esc(campaign.hook)}</p>` : ""}
    <div class="meta-line"><span>${esc(campaign.system || "")}</span><span>${esc(campaign.status || "")}</span></div>
    ${items || `<p class="empty">No sessions published yet.</p>`}
  </aside>
  <main class="detail-pane">
    <iframe id="dossierFrame" title="Session detail"></iframe>
    <div class="empty-state" id="emptyState">Select a session to view its dossier.</div>
  </main>
</div>
<script>
  const SLUG = ${slugJson};
  const frame = document.getElementById('dossierFrame');
  const empty = document.getElementById('emptyState');
  const items = document.querySelectorAll('.session-item');

  function select(code){
    items.forEach(i=>i.classList.toggle('active', i.dataset.code===code));
    frame.src = '/' + encodeURIComponent(SLUG) + '/' + encodeURIComponent(code);
    frame.style.display = 'block';
    empty.style.display = 'none';
  }
  items.forEach(item=>{
    item.addEventListener('click', ()=> select(item.dataset.code));
  });
  ${firstCode ? `select(${JSON.stringify(firstCode)});` : ""}
</script>
</body>
</html>`;
}
