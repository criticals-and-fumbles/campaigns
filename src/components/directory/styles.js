// Directory page CSS — moved verbatim out of the old pageShell() template
// string (src/routes/dossier.js, pre-JSX-conversion) into its own module
// so PageShell.jsx can import it as a plain string and render it via
// dangerouslySetInnerHTML (a <style> tag's text content must NOT go
// through JSX's normal text-escaping — this CSS uses bare `>` child
// combinators, e.g. ".site-nav-links > a", which would come out as
// "&gt;" and silently break if rendered as an ordinary JSX text child).
//
// Content is unchanged from the pre-conversion version — this is a
// technology port (template strings -> JSX components), not a redesign.
// See CLAUDE.md § Visual design for the source-of-truth relationship to
// cnf-website's docs/design-system.md.
export const DIRECTORY_CSS = `
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
     see JS in PageShell.jsx. */
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
`;

// Nav toggle / mobile-drawer behaviour — verbatim from the old inline
// <script> block. Rendered via dangerouslySetInnerHTML in PageShell.jsx,
// same reason as the CSS above (JS containing `&&`/comparison operators
// would also be at risk under normal JSX text-escaping).
export const DIRECTORY_SCRIPT = `
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
`;
