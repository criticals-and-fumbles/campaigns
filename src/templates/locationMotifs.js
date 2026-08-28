/**
 * Location-section decorative visuals — reusable modules, selected by
 * `theme.locationMotif`, NOT hardcoded per genre/campaign name (same
 * rule as loading-screen motifs.js, see CLAUDE.md § Data model). Sits
 * inside the Location section's left panel (`.mapbox`), pure CSS
 * animation, no JS needed for any of these — matches the original
 * radar-sweep implementation's own simplicity.
 *
 *   radar-sweep      — sci-fi: rotating sonar sweep + concentric rings + ping
 *   parchment-map    — fantasy: wavering compass needle + candlelit glow
 *   static-scan      — horror: VHS-style tracking bar + glitch flicker
 *   grid-scan        — modern: GPS/security grid + scanning line + reticle
 *   end-of-broadcast — apocalyptic: dense flickering TV static + rolling
 *                      bar + a "NO SIGNAL" caption blinking through it,
 *                      much more literal/full-bleed than static-scan's
 *                      subtle VHS tracking — a distinct look, not a
 *                      louder version of an existing one.
 *   shadow-lantern   — ancient asia (unused default as of 2026-08-29,
 *                      kept as a selectable option): lamplit rose-
 *                      compass, a filigree cross pattern behind the
 *                      compass rose + swaying needle.
 *   naga             — ancient asia (unused default as of 2026-08-29,
 *                      kept as a selectable option): the SAME serpent-
 *                      dragon silhouette as motifs.js's "naga" boot
 *                      motif (identical SVG path data) + lamp glow +
 *                      a slow coiling sway.
 *   scroll-unfurl    — ancient asia: the SAME scroll-and-wax-seal
 *                      artwork as motifs.js's "scroll-unfurl" boot motif
 *                      (identical SVG markup, on purpose — see that
 *                      file's comment) + lamp glow + the same unroll/
 *                      reseal loop. Current Ancient Asia default as of
 *                      2026-08-29.
 *
 * Each entry provides `html` (the .mapbox inner markup) and `css`
 * (.mapbox-scoped rules — the container's own size/position/overflow
 * lives in dossier.js's BASE_CSS, only the background + moving parts
 * are motif-specific).
 */

export const LOCATION_MOTIFS = {
  "radar-sweep": {
    html: `
      <div class="sweep"></div>
      <div class="rings"></div>
      <div class="ping"></div>
    `,
    css: `
      .mapbox{background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.04), rgba(0,0,0,.2) 70%);}
      .mapbox .rings{position:absolute; width:180px; height:180px; border-radius:50%; border:1px solid rgba(255,255,255,.15);}
      .mapbox .rings::before,.mapbox .rings::after{content:''; position:absolute; inset:20px; border:1px solid rgba(255,255,255,.15); border-radius:50%;}
      .mapbox .ping{width:10px; height:10px; border-radius:50%; background:var(--accent-b); box-shadow:0 0 0 0 var(--accent-b); animation:locping 2s ease-out infinite;}
      @keyframes locping{0%{box-shadow:0 0 0 0 rgba(255,79,174,.6)}70%{box-shadow:0 0 0 26px rgba(255,79,174,0)}100%{box-shadow:0 0 0 0 rgba(255,79,174,0)}}
      .mapbox .sweep{position:absolute; inset:0; background:conic-gradient(from 0deg, transparent 0deg, var(--accent-a) 8deg, transparent 40deg); animation:locsweep 4s linear infinite; opacity:.5; mix-blend-mode:screen;}
      @keyframes locsweep{to{transform:rotate(360deg)}}
    `,
  },

  "parchment-map": {
    html: `
      <div class="compass">
        <div class="needle"></div>
        <span class="point n">N</span><span class="point s">S</span><span class="point e">E</span><span class="point w">W</span>
      </div>
      <div class="glow"></div>
    `,
    css: `
      .mapbox{background:radial-gradient(circle at 40% 35%, rgba(255,255,255,.05), rgba(0,0,0,.25) 75%);}
      .mapbox .glow{position:absolute; width:140px; height:140px; border-radius:50%; background:radial-gradient(circle, var(--accent-b) 0%, transparent 70%); opacity:.18; animation:locflicker 3.2s ease-in-out infinite;}
      @keyframes locflicker{0%,100%{opacity:.14; transform:scale(1);}45%{opacity:.24; transform:scale(1.04);}60%{opacity:.1;}}
      .mapbox .compass{position:relative; width:120px; height:120px; border:1px solid rgba(255,255,255,.2); border-radius:50%;}
      .mapbox .compass::before{content:''; position:absolute; inset:14px; border:1px solid rgba(255,255,255,.12); border-radius:50%;}
      .mapbox .compass .point{position:absolute; font-family:var(--font-mono); font-size:9px; letter-spacing:1px; color:var(--text); opacity:.5;}
      .mapbox .compass .point.n{top:2px; left:50%; transform:translateX(-50%);}
      .mapbox .compass .point.s{bottom:2px; left:50%; transform:translateX(-50%);}
      .mapbox .compass .point.e{right:2px; top:50%; transform:translateY(-50%);}
      .mapbox .compass .point.w{left:2px; top:50%; transform:translateY(-50%);}
      .mapbox .compass .needle{position:absolute; left:50%; top:50%; width:2px; height:44px; margin:-44px 0 0 -1px; transform-origin:50% 44px; background:linear-gradient(to top, var(--accent-a), transparent); animation:locwaver 5s ease-in-out infinite;}
      @keyframes locwaver{0%,100%{transform:rotate(-9deg);}50%{transform:rotate(9deg);}}
    `,
  },

  "static-scan": {
    html: `
      <div class="tracking"></div>
      <div class="noise"></div>
      <div class="glitchping"></div>
    `,
    css: `
      .mapbox{background:linear-gradient(160deg, rgba(0,0,0,.35), rgba(255,255,255,.02));}
      .mapbox .noise{position:absolute; inset:0; opacity:.05; mix-blend-mode:overlay; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
      .mapbox .tracking{position:absolute; left:0; right:0; height:26px; background:linear-gradient(var(--accent-b), transparent); mix-blend-mode:screen; opacity:.4; animation:loctrackingsweep 3.6s linear infinite;}
      @keyframes loctrackingsweep{0%{top:-26px;}100%{top:100%;}}
      .mapbox .glitchping{position:absolute; width:8px; height:8px; background:var(--accent-a); box-shadow:0 0 8px var(--accent-a); animation:locglitch 2.4s steps(1) infinite;}
      @keyframes locglitch{0%,100%{opacity:0;}4%{opacity:1; transform:translate(0,0);}6%{opacity:0;}48%{opacity:0;}52%{opacity:1; transform:translate(6px,-4px);}54%{opacity:0;}}
    `,
  },

  "grid-scan": {
    html: `
      <div class="grid"></div>
      <div class="scanline"></div>
      <div class="reticle"></div>
    `,
    css: `
      .mapbox{background:rgba(0,0,0,.2);}
      .mapbox .grid{position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size:22px 22px;}
      .mapbox .scanline{position:absolute; left:0; right:0; height:2px; background:var(--accent-a); box-shadow:0 0 8px var(--accent-a); opacity:.6; animation:locgridscan 3s linear infinite;}
      @keyframes locgridscan{0%{top:0;}100%{top:100%;}}
      .mapbox .reticle{position:absolute; width:26px; height:26px; border:1px solid var(--accent-b);}
      .mapbox .reticle::before,.mapbox .reticle::after{content:''; position:absolute; background:var(--accent-b);}
      .mapbox .reticle::before{left:50%; top:-6px; width:1px; height:6px;}
      .mapbox .reticle::after{top:50%; left:-6px; width:6px; height:1px;}
    `,
  },

  "end-of-broadcast": {
    html: `
      <div class="tvstatic"></div>
      <div class="tvrollbar"></div>
      <div class="tvsignal">NO SIGNAL</div>
    `,
    css: `
      .mapbox{background:#000;}
      .mapbox .tvstatic{position:absolute; inset:-4%; opacity:.55; mix-blend-mode:screen;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)'/%3E%3C/svg%3E");
        background-size:140px 140px; animation:tvflicker .1s steps(2) infinite;}
      @keyframes tvflicker{0%{transform:translate(0,0);}50%{transform:translate(-3%,2%);}100%{transform:translate(2%,-2%);}}
      .mapbox .tvrollbar{position:absolute; left:0; right:0; height:35%; background:linear-gradient(rgba(255,255,255,.18), transparent); mix-blend-mode:screen; animation:tvroll 2.4s linear infinite;}
      @keyframes tvroll{0%{top:-35%;}100%{top:100%;}}
      .mapbox .tvsignal{position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        font-family:var(--font-mono); font-size:11px; letter-spacing:5px; color:#fff;
        text-shadow:2px 0 var(--accent-b), -2px 0 var(--accent-a); animation:tvblink 2.8s steps(1) infinite;}
      @keyframes tvblink{0%,100%{opacity:0;}4%{opacity:1;}9%{opacity:0;}68%{opacity:0;}73%{opacity:.85;}78%{opacity:0;}}
    `,
  },
  "shadow-lantern": {
    html: `
      <div class="lampglow"></div>
      <div class="compass rose">
        <div class="needle"></div>
        <span class="point n">N</span><span class="point s">S</span><span class="point e">E</span><span class="point w">W</span>
      </div>
    `,
    css: `
      .mapbox{background:radial-gradient(circle at 50% 55%, rgba(255,255,255,.05), rgba(0,0,0,.3) 75%);}
      .mapbox .lampglow{position:absolute; width:170px; height:170px; border-radius:50%; background:radial-gradient(circle, var(--accent-a) 0%, transparent 68%); opacity:.16; animation:loclampflicker 3.4s ease-in-out infinite;}
      @keyframes loclampflicker{0%,100%{opacity:.12; transform:scale(1);}40%{opacity:.22; transform:scale(1.05);}55%{opacity:.09;}80%{opacity:.18;}}
      .mapbox .compass.rose{position:relative; width:120px; height:120px; border:1px solid var(--accent-a); border-radius:50%; opacity:.75;}
      .mapbox .compass.rose::before{content:''; position:absolute; inset:16px; border:1px solid var(--accent-a); border-radius:50%; opacity:.5;}
      .mapbox .compass.rose::after{content:''; position:absolute; inset:0; border-radius:50%; opacity:.25;
        background:
          linear-gradient(45deg, transparent 48%, var(--accent-b) 49%, var(--accent-b) 51%, transparent 52%),
          linear-gradient(-45deg, transparent 48%, var(--accent-b) 49%, var(--accent-b) 51%, transparent 52%);}
      .mapbox .compass .point{position:absolute; font-family:var(--font-mono); font-size:9px; letter-spacing:1px; color:var(--text); opacity:.55;}
      .mapbox .compass .point.n{top:2px; left:50%; transform:translateX(-50%);}
      .mapbox .compass .point.s{bottom:2px; left:50%; transform:translateX(-50%);}
      .mapbox .compass .point.e{right:2px; top:50%; transform:translateY(-50%);}
      .mapbox .compass .point.w{left:2px; top:50%; transform:translateY(-50%);}
      .mapbox .compass .needle{position:absolute; left:50%; top:50%; width:2px; height:40px; margin:-40px 0 0 -1px; transform-origin:50% 40px; background:linear-gradient(to top, var(--accent-b), transparent); animation:locsway 4.5s ease-in-out infinite;}
      @keyframes locsway{0%,100%{transform:rotate(-6deg);}50%{transform:rotate(6deg);}}
    `,
  },

  // Deliberately the SAME <path> data as motifs.js's "naga" boot motif,
  // not a reinterpretation — the point of this entry is that the Location
  // section carries the identical naga artwork the boot screen just
  // showed, not a second, different piece of art for the same idea. Keep
  // both in sync if the shape ever changes.
  // Deliberately the SAME <svg> markup/coordinates as motifs.js's
  // "scroll-unfurl" boot motif — see that file's comment. Scaled down to
  // fit .mapbox via the wrapper's width/height only; the internal SVG
  // numbers are untouched, same approach as the "naga" entry below.
  "scroll-unfurl": {
    html: `
      <div class="lampglow"></div>
      <div class="sscroll">
        <svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg">
          <rect class="s-rod" x="10" y="11" width="80" height="6" rx="3"/>
          <circle class="s-finial" cx="10" cy="14" r="5"/>
          <circle class="s-finial" cx="90" cy="14" r="5"/>
          <g class="s-doc">
            <rect class="s-paper" x="22" y="14" width="56" height="128"/>
            <line class="s-line" x1="30" y1="34" x2="70" y2="34"/>
            <line class="s-line" x1="30" y1="48" x2="64" y2="48"/>
            <line class="s-line" x1="30" y1="62" x2="70" y2="62"/>
            <circle class="s-seal" cx="50" cy="90" r="9"/>
          </g>
          <rect class="s-rod s-rod-bottom" x="10" y="139" width="80" height="6" rx="3"/>
          <circle class="s-finial s-finial-bottom" cx="10" cy="142" r="5"/>
          <circle class="s-finial s-finial-bottom" cx="90" cy="142" r="5"/>
        </svg>
      </div>
    `,
    css: `
      .mapbox{background:radial-gradient(circle at 50% 55%, rgba(255,255,255,.05), rgba(0,0,0,.3) 75%);}
      .mapbox .lampglow{position:absolute; width:170px; height:170px; border-radius:50%; background:radial-gradient(circle, var(--accent-a) 0%, transparent 68%); opacity:.16; animation:loclampflicker 3.4s ease-in-out infinite;}
      @keyframes loclampflicker{0%,100%{opacity:.12; transform:scale(1);}40%{opacity:.22; transform:scale(1.05);}55%{opacity:.09;}80%{opacity:.18;}}
      .mapbox .sscroll{width:72px; height:120px; position:relative; filter:drop-shadow(0 0 6px rgba(0,0,0,.45));}
      .mapbox .sscroll svg{width:100%; height:100%; overflow:visible;}
      .mapbox .s-rod{fill:#160f08;}
      .mapbox .s-finial{fill:var(--accent-a); opacity:.9;}
      .mapbox .s-paper{fill:#e8d9ae; stroke:rgba(0,0,0,.25); stroke-width:.6;}
      .mapbox .s-line{stroke:rgba(60,40,15,.45); stroke-width:1.4; stroke-linecap:round;}
      .mapbox .s-seal{fill:var(--accent-b); animation:locsealbreak 4.6s ease-in-out infinite;}
      .mapbox .s-doc{transform-origin:50% 14px; animation:locscrollunfurl 4.6s ease-in-out infinite;}
      .mapbox .s-rod-bottom, .mapbox .s-finial-bottom{animation:locscrollrodmove 4.6s ease-in-out infinite;}
      @keyframes locscrollunfurl{0%{transform:scaleY(.04);}40%,60%{transform:scaleY(1);}100%{transform:scaleY(.04);}}
      @keyframes locscrollrodmove{0%{transform:translateY(-124px);}40%,60%{transform:translateY(0);}100%{transform:translateY(-124px);}}
      @keyframes locsealbreak{0%{opacity:1;}38%{opacity:0;}62%{opacity:0;}100%{opacity:1;}}
    `,
  },

  naga: {
    html: `
      <div class="lampglow"></div>
      <div class="ncoil">
        <svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg">
          <path class="n-body" d="M50 150 C20 130 78 112 48 90 C22 72 76 54 48 34 C26 18 62 10 52 2"/>
          <path class="n-fin" d="M40 120 L28 111 L40 106 Z"/>
          <path class="n-fin" d="M62 100 L74 91 L62 86 Z"/>
          <path class="n-fin" d="M40 66 L28 57 L40 52 Z"/>
          <g class="n-head">
            <path class="n-crest" d="M44 -4 L38 -16 L48 -8 Z"/>
            <path class="n-crest" d="M52 -6 L52 -20 L58 -8 Z"/>
            <path class="n-crest" d="M60 -4 L68 -14 L58 -8 Z"/>
            <path d="M42 6 L52 -10 L62 6 L52 14 Z"/>
            <circle class="n-eye" cx="49" cy="4" r="1.5"/>
          </g>
        </svg>
      </div>
    `,
    css: `
      .mapbox{background:radial-gradient(circle at 50% 55%, rgba(255,255,255,.05), rgba(0,0,0,.3) 75%);}
      .mapbox .lampglow{position:absolute; width:170px; height:170px; border-radius:50%; background:radial-gradient(circle, var(--accent-a) 0%, transparent 68%); opacity:.16; animation:loclampflicker 3.4s ease-in-out infinite;}
      @keyframes loclampflicker{0%,100%{opacity:.12; transform:scale(1);}40%{opacity:.22; transform:scale(1.05);}55%{opacity:.09;}80%{opacity:.18;}}
      .mapbox .ncoil{width:70px; height:118px; position:relative; filter:drop-shadow(0 0 6px rgba(0,0,0,.5)); transform-origin:50% 100%; animation:locnagasway 3.6s ease-in-out infinite;}
      .mapbox .ncoil svg{width:100%; height:100%; overflow:visible;}
      .mapbox .n-body{fill:none; stroke:#160f08; stroke-width:9; stroke-linecap:round;}
      .mapbox .n-fin{fill:#160f08;}
      .mapbox .n-head path:not(.n-crest){fill:#160f08;}
      .mapbox .n-crest{fill:var(--accent-a); opacity:.85;}
      .mapbox .n-eye{fill:var(--accent-b);}
      @keyframes locnagasway{0%,100%{transform:rotate(-4deg);}50%{transform:rotate(4deg);}}
    `,
  },
};

export function renderLocationMotif(motifKey) {
  const motif = LOCATION_MOTIFS[motifKey] || LOCATION_MOTIFS["radar-sweep"];
  return { html: motif.html, css: motif.css };
}
