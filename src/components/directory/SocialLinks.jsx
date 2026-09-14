/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { SOCIAL_ICON_SVG } from "../../lib/icons.js";

// Same set/order as cnf-website's Nav.tsx SocialLinks (facebook,
// instagram, discord, whatsapp) — built from the same siteLinks data the
// footer already uses, so no extra query needed. Ported from the old
// socialIconsBlock() string-template helper.
export function SocialLinks({ siteLinks }) {
  const bySocial = (platform) => (siteLinks?.socialLinks || []).find((l) => l.platform === platform)?.url;
  const links = [
    { label: "Facebook", url: bySocial("Facebook") },
    { label: "Instagram", url: bySocial("Instagram") },
    { label: "Discord", url: siteLinks?.discordUrl },
    { label: "WhatsApp Community", url: bySocial("WhatsApp") },
  ].filter((l) => l.url);

  if (links.length === 0) return null;

  return (
    <div class="site-nav-social">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          dangerouslySetInnerHTML={{ __html: SOCIAL_ICON_SVG[l.label.startsWith("WhatsApp") ? "WhatsApp" : l.label] }}
        />
      ))}
    </div>
  );
}
