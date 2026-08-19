/**
 * Resolves a campaign's genreTheme document into CSS custom properties +
 * section-label copy the dossier template consumes. One dossier template,
 * data-driven entirely from these tokens — see src/templates/dossier.js.
 */

const FALLBACK_LABELS = {
  dossier: "Dossier",
  overview: "Overview",
  location: "Location",
  meterSection: "Assessment",
  meterItem: "Level",
  objectives: "Objectives",
  objectivePriorityHigh: "Primary",
  objectivePriorityMid: "Secondary",
  objectivePriorityLow: "Tertiary",
  log: "Log",
  media: "Media",
  statPanel: undefined,
};

const FALLBACK_MOTIF = "terminal-decrypt";
const FALLBACK_LOCATION_MOTIF = "radar-sweep";

/** Builds the `:root { --x: y; }` CSS block for a theme's dark+light colors + fonts. */
export function themeToCssVars(theme) {
  const dark = theme?.colors?.dark ?? {};
  const light = theme?.colors?.light ?? {};
  const fonts = theme?.fonts ?? {};

  const fontVars = `
    --font-display:'${fonts.display || "Space Grotesk"}', sans-serif;
    --font-body:'${fonts.body || "Inter"}', sans-serif;
    --font-mono:'${fonts.mono || "JetBrains Mono"}', monospace;
  `;

  return `
    :root{
      --bg:${dark.bg || "#050708"};
      --accent-a:${dark.accentA || "#17e9a0"};
      --accent-b:${dark.accentB || "#ff4fae"};
      --text:${dark.text || "#dfeee9"};
      ${fontVars}
    }
    html[data-theme="light"]{
      --bg:${light.bg || "#efe6d2"};
      --accent-a:${light.accentA || "#0d8f63"};
      --accent-b:${light.accentB || "#c22e83"};
      --text:${light.text || "#231f18"};
    }
  `;
}

/** Merges a theme's labels with fallbacks so templates never need `?? ''` scattered everywhere. */
export function resolveLabels(theme) {
  return { ...FALLBACK_LABELS, ...(theme?.labels || {}) };
}

export function resolveMotif(theme) {
  return theme?.loadingScreen?.motif || FALLBACK_MOTIF;
}

/** Which Location-section decorative visual to render — see
 * templates/locationMotifs.js. Same "data-driven, not genre-name-keyed"
 * rule as resolveMotif above. */
export function resolveLocationMotif(theme) {
  return theme?.locationMotif || FALLBACK_LOCATION_MOTIF;
}
