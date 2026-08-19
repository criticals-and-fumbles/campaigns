import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { renderDossierPage, renderCampaignIndexPage } from "../templates/dossier.js";
import { urlFor } from "../lib/sanity-image.js";

const app = new Hono();

const CAMPAIGN_QUERY = `*[_type == "campaign" && slug.current == $slug][0]{
  _id, title, slug, genre, system, status, gmNames, heroImage, hook,
  sessionCount, motto, signOff, visible,
  "theme": theme->
}`;

const DOSSIER_QUERY = `*[_type == "dossier" && code == $code && campaign->slug.current == $slug][0]{
  ...,
  "campaign": campaign->{ _id, title, slug, system, motto, signOff, visible, "theme": theme-> }
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

// Same inline SVG paths as cnf-website's components/icons/SocialIcons.tsx
// — hand-copied since this Worker can't import that React component
// (separate app). Keep these in sync by hand if the source ever changes.
const SOCIAL_ICON_SVG = {
  Facebook: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.87v-6.98H7.9V12h2.5V9.8c0-2.47 1.47-3.84 3.72-3.84 1.08 0 2.21.19 2.21.19v2.43h-1.24c-1.23 0-1.61.76-1.61 1.54V12h2.74l-.44 2.89h-2.3v6.98A10 10 0 0 0 22 12Z"/></svg>`,
  Instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>`,
  WhatsApp: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.29-.15-1.7-.84-1.97-.93-.26-.1-.46-.15-.65.15-.2.29-.75.93-.92 1.12-.17.2-.34.22-.63.08-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.71-1.61-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.08-.15-.65-1.58-.9-2.16-.24-.57-.48-.49-.65-.5h-.56c-.2 0-.51.07-.78.37-.26.29-1.02 1-1.02 2.43s1.04 2.82 1.19 3.01c.15.2 2.05 3.14 4.98 4.4.69.3 1.24.48 1.66.61.7.22 1.33.19 1.84.12.56-.08 1.7-.7 1.95-1.37.24-.68.24-1.26.17-1.38-.07-.12-.26-.2-.55-.35Z"/><path d="M12.02 2C6.5 2 2 6.48 2 12c0 1.83.5 3.6 1.42 5.15L2 22l4.98-1.36A9.98 9.98 0 0 0 12.02 22C17.53 22 22 17.52 22 12S17.53 2 12.02 2Zm0 18.13c-1.6 0-3.16-.43-4.52-1.24l-.32-.19-3.09.84.83-3.01-.21-.32A8.13 8.13 0 1 1 20.14 12a8.12 8.12 0 0 1-8.12 8.13Z"/></svg>`,
  Discord: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.27 5.33A18.27 18.27 0 0 0 14.85 4c-.2.36-.43.84-.59 1.23a16.9 16.9 0 0 0-4.52 0C9.58 4.84 9.34 4.36 9.14 4a18.2 18.2 0 0 0-4.42 1.33C2.05 8.9 1.38 12.36 1.7 15.77a18.4 18.4 0 0 0 5.51 2.75c.44-.6.84-1.24 1.18-1.92-.65-.24-1.27-.53-1.86-.88.16-.11.31-.23.46-.35a13.1 13.1 0 0 0 11 0c.15.13.3.24.46.35-.59.35-1.21.64-1.86.88.34.68.74 1.32 1.18 1.92a18.35 18.35 0 0 0 5.51-2.75c.38-3.94-.65-7.37-2.73-10.44ZM8.68 13.7c-.83 0-1.5-.75-1.5-1.68 0-.92.66-1.68 1.5-1.68s1.52.76 1.5 1.68c0 .93-.66 1.68-1.5 1.68Zm6.64 0c-.83 0-1.5-.75-1.5-1.68 0-.92.66-1.68 1.5-1.68s1.52.76 1.5 1.68c0 .93-.66 1.68-1.5 1.68Z"/></svg>`,
};

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

// Page chrome for the public campaign DIRECTORY ONLY ("/") — styled to
// match the main criticalsandfumbles.com site's design system (see that
// repo's docs/design-system.md) since this page is meant to be launched
// from there. Hand-rolled plain CSS since this Worker has no Tailwind/
// component layer; values copied by hand, see CLAUDE.md § Visual design.
// Everything downstream of a campaign — its session index and the
// dossier page itself — is genre-themed instead (renderCampaignIndexPage/
// renderDossierPage, via theme.js), NOT run through this shell.
function pageShell(title, bodyInner, siteLinks) {
  const nav = SITE_NAV_LINKS.map(
    (l) => `<a href="${escapeHtml(l.href)}"${l.current ? ' class="current"' : ""}>${escapeHtml(l.label)}</a>`,
  ).join("\n");

  const socialPills = (siteLinks?.socialLinks || [])
    .filter((l) => l.url)
    .map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.platform)}</a>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Crimson+Pro:wght@400;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#111111; --surface:#1a1a1a; --border:#2a2a2a;
    --text:#f0eae0; --text-muted:#666666;
    --emerald:#2ec56b; --amber:#c8893a; --magenta:#d946a8;
    --font-display:'Bebas Neue', sans-serif;
    --font-body:'Crimson Pro', serif;
    --font-ui:'Space Mono', monospace;
  }
  /* Light mode — same palette cnf-website's own light theme uses, see
     that repo's app/(site)/globals.css. This page never had a light
     variant before; added alongside the nav toggle below. */
  html[data-theme="light"]{
    --bg:#fbf0e0; --surface:#f0e8d8; --border:#e0d4c0;
    --text:#1a1208; --text-muted:#8a7055;
    --emerald:#1a7a45; --amber:#b36a1a; --magenta:#c4306a;
  }
  *{box-sizing:border-box;}
  html{font-size:18px;}
  body{margin:0; background:var(--bg); color:var(--text); font-family:var(--font-body); font-size:1.125rem;}
  a{color:inherit;}
  .container{max-width:1400px; margin:0 auto; padding:4rem 1.5rem;}
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
  .card a{display:flex; flex-direction:row; align-items:stretch; overflow:hidden; border:1px solid var(--border); border-radius:.5rem; background:var(--surface); text-decoration:none; transition:border-color .2s ease;}
  .card a:hover{border-color:var(--emerald);}
  /* "not more than a quarter of the card" — capped at 25% width, with a
     sane minimum so it doesn't collapse to nothing on a narrow card. */
  .card-image{flex:0 0 25%; max-width:25%; min-width:120px; aspect-ratio:4/3; background:#0c1a10; overflow:hidden;}
  .card-image img{width:100%; height:100%; object-fit:cover;}
  .card-body{flex:1; min-width:0; display:flex; flex-direction:column; gap:.6rem; padding:1.25rem 1.5rem;}
  .badge-row{display:flex; flex-wrap:wrap; align-items:center; gap:.5rem;}
  .badge{border:1px solid var(--emerald); color:var(--emerald); font-family:var(--font-ui); font-size:.875rem; padding:.25rem 1rem; border-radius:999px;}
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
  .meta{display:flex; justify-content:space-between; gap:1rem; font-family:var(--font-ui); font-size:.75rem; color:var(--text-muted); margin-top:auto;}
  .empty{color:var(--text-muted);}

  .sidebar{position:sticky; top:2rem; border:1px solid var(--border); border-radius:.5rem; background:var(--surface); padding:1.25rem;}
  .sidebar h3{font-family:var(--font-display); letter-spacing:.02em; font-size:1.15rem; margin:0 0 1rem; color:var(--emerald);}
  .activity-list{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.9rem;}
  .activity-item a{display:block; text-decoration:none; color:inherit; padding-bottom:.9rem; border-bottom:1px solid var(--border);}
  .activity-item:last-child a{border-bottom:none; padding-bottom:0;}
  .activity-item a:hover .activity-title{color:var(--emerald);}
  .activity-title{display:block; font-size:.95rem; margin-bottom:.25rem; transition:color .15s ease;}
  .activity-meta{display:flex; justify-content:space-between; gap:.5rem; font-family:var(--font-ui); font-size:.68rem; color:var(--text-muted);}

  /* Site nav/footer — hand-matched to cnf-website's Nav.tsx/Footer.tsx
     (can't share the actual React components, this is a separate app —
     see CLAUDE.md § Visual design). Scoped to this pageShell only, i.e.
     the "/" directory — the genre-themed session-index/dossier pages
     deliberately don't get this chrome, it would clash with their
     immersive full-bleed design. */
  .site-nav{position:sticky; top:0; z-index:50; border-bottom:1px solid var(--border); background:rgba(17,17,17,.95); backdrop-filter:blur(8px);}
  .site-nav-inner{max-width:1400px; margin:0 auto; padding:0 1.5rem; height:64px; display:flex; align-items:center; justify-content:space-between;}
  .site-nav-right{display:flex; align-items:center; gap:1.5rem; flex-shrink:0;}
  .site-nav-brand{display:flex; align-items:center; gap:.5rem; text-decoration:none; font-family:var(--font-ui); font-size:.9rem; flex-shrink:0;}
  .site-nav-brand img{height:32px; width:auto; display:block;}
  .site-nav .site-nav-brand span{display:none;}
  @media(min-width:768px){.site-nav .site-nav-brand span{display:inline;}}
  .site-nav-links{display:flex; align-items:center; gap:1.5rem; flex-wrap:wrap; row-gap:.5rem; padding:.75rem 0;}
  .site-nav-links > a{font-family:var(--font-ui); font-size:1rem; color:var(--text-muted); text-decoration:none; transition:color .15s ease;}
  .site-nav-links > a:hover{color:var(--emerald);}
  .site-nav-links > a.current{color:var(--emerald);}
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
  .theme-toggle-btn .icon-sun{display:none;}
  html[data-theme="light"] .theme-toggle-btn .icon-moon{display:none;}
  html[data-theme="light"] .theme-toggle-btn .icon-sun{display:block;}

  /* Mobile nav drawer — hand-matched to Nav.tsx's drawer (fixed 280px
     panel, right-aligned text-3xl font-display links, social+toggle
     moved into the drawer rather than staying in the top bar, X close
     button, Escape key + body-scroll-lock — see JS below). Reuses the
     same data-attribute + transform + scrim technique already proven by
     the session browser's list-pane drawer (templates/dossier.js's
     .list-pane/.deck-btn/.scrim), applied to <html> here since the
     directory page has no app wrapper element. */
  .hamburger-btn{display:none; align-items:center; justify-content:center; width:44px; height:44px; flex-shrink:0; background:none; border:none; color:var(--text); cursor:pointer; padding:0;}
  .hamburger-btn svg{width:24px; height:24px; display:block;}
  .nav-close-btn{display:none; position:absolute; top:1rem; right:1rem; align-items:center; justify-content:center; width:44px; height:44px; background:none; border:none; color:var(--text); cursor:pointer; padding:0;}
  .nav-close-btn svg{width:24px; height:24px; display:block;}
  .nav-drawer-extra{display:none;}
  .nav-scrim{display:none; position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:59;}
  @media(max-width:768px){
    .hamburger-btn{display:flex;}
    .site-nav-right{display:none;}
    .site-nav-links{position:fixed; top:0; right:0; bottom:0; z-index:60; width:280px; max-width:100vw; margin:0; padding:1.5rem; padding-top:4.5rem; flex-direction:column; flex-wrap:nowrap; align-items:flex-end; gap:1.5rem; row-gap:1.5rem; background:var(--bg); transform:translateX(100%); transition:transform .22s ease; overflow-x:hidden; overflow-y:auto;}
    html[data-nav="open"] .site-nav-links{transform:translateX(0);}
    html[data-nav="open"] .nav-scrim{display:block;}
    .nav-close-btn{display:flex;}
    .site-nav-links > a{width:auto; padding:0; text-align:right; font-family:var(--font-display); font-size:1.875rem; color:var(--text); border-bottom:none;}
    .nav-drawer-extra{display:flex; flex-direction:column; align-items:flex-end; gap:2rem; margin-top:2rem; padding-top:1.5rem; border-top:1px solid var(--border);}
    .nav-drawer-extra .site-nav-social{justify-content:flex-end;}
  }

  .site-footer{border-top:1px solid var(--border); padding:3rem 1.5rem;}
  .site-footer-grid{max-width:1400px; margin:0 auto; display:grid; grid-template-columns:1fr; gap:2.5rem;}
  @media(min-width:768px){.site-footer-grid{grid-template-columns:repeat(3, 1fr);}}
  .site-footer-desc{margin:1rem 0 0; max-width:30ch; font-size:.875rem; color:var(--text-muted);}
  .site-footer-values{margin:1rem 0 0; font-family:var(--font-ui); font-size:.75rem;}
  .site-footer h3{margin:0 0 1rem; font-family:var(--font-ui); font-size:.85rem; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted);}
  .site-footer-nav{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.5rem;}
  .site-footer-nav a{font-size:.875rem; text-decoration:none; color:var(--text); transition:color .15s ease;}
  .site-footer-nav a:hover{color:var(--emerald);}
  .footer-discord-btn{display:inline-flex; align-items:center; margin-top:0; min-height:44px; padding:.5rem 1rem; border-radius:.375rem; background:var(--emerald); color:var(--bg); font-family:var(--font-ui); font-size:.85rem; text-decoration:none; transition:opacity .15s ease;}
  .footer-discord-btn:hover{opacity:.9;}
  .footer-social-pills{display:flex; flex-wrap:wrap; gap:.5rem; margin-top:1rem;}
  .footer-social-pills a{border:1px solid var(--border); border-radius:999px; padding:.25rem .75rem; font-family:var(--font-ui); font-size:.75rem; color:var(--text-muted); text-decoration:none; transition:color .15s ease, border-color .15s ease;}
  .footer-social-pills a:hover{border-color:var(--emerald); color:var(--emerald);}
  .site-footer-bottom{max-width:1400px; margin:2.5rem auto 0; padding-top:1.5rem; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:.5rem; font-size:.75rem; color:var(--text-muted);}
  @media(min-width:768px){.site-footer-bottom{flex-direction:row; justify-content:space-between;}}
</style>
</head>
<body>
<header class="site-nav">
  <nav class="site-nav-inner">
    <a class="site-nav-brand" href="${MAIN_SITE}/">
      <img src="${MAIN_SITE}/logo.png" alt="Criticals and Fumbles logo">
      <span>Criticals &amp; Fumbles</span>
    </a>
    <div class="site-nav-links" id="siteNavLinks">
      ${nav}
      <div class="nav-drawer-extra">
        ${socialIconsBlock(siteLinks)}
        <button class="theme-toggle-btn" id="siteThemeToggleMobile" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
          <svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
          <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
      </div>
      <button class="nav-close-btn" id="navClose" aria-label="Close menu" title="Close menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
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
    html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  }
  document.getElementById('siteThemeToggle').addEventListener('click', toggleTheme);
  document.getElementById('siteThemeToggleMobile').addEventListener('click', toggleTheme);
  (function(){
    var html = document.documentElement;
    var hamburger = document.getElementById('navHamburger');
    var closeBtn = document.getElementById('navClose');
    var scrim = document.getElementById('navScrim');
    var navLinks = document.getElementById('siteNavLinks');
    function closeNav(){ html.setAttribute('data-nav', 'closed'); document.body.style.overflow = ''; }
    function openNav(){ html.setAttribute('data-nav', 'open'); document.body.style.overflow = 'hidden'; }
    hamburger.addEventListener('click', function(){
      html.getAttribute('data-nav') === 'open' ? closeNav() : openNav();
    });
    closeBtn.addEventListener('click', closeNav);
    scrim.addEventListener('click', closeNav);
    navLinks.addEventListener('click', function(e){
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
  return `<h1><span class="emerald">Criticals</span> <span class="amber">&amp;</span> <span class="magenta">Fumbles</span></h1>`;
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

  return c.html(pageShell("Campaigns — Criticals & Fumbles", body, siteLinks));
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

  return c.html(renderCampaignIndexPage({ campaign, dossiers, theme: campaign.theme }));
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
