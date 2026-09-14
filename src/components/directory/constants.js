// Moved out of src/routes/dossier.js during its JSX conversion — shared
// between the directory page's components (SiteNav.jsx, SiteFooter.jsx)
// and the route handler itself.
export const MAIN_SITE = "https://www.criticalsandfumbles.com";

// Mirrors cnf-website's NAV_LINKS (components/layout/Nav.tsx) with
// "Campaigns" inserted — this Worker isn't a route in that Next.js app,
// so it can't share that component, only match its shape by hand. If
// that list changes there, update this one too; nothing keeps them in
// sync automatically.
export const SITE_NAV_LINKS = [
  { label: "About", href: `${MAIN_SITE}/about` },
  { label: "Events", href: `${MAIN_SITE}/events` },
  { label: "Campaigns", href: "/", current: true },
  { label: "Wiki", href: `${MAIN_SITE}/wiki` },
  { label: "Team", href: `${MAIN_SITE}/team` },
  { label: "Resources", href: `${MAIN_SITE}/resources` },
];
