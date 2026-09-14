/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { DIRECTORY_CSS, DIRECTORY_SCRIPT } from "./styles.js";
import { AstrolabeBackdrop, OuterFrame } from "./Backdrop.jsx";
import { SiteNav } from "./SiteNav.jsx";
import { SiteFooter } from "./SiteFooter.jsx";

// Page chrome for the public campaign DIRECTORY ONLY ("/") — styled to
// match the main criticalsandfumbles.com site's design system (see that
// repo's docs/design-system.md) since this page is meant to be launched
// from there. Converted from a hand-rolled template-string function
// (pageShell()) to a JSX component tree, 2026-09-15, for the same
// component-based authoring pattern cnf-website's own pages use — the
// markup, CSS, and behaviour are otherwise unchanged (see git history
// for the pre-conversion version if something looks different).
// Everything downstream of a campaign — its session index and the
// dossier page itself — is genre-themed instead (renderCampaignIndexPage/
// renderDossierPage, via theme.js), NOT run through this shell.
export function PageShell({ title, siteLinks, colorMode = "dark", children }) {
  return (
    <html lang="en" data-theme={colorMode}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: DIRECTORY_CSS }} />
      </head>
      <body>
        <AstrolabeBackdrop />
        <OuterFrame />
        <SiteNav siteLinks={siteLinks} />
        <div class="container">{children}</div>
        <SiteFooter siteLinks={siteLinks} />
        <script dangerouslySetInnerHTML={{ __html: DIRECTORY_SCRIPT }} />
      </body>
    </html>
  );
}
