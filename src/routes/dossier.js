import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { query } from "../lib/sanity.js";
import { renderDossierPage, renderCampaignIndexPage } from "../templates/dossier.js";
import { urlFor } from "../lib/sanity-image.js";
import { SOCIAL_ICON_SVG } from "../lib/icons.js";

const app = new Hono();

// Shared with cnf-website's ThemeProvider.tsx (COOKIE_NAME there) via a
// cookie scoped to the parent domain — localStorage can't cross
// subdomains, cookies scoped to .criticalsandfumbles.com can. This is
// read-only here (this Worker doesn't set it — only the main site and
// this repo's own client-side toggles do, both writing the same name).
const COLOR_MODE_COOKIE = "cnf-theme";
function resolveColorMode(c) {
  return getCookie(c, COLOR_MODE_COOKIE) === "light" ? "light" : "dark";
}

const CAMPAIGN_QUERY = `*[_type == "campaign" && slug.current == $slug][0]{
  _id, title, slug, genre, system, status, gmNames, heroImage, hook,
  sessionCount, motto, signOff, visible,
  "theme": theme->
}`;

// campaign.heroImage/hook added 2026-09-01 as OG-tag fallbacks for
// dossiers with no headerImage/heroImage/overview of their own (share
// row's link previews need SOME image/description, not a blank card).
const DOSSIER_QUERY = `*[_type == "dossier" && code == $code && campaign->slug.current == $slug][0]{
  ...,
  "campaign": campaign->{ _id, title, slug, system, motto, hook, heroImage, signOff, visible, "theme": theme-> }
}`;

const CAMPAIGN_DOSSIERS_QUERY = `*[_type == "dossier" && campaign->slug.current == $slug] | order(_createdAt desc){
  _id, code, title, sessionLabel, location, _createdAt
}`;

// "Most recently updated" means actual campaign activity — a new or
// edited session bumps the campaign to the top, not just edits to the
// campaign document itself (which is what plain _updatedAt would give:
// a GM adding a session without ever re-touching the campaign's own
// fields would otherwise never move it). lastActivity is the newest of
// (a) any of its dossiers' _updatedAt, or (b) the campaign's own
// _updatedAt if it has no dossiers yet — see references(^._id), which
// resolves to the campaign document being projected.
const ALL_CAMPAIGNS_QUERY = `*[_type == "campaign" && visible == true]{
  _id, title, slug, genre, system, status, hook, heroImage,
  "lastActivity": coalesce(*[_type == "dossier" && references(^._id)] | order(_updatedAt desc)[0]._updatedAt, _updatedAt)
} | order(lastActivity desc)`;

// Sidebar activity feed — the most recently updated dossiers across every
// visible campaign, newest first, capped at 10.
const RECENT_ACTIVITY_QUERY = `*[_type == "dossier" && campaign->visible == true] | order(_updatedAt desc)[0...10]{
  code, title, sessionLabel, _updatedAt,
  "campaignSlug": campaign->slug.current, "campaignTitle": campaign->title
}`;

const STATUS_LABEL = {
  active: "Active",
  recruiting: "Recruiting",
  hiatus: "On Hiatus",
  concluded: "Concluded",
};

// CSS class per status — see .status-badge.* rules in pageShell for the
// actual colors. "recruiting" gets the loudest treatment (solid amber
// fill) since the directory's intro copy specifically points visitors at
// recruiting campaigns.
const STATUS_CLASS = {
  active: "status-active",
  recruiting: "status-recruiting",
  hiatus: "status-hiatus",
  concluded: "status-concluded",
};

// siteSettings is a main-site document (cnf-website/sanity/schemas/
// siteSettings.ts) — but it lives in the same Sanity project/dataset as
// this Worker, so querying it directly (rather than hardcoding the
// Discord/WhatsApp URLs, site title/description, or copyright line here)
// keeps this page's CTAs AND its nav/footer chrome in sync with whatever
// the main site's Studio has, same principle as that repo's own "never
// hardcode the Discord invite string" rule (see its CLAUDE.md).
const SITE_LINKS_QUERY = `*[_type == "siteSettings"][0]{
  title, shortDescription, discordUrl, copyrightLine,
  "whatsappUrl": socialLinks[platform == "WhatsApp"][0].url,
  socialLinks
}`;

const MAIN_SITE = "https://www.criticalsandfumbles.com";

// Mirrors cnf-website's NAV_LINKS (components/layout/Nav.tsx) with
// "Campaigns" inserted — this Worker isn't a route in that Next.js app,
// so it can't share that component, only match its shape by hand. If
// that list changes there, update this one too; nothing keeps them in
// sync automatically.
const SITE_NAV_LINKS = [
  { label: "About", href: `${MAIN_SITE}/about` },
  { label: "Events", href: `${MAIN_SITE}/events` },
  { label: "Campaigns", href: "/", current: true },
  { label: "Wiki", href: `${MAIN_SITE}/wiki` },
  { label: "Team", href: `${MAIN_SITE}/team` },
  { label: "Resources", href: `${MAIN_SITE}/resources` },
];

// Same set/order as cnf-website's Nav.tsx SocialLinks (facebook,
// instagram, discord, whatsapp) — built from the same siteLinks data the
// footer already uses, so no extra query needed.
function socialIconsBlock(siteLinks) {
  const bySocial = (platform) => (siteLinks?.socialLinks || []).find((l) => l.platform === platform)?.url;
  const links = [
    { label: "Facebook", url: bySocial("Facebook") },
    { label: "Instagram", url: bySocial("Instagram") },
    { label: "Discord", url: siteLinks?.discordUrl },
    { label: "WhatsApp Community", url: bySocial("WhatsApp") },
  ].filter((l) => l.url);

  if (links.length === 0) return "";

  return `<div class="site-nav-social">${links
    .map(
      (l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(l.label)}">${SOCIAL_ICON_SVG[l.label.startsWith("WhatsApp") ? "WhatsApp" : l.label]}</a>`,
    )
    .join("\n")}</div>`;
}

// Astrolabe backdrop + outer ornate frame markup — see the matching CSS
// block (search "Astrolabe backdrop" in pageShell's <style>) for the
// full porting rationale. Static, siteLinks-independent, so this is a
// plain top-level constant rather than something pageShell recomputes
// per request.
const ASTROLABE_BACKDROP = `
<div class="astrolabe-backdrop" aria-hidden="true">
  <div class="nebula-a"></div>
  <div class="nebula-b"></div>
  <div class="astrolabe-ring">
    <svg class="spin-slow" viewBox="0 0 1000 1000" fill="none">
      <defs>
        <radialGradient cx="50%" cy="50%" id="coreGlow" r="50%">
          <stop offset="0%" stop-color="#00e5c8" stop-opacity="0.35"/>
          <stop offset="30%" stop-color="#d4af37" stop-opacity="0.18"/>
          <stop offset="70%" stop-color="#031826" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="500" cy="500" fill="url(#coreGlow)" r="480"/>
      <circle cx="500" cy="500" opacity="0.4" r="480" stroke="#d4af37" stroke-dasharray="3 9" stroke-width="0.8"/>
      <circle cx="500" cy="500" opacity="0.45" r="460" stroke="#00e5c8" stroke-width="1"/>
      <circle cx="500" cy="500" opacity="0.5" r="390" stroke="#38bdf8" stroke-width="1.2"/>
      <circle cx="500" cy="500" opacity="0.6" r="340" stroke="#d4af37" stroke-dasharray="6 6" stroke-width="1"/>
      <circle cx="500" cy="500" opacity="0.7" r="210" stroke="#d4af37" stroke-width="1.2"/>
      <circle cx="500" cy="500" opacity="0.85" r="70" stroke="#d4af37" stroke-dasharray="2 2" stroke-width="1.2"/>
      <polygon fill="none" opacity="0.7" points="500,60 881,720 119,720" stroke="#d4af37" stroke-width="1.2"/>
      <polygon fill="none" opacity="0.7" points="500,940 881,280 119,280" stroke="#d4af37" stroke-width="1.2"/>
      <line opacity="0.55" stroke="#d4af37" stroke-width="0.9" x1="500" x2="500" y1="10" y2="990"/>
      <line opacity="0.55" stroke="#d4af37" stroke-width="0.9" x1="10" x2="990" y1="500" y2="500"/>
    </svg>
    <svg class="spin-reverse" viewBox="0 0 1000 1000" fill="none">
      <g opacity="0.45" stroke="#d4af37" stroke-width="0.7">
        <line x1="500" x2="500" y1="500" y2="40"/>
        <line x1="500" x2="890" y1="500" y2="275"/>
        <line x1="500" x2="890" y1="500" y2="725"/>
        <line x1="500" x2="500" y1="500" y2="960"/>
        <line x1="500" x2="110" y1="500" y2="725"/>
        <line x1="500" x2="110" y1="500" y2="275"/>
      </g>
      <ellipse cx="440" cy="460" opacity="0.35" rx="350" ry="190" stroke="#00e5c8" stroke-width="0.9" transform="rotate(-30 440 460)"/>
    </svg>
  </div>
</div>
<div class="outer-frame" aria-hidden="true">
  <div class="frame-row">
    ${compassIcon("M4 4 L22 4 M4 4 L4 22 M10 10 L28 10 M10 10 L10 28")}
    ${compassIcon("M56 4 L38 4 M56 4 L56 22 M50 10 L32 10 M50 10 L50 28")}
  </div>
  <div class="frame-rails">
    <div class="rail"><div class="rail-notch"></div></div>
    <div class="rail"><div class="rail-notch"></div></div>
  </div>
  <div class="frame-row">
    ${compassIcon("M4 56 L22 56 M4 56 L4 38 M10 50 L28 50 M10 50 L10 32")}
    ${compassIcon("M56 56 L38 56 M56 56 L56 38 M50 50 L32 50 M50 50 L50 32")}
  </div>
</div>`;

function compassIcon(ticks) {
  return `<div class="compass">
    <svg viewBox="0 0 60 60" fill="currentColor">
      <circle cx="30" cy="30" fill="none" r="16" stroke="#d4af37" stroke-width="1.2"/>
      <circle cx="30" cy="30" fill="none" r="22" stroke="#d4af37" stroke-dasharray="2 2" stroke-width="0.8"/>
      <path d="M30 4 L33 24 L56 30 L33 36 L30 56 L27 36 L4 30 L27 24 Z"/>
      <circle cx="30" cy="30" fill="#fff" r="3"/>
      <path d="${ticks}" fill="none" stroke="#c5a044" stroke-width="1"/>
    </svg>
  </div>`;
}

// Page chrome for the public campaign DIRECTORY ONLY ("/") — styled to
// match the main criticalsandfumbles.com site's design system (see that
// repo's docs/design-system.md) since this page is meant to be launched
// from there. Hand-rolled plain CSS since this Worker has no Tailwind/
// component layer; values copied by hand, see CLAUDE.md § Visual design.
// Everything downstream of a campaign — its session index and the
// dossier page itself — is genre-themed instead (renderCampaignIndexPage/
// renderDossierPage, via theme.js), NOT run through this shell.
//
// 2026-09-14: recoloured to match cnf-website's "celestial" design system
// (see that repo's app/(site)/globals.css .celestial scope + docs/
// design-system.md — same source-of-truth relationship this file always
// had to the main site, just a different palette on that site's end now).
// This Worker has no CSP, unlike cnf-website (which has to self-host
// these same fonts) — a direct Google Fonts <link> works fine here.
// --emerald is kept as the token NAME (renaming it would mean re-touching
// every rule below for no functional reason) but now holds celestial's
// gold as its value — gold is celestial's primary interactive accent,
// filling the same "the one accent color most links/hovers/badges use"
// role emerald filled in the old palette. --amber holds a second,
// slightly brighter gold shade (kept distinct from --emerald for the
// "recruiting" solid-fill badge specifically, which wants to stand out
// from the plain outline badges). --magenta is celestial's actual
// magenta/pink accent, used the same sparingly-in-a-few-spots way it
// always was here.
function pageShell(title, bodyInner, siteLinks, colorMode = "dark") {
  const nav = SITE_NAV_LINKS.map(
    (l) => `<a href="${escapeHtml(l.href)}"${l.current ? ' class="current"' : ""}>${escapeHtml(l.label)}</a>`,
  ).join("\n");

  const socialPills = (siteLinks?.socialLinks || [])
    .filter((l) => l.url)
    .map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.platform)}</a>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" data-theme="${colorMode}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#020509; --surface:#0d141d; --border:#2a2a2a;
    --text:#e5e7eb; --text-muted:#9ca3af;
    --emerald:#d4af37; --amber:#eab308; --magenta:#f9a8d4;
    --font-display:'EB Garamond', serif;
    --font-body:'Plus Jakarta Sans', sans-serif;
    --font-ui:'Cinzel', serif;
    --font-mono:'Space Grotesk', monospace;
  }
  /* Light mode — same off-white/parchment palette cnf-website's
     /celestial route uses, see that repo's app/(site)/globals.css
     .celestial.celestial-light block. */
  html[data-theme="light"]{
    --bg:#f7f2e6; --surface:#fdf9f0; --border:#d8c69a;
    --text:#2b2416; --text-muted:#6b6152;
    --emerald:#92721f; --amber:#a67c00; --magenta:#be185d;
  }
  *{box-sizing:border-box;}
  html{font-size:18px; -webkit-text-size-adjust:100%; text-size-adjust:100%;}
  body{margin:0; background:var(--bg); color:var(--text); font-family:var(--font-body); font-size:1.125rem;}
  a{color:inherit;}
  .container{max-width:1440px; margin:0 auto; padding:4rem 1rem;}
  @media(min-width:768px){.container{padding-left:2rem; padding-right:2rem;}}
  .back-link{display:inline-block; font-family:var(--font-ui); font-size:.8rem; color:var(--text-muted); text-decoration:none; margin-bottom:1.5rem;}
  .back-link:hover{color:var(--emerald);}
  h1{font-family:var(--font-display); letter-spacing:.02em; font-size:3rem; margin:0 0 .5rem;}
  h1 .emerald{color:var(--emerald);}
  h1 .amber{color:var(--amber);}
  h1 .magenta{color:var(--magenta);}
  .intro{color:var(--text-muted); max-width:65ch; margin:0 0 1.5rem;}

  .cta-row{display:flex; flex-wrap:wrap; gap:.75rem; margin:0 0 2.5rem;}
  .cta-btn{display:inline-flex; align-items:center; font-family:var(--font-ui); font-size:.875rem; font-weight:700; padding:.65rem 1.25rem; border-radius:.4rem; text-decoration:none; transition:opacity .15s ease;}
  .cta-btn:hover{opacity:.85;}
  .cta-discord{background:#5865F2; color:#fff;}
  .cta-whatsapp{background:#25D366; color:#04160c;}

  /* Directory layout: wide list on the left, a narrower sticky "recent
     activity" feed on the right — stacks to a single column on mobile. */
  .directory-layout{display:grid; grid-template-columns:1fr 320px; gap:2.5rem; align-items:start;}
  @media(max-width:860px){.directory-layout{grid-template-columns:1fr;}}

  ul.campaign-list{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:1rem;}
  /* Ornate card bevel + corner notches, matching /celestial's
     .ornate-card/.corner-notch (celestial.css) — same technique, hand-
     copied since there's no shared stylesheet between the two apps. */
  .card{position:relative;}
  .card a{position:relative; display:flex; flex-direction:row; align-items:stretch; overflow:hidden; border:1px solid color-mix(in srgb, var(--emerald) 45%, transparent); border-radius:.5rem; background:var(--surface); text-decoration:none; box-shadow:inset 0 0 20px rgba(0,0,0,.4); transition:border-color .2s ease;}
  .card a:hover{border-color:var(--emerald);}
  .card::before, .card::after{content:''; position:absolute; width:8px; height:8px; pointer-events:none; z-index:1;}
  .card::before{top:4px; left:4px; border-left:1px solid var(--emerald); border-top:1px solid var(--emerald);}
  .card::after{bottom:4px; right:4px; border-right:1px solid var(--emerald); border-bottom:1px solid var(--emerald);}
  /* "not more than a quarter of the card" — capped at 25% width, with a
     sane minimum so it doesn't collapse to nothing on a narrow card. */
  .card-image{flex:0 0 25%; max-width:25%; min-width:120px; aspect-ratio:4/3; background:#0c1a10; overflow:hidden;}
  /* contain, not cover — a campaign's hero image can be any aspect ratio
     (banner-wide, portrait, whatever a DM uploaded) and this card's box
     is a fixed 4/3. cover was cropping a meaningful chunk of the image
     on anything that didn't already happen to match 4/3 (e.g. an
     ultra-wide banner lost roughly half its width off each side).
     contain scales the whole image down to fit instead, letterboxed
     against the box's own background rather than cropped. */
  .card-image img{width:100%; height:100%; object-fit:contain;}
  .card-body{flex:1; min-width:0; display:flex; flex-direction:column; gap:.6rem; padding:1.25rem 1.5rem;}
  .badge-row{display:flex; flex-wrap:wrap; align-items:center; gap:.5rem;}
  .badge{border:1px solid var(--emerald); color:var(--emerald); font-family:var(--font-ui); font-size:.75rem; letter-spacing:.08em; text-transform:uppercase; padding:.25rem 1rem; border-radius:999px;}
  /* Status is the one thing a visitor most needs to spot at a glance —
     "recruiting" campaigns are what the intro copy explicitly points
     people at, so it gets a solid fill instead of the genre badge's
     quieter outline treatment. */
  .status-badge{font-family:var(--font-ui); font-size:.875rem; font-weight:700; padding:.25rem 1rem; border-radius:999px; text-transform:uppercase; letter-spacing:.03em;}
  .status-badge.status-active{background:rgba(46,197,107,.15); color:var(--emerald); border:1px solid var(--emerald);}
  .status-badge.status-recruiting{background:var(--amber); color:#1a1000;}
  .status-badge.status-hiatus{background:transparent; color:var(--text-muted); border:1px solid var(--border);}
  .status-badge.status-concluded{background:transparent; color:var(--text-muted); border:1px solid var(--border); opacity:.7;}
  .card-body h2{font-family:var(--font-display); letter-spacing:.02em; font-size:1.5rem; margin:0; line-height:1.2;}
  .hook{font-size:1.1rem; color:var(--text-muted); margin:0;}
  .meta{display:flex; justify-content:space-between; gap:1rem; font-family:var(--font-mono); font-size:.75rem; color:var(--text-muted); margin-top:auto;}
  .empty{color:var(--text-muted);}

  .sidebar{position:relative; position:sticky; top:2rem; border:1px solid color-mix(in srgb, var(--emerald) 45%, transparent); border-radius:.5rem; background:var(--surface); padding:1.25rem; box-shadow:inset 0 0 20px rgba(0,0,0,.4);}
  .sidebar::before, .sidebar::after{content:''; position:absolute; width:8px; height:8px; pointer-events:none;}
  .sidebar::before{top:4px; left:4px; border-left:1px solid var(--emerald); border-top:1px solid var(--emerald);}
  .sidebar::after{bottom:4px; right:4px; border-right:1px solid var(--emerald); border-bottom:1px solid var(--emerald);}
  .sidebar h3{font-family:var(--font-display); letter-spacing:.02em; font-size:1.15rem; margin:0 0 1rem; color:var(--emerald);}
  .activity-list{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.9rem;}
  .activity-item a{display:block; text-decoration:none; color:inherit; padding-bottom:.9rem; border-bottom:1px solid var(--border);}
  .activity-item:last-child a{border-bottom:none; padding-bottom:0;}
  .activity-item a:hover .activity-title{color:var(--emerald);}
  .activity-title{display:block; font-size:.95rem; margin-bottom:.25rem; transition:color .15s ease;}
  .activity-meta{display:flex; justify-content:space-between; gap:.5rem; font-family:var(--font-mono); font-size:.68rem; color:var(--text-muted);}

  /* Site nav/footer — hand-matched to cnf-website's Nav.tsx/Footer.tsx
     (can't share the actual React components, this is a separate app —
     see CLAUDE.md § Visual design). Scoped to this pageShell only, i.e.
     the "/" directory — the genre-themed session-index/dossier pages
     deliberately don't get this chrome, it would clash with their
     immersive full-bleed design. */
  /* Floating ornate pill — matches /celestial's CelestialNav.tsx shape
     (a genuinely different shape from this page's old full-width bar,
     not just a re-colour); the toggle/hamburger/drawer JS below is
     completely untouched, only these box/shape properties changed. */
  .site-nav{position:sticky; top:.75rem; z-index:50; max-width:1460px; margin:0 auto; border:1px solid color-mix(in srgb, var(--emerald) 40%, transparent); border-radius:999px; background:color-mix(in srgb, var(--surface) 90%, transparent); backdrop-filter:blur(8px); box-shadow:0 4px 25px rgba(0,0,0,.5);}
  .site-nav-inner{max-width:1460px; margin:0 auto; padding:0 1.5rem; height:4rem; display:flex; align-items:center; justify-content:space-between;}
  @media(min-width:768px){.site-nav-inner{padding:0 2rem;}}
  .site-nav-right{display:flex; align-items:center; gap:1.5rem; flex-shrink:0;}
  .site-nav-brand{display:flex; align-items:center; gap:.5rem; text-decoration:none; font-family:var(--font-ui); font-size:.875rem; letter-spacing:.14em; text-transform:uppercase; color:var(--emerald); flex-shrink:0;}
  .site-nav-brand img{width:auto; display:block;}
  .site-nav .site-nav-brand img{height:2.25rem;}
  .site-footer .site-nav-brand img{height:2rem;}
  .site-nav .site-nav-brand span{display:none;}
  @media(min-width:768px){.site-nav .site-nav-brand span{display:inline;}}
  .site-nav-links{display:none; align-items:center; gap:1.5rem; flex-wrap:wrap; row-gap:.5rem; padding:.75rem 0;}
  @media(min-width:768px){.site-nav-links{display:flex;}}
  .site-nav-links > a{font-family:var(--font-ui); font-size:.75rem; font-weight:500; letter-spacing:.14em; text-transform:uppercase; color:var(--text-muted); text-decoration:none; transition:color .15s ease;}
  .mobile-drawer-links > a{font-family:var(--font-display); font-size:1rem; color:var(--text-muted); text-decoration:none; transition:color .15s ease;}
  .site-nav-links > a:hover, .mobile-drawer-links > a:hover{color:var(--emerald);}
  .site-nav-links > a.current, .mobile-drawer-links > a.current{color:var(--emerald);}
  .site-nav-social{display:flex; align-items:center; gap:1rem; flex-shrink:0;}
  .site-nav-social a{display:block; width:18px; height:18px; color:var(--text-muted); transition:color .15s ease;}
  .site-nav-social a:hover{color:var(--emerald);}
  .site-nav-social svg{width:100%; height:100%; display:block;}
  /* Same icon-toggle pattern as the session browser/dossier pages
     (templates/dossier.js) — duplicated here since this is a separate
     template function with its own <style> block, not shared markup. */
  .theme-toggle-btn{display:flex; align-items:center; justify-content:center; width:40px; height:40px; flex-shrink:0; background:none; border:1px solid var(--border); border-radius:999px; color:var(--text); cursor:pointer; padding:0; transition:.15s;}
  .theme-toggle-btn:hover{border-color:var(--emerald);}
  .theme-toggle-btn svg{width:20px; height:20px; display:block;}
  .theme-toggle-btn .icon-moon{display:none;}
  html[data-theme="light"] .theme-toggle-btn .icon-sun{display:none;}
  html[data-theme="light"] .theme-toggle-btn .icon-moon{display:block;}

  /* Mobile nav drawer — a fully separate, self-contained element from
     .site-nav-links (see the HTML comment above .mobile-drawer for why:
     a real-device iOS Safari test showed the drawer collapsing to a
     tiny box when it was the SAME element as the desktop row, toggling
     flex-direction/position via media query — a WebKit fixed-position/
     containing-block quirk that a fresh, independent element sidesteps.
     Uses an explicit height (100dvh with 100vh fallback) rather than
     top:0;bottom:0, since implicit-height fixed elements are exactly
     the pattern that tends to misbehave on iOS Safari with the dynamic
     toolbar. Hand-matched to Nav.tsx's actual drawer otherwise: 280px
     panel, right-aligned text-3xl/font-display links, social+toggle
     below a divider, X close button, Escape key + body-scroll-lock —
     see JS below. */
  .hamburger-btn{display:none; align-items:center; justify-content:center; width:44px; height:44px; flex-shrink:0; background:none; border:none; color:var(--text); cursor:pointer; padding:0;}
  .hamburger-btn svg{width:24px; height:24px; display:block;}
  .nav-close-btn{position:absolute; top:1rem; right:1rem; display:flex; align-items:center; justify-content:center; width:44px; height:44px; background:none; border:none; color:var(--text); cursor:pointer; padding:0;}
  .nav-close-btn svg{width:24px; height:24px; display:block;}
  .mobile-drawer{position:fixed; top:0; right:0; z-index:60; width:280px; max-width:100vw; height:100vh; height:100dvh; padding:1.5rem; padding-top:4.5rem; display:flex; flex-direction:column; flex-wrap:nowrap; align-items:flex-end; gap:1.5rem; background:var(--bg); transform:translateX(100%); transition:transform .22s ease; overflow-x:hidden; overflow-y:auto; box-sizing:border-box;}
  html[data-nav="open"] .mobile-drawer{transform:translateX(0);}
  .mobile-drawer-links{display:flex; flex-direction:column; align-items:flex-end; gap:1.5rem; width:100%;}
  .mobile-drawer-links > a{width:auto; text-align:right; font-family:var(--font-display); font-size:1.875rem; color:var(--text);}
  .nav-drawer-extra{display:flex; flex-direction:column; align-items:flex-end; gap:2rem; width:100%; margin-top:2rem; padding-top:1.5rem; border-top:1px solid var(--border);}
  .nav-drawer-extra .site-nav-social{justify-content:flex-end;}
  .nav-scrim{display:none; position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:59;}
  html[data-nav="open"] .nav-scrim{display:block;}
  @media(max-width:768px){
    .hamburger-btn{display:flex;}
    .site-nav-right{display:none;}
  }
  @media(min-width:768px){
    .mobile-drawer, .nav-scrim{display:none !important;}
  }

  .site-footer{border-top:1px solid var(--border); padding:3rem 1rem;}
  @media(min-width:768px){.site-footer{padding-left:2rem; padding-right:2rem;}}
  .site-footer-grid{max-width:1440px; margin:0 auto; display:grid; grid-template-columns:1fr; gap:2.5rem;}
  @media(min-width:768px){.site-footer-grid{grid-template-columns:repeat(3, 1fr);}}
  .site-footer-desc{margin:1rem 0 0; max-width:30ch; font-size:.875rem; color:var(--text-muted);}
  .site-footer-values{margin:1rem 0 0; font-family:var(--font-ui); font-size:.75rem;}
  /* Pre-existing markup (site-footer-values below) referenced these
     span classes with no matching rule outside an h1 — genuinely
     unstyled before this pass, fixed in passing since it's a one-line,
     zero-risk addition directly in scope of this recolour. */
  .emerald{color:var(--emerald);}
  .amber{color:var(--amber);}
  .magenta{color:var(--magenta);}
  .site-footer h3{margin:0 0 1rem; font-family:var(--font-ui); font-size:.85rem; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted);}
  .site-footer-nav{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.5rem;}
  .site-footer-nav a{font-size:.875rem; text-decoration:none; color:var(--text); transition:color .15s ease;}
  .site-footer-nav a:hover{color:var(--emerald);}
  .footer-discord-btn{display:inline-flex; align-items:center; margin-top:0; min-height:44px; padding:.5rem 1rem; border-radius:.375rem; background:var(--emerald); color:var(--bg); font-family:var(--font-ui); font-size:.85rem; text-decoration:none; transition:opacity .15s ease;}
  .footer-discord-btn:hover{opacity:.9;}
  .footer-social-pills{display:flex; flex-wrap:wrap; gap:.5rem; margin-top:1rem;}
  .footer-social-pills a{border:1px solid var(--border); border-radius:999px; padding:.25rem .75rem; font-family:var(--font-ui); font-size:.75rem; color:var(--text-muted); text-decoration:none; transition:color .15s ease, border-color .15s ease;}
  .footer-social-pills a:hover{border-color:var(--emerald); color:var(--emerald);}
  .site-footer-bottom{max-width:1440px; margin:2.5rem auto 0; padding-top:1.5rem; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:.5rem; font-size:.75rem; color:var(--text-muted);}
  @media(min-width:768px){.site-footer-bottom{flex-direction:row; justify-content:space-between;}}

  /* Astrolabe backdrop + outer ornate frame — hand-ported from
     cnf-website's components/celestial/CelestialBackdrop.tsx (React/
     Tailwind there, plain CSS/SVG here, same reason the rest of this
     page's decorative CSS is hand-copied rather than shared: no build
     step/shared package between the two repos). Fixed + pointer-events
     none, so it never interferes with clicks or affects document flow.
     Simplified from the source slightly (fewer overlapping rings/lines,
     no planetary pulse markers) — this page is a plain server-rendered
     directory list, not the homepage hero it was originally built for,
     and the full ornament density read as too busy over a list of
     cards. Respects prefers-reduced-motion, matching the source. */
  .astrolabe-backdrop{position:fixed; inset:0; z-index:0; overflow:hidden; pointer-events:none;}
  .astrolabe-backdrop .nebula-a{position:absolute; top:5%; right:2%; width:800px; height:800px; border-radius:999px; background:radial-gradient(circle at center, rgba(0,149,138,.16) 0%, rgba(6,95,90,.1) 40%, transparent 70%); filter:blur(60px);}
  .astrolabe-backdrop .nebula-b{position:absolute; top:45%; left:2%; width:700px; height:700px; border-radius:999px; background:radial-gradient(circle at center, rgba(146,114,31,.1) 0%, rgba(79,219,200,.06) 40%, transparent 75%); filter:blur(60px);}
  .astrolabe-backdrop .astrolabe-ring{position:absolute; top:-100px; left:50%; transform:translateX(-50%); width:1500px; max-width:none; aspect-ratio:1; opacity:.55; mix-blend-mode:screen;}
  @media(max-width:900px){.astrolabe-backdrop .astrolabe-ring{width:1100px;}}
  .astrolabe-backdrop .astrolabe-ring svg{width:100%; height:100%;}
  .astrolabe-backdrop .spin-slow{animation:astrolabe-spin-slow 180s linear infinite;}
  .astrolabe-backdrop .spin-reverse{position:absolute; inset:0; width:100%; height:100%; animation:astrolabe-spin-reverse 240s linear infinite;}
  @keyframes astrolabe-spin-slow{from{transform:rotate(0deg);} to{transform:rotate(360deg);}}
  @keyframes astrolabe-spin-reverse{from{transform:rotate(360deg);} to{transform:rotate(0deg);}}
  @media(prefers-reduced-motion:reduce){.astrolabe-backdrop .spin-slow, .astrolabe-backdrop .spin-reverse{animation:none;}}

  .outer-frame{position:fixed; inset:0; z-index:50; padding:.5rem; pointer-events:none; display:flex; flex-direction:column; justify-content:space-between;}
  @media(min-width:640px){.outer-frame{padding:1rem;}}
  .outer-frame .frame-row{position:relative; width:100%; display:flex; align-items:center; justify-content:space-between;}
  .outer-frame .frame-rails{width:100%; flex:1; display:flex; justify-content:space-between; position:relative; padding:0 .25rem;}
  .outer-frame .rail{height:100%; width:1px; background:linear-gradient(to bottom, rgba(212,175,55,.8), rgba(212,175,55,.3), rgba(212,175,55,.8)); position:relative;}
  .outer-frame .rail-notch{position:absolute; top:50%; transform:translateY(-50%) rotate(45deg); width:10px; height:10px; border:1px solid #d4af37; background:var(--bg);}
  .outer-frame .rail:first-child .rail-notch{left:-4px;}
  .outer-frame .rail:last-child .rail-notch{right:-4px;}
  .compass{position:relative; width:2.5rem; height:2.5rem; color:#d4af37; filter:drop-shadow(0 0 6px rgba(212,175,55,.7));}
  @media(min-width:640px){.compass{width:3rem; height:3rem;}}
  .compass svg{width:100%; height:100%;}
  /* Non-positioned in-flow content actually paints BEHIND a position:fixed
     z-index:0 element in CSS's stacking order (fixed/positioned elements
     outrank plain in-flow boxes regardless of z-index value) — without
     this, .astrolabe-backdrop would sit on top of the nav/cards/footer
     instead of behind them. */
  .site-nav, .container, .site-footer{position:relative; z-index:1;}
</style>
</head>
<body>
${ASTROLABE_BACKDROP}
<header class="site-nav">
  <nav class="site-nav-inner">
    <a class="site-nav-brand" href="${MAIN_SITE}/">
      <img src="${MAIN_SITE}/logo.png" alt="Criticals and Fumbles logo">
      <span>Criticals &amp; Fumbles</span>
    </a>
    <div class="site-nav-links">${nav}</div>
    <div class="site-nav-right">
      ${socialIconsBlock(siteLinks)}
      <button class="theme-toggle-btn" id="siteThemeToggle" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
        <svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
    </div>
    <button class="hamburger-btn" id="navHamburger" aria-label="Toggle menu" title="Toggle menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
  </nav>
</header>

<!-- Mobile drawer — a fully separate element from .site-nav-links above,
     not the same DOM node toggling flex-direction. Nav.tsx's real
     mobile drawer is likewise a completely separate block from the
     desktop link row, not a CSS-repurposed version of it — reusing one
     element for both layouts is exactly the shape of bug WebKit's
     fixed-positioning/containing-block quirks trip on (confirmed via a
     real-device screenshot: the drawer rendered as a tiny box instead
     of a full-height panel when it shared markup with the desktop row). -->
<div class="mobile-drawer" id="mobileDrawer">
  <button class="nav-close-btn" id="navClose" aria-label="Close menu" title="Close menu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
  </button>
  <div class="mobile-drawer-links">${nav}</div>
  <div class="nav-drawer-extra">
    ${socialIconsBlock(siteLinks)}
    <button class="theme-toggle-btn" id="siteThemeToggleMobile" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
      <svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
      <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    </button>
  </div>
</div>
<div class="nav-scrim" id="navScrim"></div>

<div class="container">
${bodyInner}
</div>

<footer class="site-footer">
  <div class="site-footer-grid">
    <div>
      <a class="site-nav-brand" href="${MAIN_SITE}/">
        <img src="${MAIN_SITE}/logo.png" alt="Criticals and Fumbles logo">
        <span>${escapeHtml(siteLinks?.title || "Criticals and Fumbles")}</span>
      </a>
      ${siteLinks?.shortDescription ? `<p class="site-footer-desc">${escapeHtml(siteLinks.shortDescription)}</p>` : ""}
      <p class="site-footer-values"><span class="emerald">Community</span> · <span class="amber">Collaboration</span> · <span class="magenta">Care</span></p>
    </div>
    <div>
      <h3>Quick Nav</h3>
      <ul class="site-footer-nav">
        ${SITE_NAV_LINKS.map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`).join("\n")}
      </ul>
    </div>
    <div>
      <h3>Connect</h3>
      ${siteLinks?.discordUrl ? `<a class="footer-discord-btn" href="${escapeHtml(siteLinks.discordUrl)}" target="_blank" rel="noopener noreferrer">Join us on Discord</a>` : ""}
      ${socialPills ? `<div class="footer-social-pills">${socialPills}</div>` : ""}
    </div>
  </div>
  <div class="site-footer-bottom">
    <span>${escapeHtml(siteLinks?.copyrightLine || `© ${new Date().getFullYear()} Criticals and Fumbles. All rights reserved.`)}</span>
    <span>Built with 🎲 by C&amp;F</span>
  </div>
</footer>
<script>
  function toggleTheme(){
    var html = document.documentElement;
    var isLight = html.getAttribute('data-theme') === 'light';
    var next = isLight ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    // Shared with www.criticalsandfumbles.com via a cookie scoped to the
    // parent domain — same cookie name/domain cnf-website's ThemeProvider
    // writes; localStorage can't cross subdomains.
    document.cookie = 'cnf-theme=' + next + '; domain=.criticalsandfumbles.com; path=/; max-age=31536000; SameSite=Lax; Secure';
  }
  document.getElementById('siteThemeToggle').addEventListener('click', toggleTheme);
  document.getElementById('siteThemeToggleMobile').addEventListener('click', toggleTheme);
  (function(){
    var html = document.documentElement;
    var hamburger = document.getElementById('navHamburger');
    var closeBtn = document.getElementById('navClose');
    var scrim = document.getElementById('navScrim');
    var drawer = document.getElementById('mobileDrawer');
    function closeNav(){ html.setAttribute('data-nav', 'closed'); document.body.style.overflow = ''; }
    function openNav(){ html.setAttribute('data-nav', 'open'); document.body.style.overflow = 'hidden'; }
    hamburger.addEventListener('click', function(){
      html.getAttribute('data-nav') === 'open' ? closeNav() : openNav();
    });
    closeBtn.addEventListener('click', closeNav);
    scrim.addEventListener('click', closeNav);
    drawer.addEventListener('click', function(e){
      if (e.target.tagName === 'A') closeNav();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && html.getAttribute('data-nav') === 'open') closeNav();
    });
  })();
</script>
</body>
</html>`;
}

function brandTitle() {
  // Plain text, no color spans — inherits body's var(--text), so it
  // already follows the same light/dark colors as the rest of the page
  // without any new CSS needed.
  return `<h1>Campaign Logs</h1>`;
}

// GET / — public campaign directory. Only campaigns the owning DM has
// marked visible show up here — see schema/campaign.js § visible.
// Sorted by actual recent activity (see ALL_CAMPAIGNS_QUERY's lastActivity
// projection), full-width list rows rather than a card grid, with a
// sidebar feed of the most recently updated sessions across every
// visible campaign.
app.get("/", async (c) => {
  const [campaigns, recent, siteLinks] = await Promise.all([
    query(c.env, ALL_CAMPAIGNS_QUERY),
    query(c.env, RECENT_ACTIVITY_QUERY),
    query(c.env, SITE_LINKS_QUERY),
  ]);

  const cards = (campaigns || [])
    .map((camp) => {
      const imageUrl = urlFor(camp.heroImage).width(400).height(300).url();
      const status = STATUS_LABEL[camp.status] || camp.status;
      const statusClass = STATUS_CLASS[camp.status] || "";
      return `<li class="card">
  <a href="/${encodeURIComponent(camp.slug?.current || "")}">
    <div class="card-image">${imageUrl ? `<img src="${imageUrl}" alt="" loading="lazy">` : ""}</div>
    <div class="card-body">
      <div class="badge-row">
        ${camp.genre ? `<span class="badge">${escapeHtml(camp.genre)}</span>` : ""}
        ${status ? `<span class="status-badge ${statusClass}">${escapeHtml(status)}</span>` : ""}
      </div>
      <h2>${escapeHtml(camp.title)}</h2>
      ${camp.hook ? `<p class="hook">${escapeHtml(camp.hook)}</p>` : ""}
      <div class="meta">
        <span>${escapeHtml(camp.system || "")}</span>
        <span>Updated ${timeAgo(camp.lastActivity)}</span>
      </div>
    </div>
  </a>
</li>`;
    })
    .join("\n");

  const activity = (recent || [])
    .map(
      (d) => `<li class="activity-item">
  <a href="/${encodeURIComponent(d.campaignSlug)}/${encodeURIComponent(d.code)}">
    <span class="activity-title">${escapeHtml(d.sessionLabel || d.code)} — ${escapeHtml(d.title)}</span>
    <span class="activity-meta"><span>${escapeHtml(d.campaignTitle)}</span><span>${timeAgo(d._updatedAt)}</span></span>
  </a>
</li>`,
    )
    .join("\n");

  const ctas = [
    siteLinks?.discordUrl ? `<a class="cta-btn cta-discord" href="${escapeHtml(siteLinks.discordUrl)}" target="_blank" rel="noopener noreferrer">Join us on Discord</a>` : "",
    siteLinks?.whatsappUrl ? `<a class="cta-btn cta-whatsapp" href="${escapeHtml(siteLinks.whatsappUrl)}" target="_blank" rel="noopener noreferrer">Join our WhatsApp Community</a>` : "",
  ].join("\n");

  const body = `${brandTitle()}
  <p class="intro">Catch up on our games here. Please reach out to us if you are interested in any games that are still recruiting.</p>
  ${ctas ? `<div class="cta-row">${ctas}</div>` : ""}
  <div class="directory-layout">
    <ul class="campaign-list">${cards || `<p class="empty">No campaigns published yet.</p>`}</ul>
    <aside class="sidebar">
      <h3>Recent Updates</h3>
      <ul class="activity-list">${activity || `<p class="empty">No sessions published yet.</p>`}</ul>
    </aside>
  </div>`;

  return c.html(pageShell("Campaign Logs", body, siteLinks, resolveColorMode(c)));
});

// GET /:campaignSlug/:dossierCode — the dossier page itself. A dossier
// under a non-visible campaign 404s here too, not just off the directory
// — visible is a real access gate, not just a listing filter.
app.get("/:campaignSlug/:dossierCode", async (c) => {
  const { campaignSlug, dossierCode } = c.req.param();
  const dossier = await query(c.env, DOSSIER_QUERY, { slug: campaignSlug, code: dossierCode });
  if (!dossier || !dossier.campaign?.visible) return c.notFound();

  // ?embed=1 — set by renderCampaignIndexPage's iframe src. Hides this
  // page's own floating theme toggle so the session browser's toggle
  // (which drives this page's theme directly via
  // frame.contentWindow.setDossierTheme(), same-origin) isn't duplicated.
  const html = renderDossierPage({
    dossier,
    campaign: dossier.campaign,
    theme: dossier.campaign?.theme,
    embedded: c.req.query("embed") === "1",
    colorMode: resolveColorMode(c),
  });
  return c.html(html);
});

// GET /:campaignSlug — per-campaign session index. Same 404-if-not-visible
// gate as the dossier page above. Genre-themed two-pane list+detail view
// (renderCampaignIndexPage) — dossiers already come back most-recent-first
// from CAMPAIGN_DOSSIERS_QUERY's order(_createdAt desc).
app.get("/:campaignSlug", async (c) => {
  const { campaignSlug } = c.req.param();
  const campaign = await query(c.env, CAMPAIGN_QUERY, { slug: campaignSlug });
  if (!campaign || !campaign.visible) return c.notFound();

  const dossiers = await query(c.env, CAMPAIGN_DOSSIERS_QUERY, { slug: campaignSlug });

  return c.html(
    renderCampaignIndexPage({ campaign, dossiers, theme: campaign.theme, colorMode: resolveColorMode(c) }),
  );
});

// Coarse relative-time label ("2 hours ago", "3 days ago") for the
// directory list and the recent-activity sidebar — no need for a date
// library over a handful of buckets.
function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.floor(month / 12)}y ago`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default app;
