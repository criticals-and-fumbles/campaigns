/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

// Astrolabe backdrop + outer ornate frame — ported from the old
// ASTROLABE_BACKDROP template-string constant (src/routes/dossier.js,
// pre-JSX-conversion) into real JSX components. Markup is unchanged;
// see styles.js's matching CSS comment for the full porting rationale
// (hand-ported from cnf-website's components/celestial/CelestialBackdrop.tsx).
function CompassIcon({ ticks }) {
  return (
    <div class="compass">
      <svg viewBox="0 0 60 60" fill="currentColor">
        <circle cx="30" cy="30" fill="none" r="16" stroke="#d4af37" stroke-width="1.2" />
        <circle cx="30" cy="30" fill="none" r="22" stroke="#d4af37" stroke-dasharray="2 2" stroke-width="0.8" />
        <path d="M30 4 L33 24 L56 30 L33 36 L30 56 L27 36 L4 30 L27 24 Z" />
        <circle cx="30" cy="30" fill="#fff" r="3" />
        <path d={ticks} fill="none" stroke="#c5a044" stroke-width="1" />
      </svg>
    </div>
  );
}

export function AstrolabeBackdrop() {
  return (
    <div class="astrolabe-backdrop" aria-hidden="true">
      <div class="nebula-a"></div>
      <div class="nebula-b"></div>
      <div class="astrolabe-ring">
        <svg class="spin-slow" viewBox="0 0 1000 1000" fill="none">
          <defs>
            <radialGradient cx="50%" cy="50%" id="coreGlow" r="50%">
              <stop offset="0%" stop-color="#00e5c8" stop-opacity="0.35" />
              <stop offset="30%" stop-color="#d4af37" stop-opacity="0.18" />
              <stop offset="70%" stop-color="#031826" stop-opacity="0.05" />
              <stop offset="100%" stop-color="transparent" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="500" cy="500" fill="url(#coreGlow)" r="480" />
          <circle cx="500" cy="500" opacity="0.4" r="480" stroke="#d4af37" stroke-dasharray="3 9" stroke-width="0.8" />
          <circle cx="500" cy="500" opacity="0.45" r="460" stroke="#00e5c8" stroke-width="1" />
          <circle cx="500" cy="500" opacity="0.5" r="390" stroke="#38bdf8" stroke-width="1.2" />
          <circle cx="500" cy="500" opacity="0.6" r="340" stroke="#d4af37" stroke-dasharray="6 6" stroke-width="1" />
          <circle cx="500" cy="500" opacity="0.7" r="210" stroke="#d4af37" stroke-width="1.2" />
          <circle cx="500" cy="500" opacity="0.85" r="70" stroke="#d4af37" stroke-dasharray="2 2" stroke-width="1.2" />
          <polygon fill="none" opacity="0.7" points="500,60 881,720 119,720" stroke="#d4af37" stroke-width="1.2" />
          <polygon fill="none" opacity="0.7" points="500,940 881,280 119,280" stroke="#d4af37" stroke-width="1.2" />
          <line opacity="0.55" stroke="#d4af37" stroke-width="0.9" x1="500" x2="500" y1="10" y2="990" />
          <line opacity="0.55" stroke="#d4af37" stroke-width="0.9" x1="10" x2="990" y1="500" y2="500" />
        </svg>
        <svg class="spin-reverse" viewBox="0 0 1000 1000" fill="none">
          <g opacity="0.45" stroke="#d4af37" stroke-width="0.7">
            <line x1="500" x2="500" y1="500" y2="40" />
            <line x1="500" x2="890" y1="500" y2="275" />
            <line x1="500" x2="890" y1="500" y2="725" />
            <line x1="500" x2="500" y1="500" y2="960" />
            <line x1="500" x2="110" y1="500" y2="725" />
            <line x1="500" x2="110" y1="500" y2="275" />
          </g>
          <ellipse cx="440" cy="460" opacity="0.35" rx="350" ry="190" stroke="#00e5c8" stroke-width="0.9" transform="rotate(-30 440 460)" />
        </svg>
      </div>
    </div>
  );
}

export function OuterFrame() {
  return (
    <div class="outer-frame" aria-hidden="true">
      <div class="frame-row">
        <CompassIcon ticks="M4 4 L22 4 M4 4 L4 22 M10 10 L28 10 M10 10 L10 28" />
        <CompassIcon ticks="M56 4 L38 4 M56 4 L56 22 M50 10 L32 10 M50 10 L50 28" />
      </div>
      <div class="frame-rails">
        <div class="rail"><div class="rail-notch"></div></div>
        <div class="rail"><div class="rail-notch"></div></div>
      </div>
      <div class="frame-row">
        <CompassIcon ticks="M4 56 L22 56 M4 56 L4 38 M10 50 L28 50 M10 50 L10 32" />
        <CompassIcon ticks="M56 56 L38 56 M56 56 L56 38 M50 50 L32 50 M50 50 L50 32" />
      </div>
    </div>
  );
}
