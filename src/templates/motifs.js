/**
 * Loading-screen boot motifs — 4 reusable animation modules, selected by
 * `theme.loadingScreen.motif`, NOT hardcoded per genre/campaign name. Each
 * ports the exact animation from its respective concept HTML:
 *   terminal-decrypt — concepts/campaign-dossier-concept.html (sci-fi/Bureau Noir)
 *   wax-seal         — concepts/campaign-dossier-fantasy-concept.html
 *   vhs-tracking     — concepts/campaign-dossier-horror-concept.html
 *   file-unlock      — concepts/campaign-dossier-modern-concept.html
 *
 * Each entry provides `html` (the #boot inner markup), `css` (motif-only
 * rules — shared #boot chrome lives in dossier.js's base stylesheet), and
 * `js` (the trigger script, inlined into the page's <script> block).
 */

export const MOTIFS = {
  "terminal-decrypt": {
    html: (bootTitle, bootSubtitle, code) => `
      <div class="glyph" id="bootGlyph">${escapeHtml(bootTitle)}</div>
      <div class="bootbar"></div>
      <div class="bootline" id="bootLine">${escapeHtml(bootSubtitle)} · ${escapeHtml(code)}</div>
    `,
    css: `
      #boot .glyph{font-size:14px; letter-spacing:4px; opacity:.65; animation:flicker 2.4s infinite;}
      #boot .bootline{font-size:11px; color:var(--text-dim); letter-spacing:2px;}
      @keyframes flicker{0%,100%{opacity:.65}42%{opacity:.2}44%{opacity:.7}70%{opacity:.35}72%{opacity:.65}}
    `,
    js: `
      function decryptScramble(el, finalText, duration){
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%$&';
        const len = finalText.length;
        const start = performance.now();
        function frame(now){
          const t = Math.min(1, (now - start) / duration);
          let out = '';
          for(let i=0; i<len; i++){
            const charLockT = i / len;
            if(t > charLockT + 0.15 || finalText[i] === ' '){ out += finalText[i]; }
            else{ out += chars[Math.floor(Math.random()*chars.length)]; }
          }
          el.textContent = out;
          if(t < 1) requestAnimationFrame(frame); else el.textContent = finalText;
        }
        requestAnimationFrame(frame);
      }
      const bootGlyph = document.getElementById('bootGlyph');
      const bootLine = document.getElementById('bootLine');
      decryptScramble(bootGlyph, bootGlyph.textContent, 1400);
      setTimeout(()=> decryptScramble(bootLine, bootLine.textContent, 900), 700);
    `,
  },

  "wax-seal": {
    html: (bootTitle, bootSubtitle, code) => `
      <div class="seal" id="seal"><span class="half l"></span><span class="half r"></span></div>
      <div class="glyph">${escapeHtml(bootTitle)}</div>
      <div class="bootbar"></div>
      <div class="bootline">${escapeHtml(bootSubtitle)} · ${escapeHtml(code)}</div>
    `,
    css: `
      #boot .glyph{font-size:15px; letter-spacing:3px; opacity:.7; animation:candleflicker 2.6s infinite;}
      #boot .bootline{font-size:11px; color:var(--text-dim); letter-spacing:1.5px; font-style:italic;}
      #boot .seal{width:64px; height:64px; position:relative; margin-bottom:4px;}
      #boot .seal .half{position:absolute; top:0; width:32px; height:64px; overflow:hidden;}
      #boot .seal .half.l{left:0;}
      #boot .seal .half.r{right:0;}
      #boot .seal .half::before{content:'\\2756'; position:absolute; top:0; left:0; width:64px; height:64px; font-size:56px; line-height:64px; text-align:center; color:var(--accent-b); text-shadow:0 0 14px rgba(224,138,46,.5);}
      #boot .seal .half.r::before{right:0; left:auto;}
      #boot .seal.crack .half.l{animation:crackleft 1.1s cubic-bezier(.4,0,.2,1) 1.1s forwards;}
      #boot .seal.crack .half.r{animation:crackright 1.1s cubic-bezier(.4,0,.2,1) 1.1s forwards;}
      @keyframes crackleft{to{transform:translate(-14px,10px) rotate(-14deg); opacity:0;}}
      @keyframes crackright{to{transform:translate(14px,10px) rotate(14deg); opacity:0;}}
      @keyframes candleflicker{0%,100%{opacity:.7}38%{opacity:.3}41%{opacity:.75}68%{opacity:.4}71%{opacity:.7}}
    `,
    js: `
      document.getElementById('seal').classList.add('crack');
    `,
  },

  "vhs-tracking": {
    html: (bootTitle, bootSubtitle, code) => `
      <div class="tracking" id="tracking"></div>
      <div class="glyph corrupted" id="bootGlyph">${escapeHtml(bootTitle)}</div>
      <div class="bootbar"></div>
      <div class="bootline">${escapeHtml(bootSubtitle)} · ${escapeHtml(code)}</div>
    `,
    css: `
      #boot .glyph{font-size:13px; letter-spacing:2px; opacity:.6; animation:staticflicker 1.6s infinite steps(6);}
      #boot .bootline{font-size:10.5px; color:var(--text-dim); letter-spacing:1.5px;}
      #boot .tracking{position:absolute; left:0; right:0; height:22px; background:linear-gradient(rgba(179,22,28,.35), rgba(179,22,28,0)); mix-blend-mode:screen; opacity:0; pointer-events:none;}
      #boot .tracking.sweep{animation:trackingsweep 1.3s ease-in 2;}
      @keyframes trackingsweep{0%{top:-22px; opacity:0;}5%{opacity:.9;}95%{opacity:.7;}100%{top:100%; opacity:0;}}
      #boot .glyph.corrupted{color:var(--text-faint); text-shadow:2px 0 var(--accent-a), -2px 0 var(--accent-b);}
      @keyframes staticflicker{0%,100%{opacity:.6}10%{opacity:.1}12%{opacity:.65}45%{opacity:.2}47%{opacity:.6}80%{opacity:.15}82%{opacity:.6}}
    `,
    js: `
      document.getElementById('tracking').classList.add('sweep');
      setTimeout(()=> document.getElementById('bootGlyph').classList.remove('corrupted'), 1500);
    `,
  },

  "file-unlock": {
    html: (bootTitle, bootSubtitle, code) => `
      <div class="lock" id="lock">
        <div class="flash"></div>
        <div class="shackle"></div>
        <div class="body"></div>
      </div>
      <div class="glyph">${escapeHtml(bootTitle)}</div>
      <div class="bootbar"></div>
      <div class="bootline">${escapeHtml(bootSubtitle)} · ${escapeHtml(code)}</div>
    `,
    css: `
      #boot .glyph{font-size:13px; letter-spacing:3px; opacity:.75;}
      #boot .bootline{font-size:10.5px; color:var(--text-dim); letter-spacing:1.5px;}
      #boot .lock{width:46px; height:46px; position:relative;}
      #boot .lock .shackle{position:absolute; left:11px; top:0; width:24px; height:22px; border:4px solid var(--accent-b); border-bottom:none; border-radius:14px 14px 0 0; transform-origin:14px 20px; transition:transform .5s cubic-bezier(.3,1.6,.4,1), border-color .3s;}
      #boot .lock .body{position:absolute; left:5px; top:18px; width:36px; height:26px; background:var(--panel-2, #12141e); border:2px solid var(--accent-a); border-radius:4px;}
      #boot .lock .body::after{content:''; position:absolute; left:16px; top:8px; width:4px; height:9px; background:var(--accent-a); border-radius:1px;}
      #boot .lock.open .shackle{transform:rotate(-38deg) translate(-3px,-2px); border-color:var(--accent-a);}
      #boot .lock .flash{position:absolute; inset:-14px; border-radius:50%; background:radial-gradient(circle, rgba(63,143,209,.5), transparent 65%); opacity:0;}
      #boot .lock.open .flash{animation:unlockflash .5s ease-out;}
      @keyframes unlockflash{0%{opacity:0; transform:scale(.6);}40%{opacity:1;}100%{opacity:0; transform:scale(1.5);}}
    `,
    js: `
      setTimeout(()=> document.getElementById('lock').classList.add('open'), 1100);
    `,
  },
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMotif(motifKey, bootTitle, bootSubtitle, code) {
  const motif = MOTIFS[motifKey] || MOTIFS["terminal-decrypt"];
  return {
    html: motif.html(bootTitle, bootSubtitle, code),
    css: motif.css,
    js: motif.js,
  };
}
