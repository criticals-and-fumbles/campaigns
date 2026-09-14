/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { MAIN_SITE, SITE_NAV_LINKS } from "./constants.js";
import { SocialLinks } from "./SocialLinks.jsx";

// Same icon-toggle markup as templates/dossier.js's own theme toggle
// (duplicated, not shared — see that file's own comment; this component
// is a separate template with its own <style> block already).
function ThemeToggleIcons() {
  return (
    <>
      <svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
      <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </>
  );
}

export function SiteNav({ siteLinks }) {
  return (
    <>
      <header class="site-nav">
        <nav class="site-nav-inner">
          <a class="site-nav-brand" href={`${MAIN_SITE}/`}>
            <img src={`${MAIN_SITE}/logo.png`} alt="Criticals and Fumbles logo" />
            {/* Tri-colour split, matching cnf-website's Nav.tsx wordmark
                exactly: "Criticals" real emerald green (--criticals-
                emerald, NOT --emerald, which means gold everywhere
                else), "&" gold, "Fumbles" magenta. */}
            <span>
              <span style={{ color: "var(--criticals-emerald)" }}>Criticals</span>{" "}
              <span style={{ color: "var(--amber)" }}>&amp;</span>{" "}
              <span style={{ color: "var(--magenta)" }}>Fumbles</span>
            </span>
          </a>
          <div class="site-nav-links">
            {SITE_NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} class={l.current ? "current" : undefined}>
                {l.label}
              </a>
            ))}
          </div>
          <div class="site-nav-right">
            <SocialLinks siteLinks={siteLinks} />
            <button
              class="theme-toggle-btn"
              id="siteThemeToggle"
              aria-label="Toggle light/dark theme"
              title="Toggle light/dark theme"
            >
              <ThemeToggleIcons />
            </button>
          </div>
          <button class="hamburger-btn" id="navHamburger" aria-label="Toggle menu" title="Toggle menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </nav>
      </header>

      {/* Mobile drawer — a fully separate element from .site-nav-links
          above, not the same DOM node toggling flex-direction. Nav.tsx's
          real mobile drawer is likewise a completely separate block from
          the desktop link row, not a CSS-repurposed version of it —
          reusing one element for both layouts is exactly the shape of
          bug WebKit's fixed-positioning/containing-block quirks trip on
          (confirmed via a real-device screenshot: the drawer rendered as
          a tiny box instead of a full-height panel when it shared markup
          with the desktop row). */}
      <div class="mobile-drawer" id="mobileDrawer">
        <button class="nav-close-btn" id="navClose" aria-label="Close menu" title="Close menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div class="mobile-drawer-links">
          {SITE_NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} class={l.current ? "current" : undefined}>
              {l.label}
            </a>
          ))}
        </div>
        <div class="nav-drawer-extra">
          <SocialLinks siteLinks={siteLinks} />
          <button
            class="theme-toggle-btn"
            id="siteThemeToggleMobile"
            aria-label="Toggle light/dark theme"
            title="Toggle light/dark theme"
          >
            <ThemeToggleIcons />
          </button>
        </div>
      </div>
      <div class="nav-scrim" id="navScrim"></div>
    </>
  );
}
