/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { MAIN_SITE, SITE_NAV_LINKS } from "./constants.js";

export function SiteFooter({ siteLinks }) {
  const socialPills = (siteLinks?.socialLinks || []).filter((l) => l.url);

  return (
    <footer class="site-footer">
      <div class="site-footer-grid">
        <div>
          <a class="site-nav-brand" href={`${MAIN_SITE}/`}>
            <img src={`${MAIN_SITE}/logo.png`} alt="Criticals and Fumbles logo" />
            <span>{siteLinks?.title || "Criticals and Fumbles"}</span>
          </a>
          {siteLinks?.shortDescription && <p class="site-footer-desc">{siteLinks.shortDescription}</p>}
          <p class="site-footer-values">
            <span class="emerald">Community</span> · <span class="amber">Collaboration</span> ·{" "}
            <span class="magenta">Care</span>
          </p>
        </div>

        <div>
          <h3>Quick Nav</h3>
          <ul class="site-footer-nav">
            {SITE_NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Connect</h3>
          {siteLinks?.discordUrl && (
            <a class="footer-discord-btn" href={siteLinks.discordUrl} target="_blank" rel="noopener noreferrer">
              Join us on Discord
            </a>
          )}
          {socialPills.length > 0 && (
            <div class="footer-social-pills">
              {socialPills.map((l) => (
                <a key={l.platform} href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div class="site-footer-bottom">
        <span>{siteLinks?.copyrightLine || `© ${new Date().getFullYear()} Criticals and Fumbles. All rights reserved.`}</span>
        <span>Built with 🎲 by C&F</span>
      </div>
    </footer>
  );
}
