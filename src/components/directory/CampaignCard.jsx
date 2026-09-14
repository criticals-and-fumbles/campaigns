/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { urlFor } from "../../lib/sanity-image.js";

const STATUS_LABEL = {
  active: "Active",
  recruiting: "Recruiting",
  hiatus: "On Hiatus",
  concluded: "Concluded",
};

// CSS class per status — see .status-badge.* rules in styles.js for the
// actual colors. "recruiting" gets the loudest treatment (solid amber
// fill) since the directory's intro copy specifically points visitors at
// recruiting campaigns.
const STATUS_CLASS = {
  active: "status-active",
  recruiting: "status-recruiting",
  hiatus: "status-hiatus",
  concluded: "status-concluded",
};

// Coarse relative-time label ("2 hours ago", "3 days ago") — no need for
// a date library over a handful of buckets. Shared with ActivityItem.jsx
// (duplicated there rather than a shared util — both are small enough
// that a shared import wasn't worth it over copy-paste, same call this
// codebase already made for CSS between console.js/dossier.js).
export function timeAgo(iso) {
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

export function CampaignCard({ campaign }) {
  const imageUrl = urlFor(campaign.heroImage).width(400).height(300).url();
  const status = STATUS_LABEL[campaign.status] || campaign.status;
  const statusClass = STATUS_CLASS[campaign.status] || "";

  return (
    <li class="card">
      <a href={`/${encodeURIComponent(campaign.slug?.current || "")}`}>
        <div class="card-image">{imageUrl && <img src={imageUrl} alt="" loading="lazy" />}</div>
        <div class="card-body">
          <div class="badge-row">
            {campaign.genre && <span class="badge">{campaign.genre}</span>}
            {status && <span class={`status-badge ${statusClass}`}>{status}</span>}
          </div>
          <h2>{campaign.title}</h2>
          {campaign.hook && <p class="hook">{campaign.hook}</p>}
          <div class="meta">
            <span>{campaign.system || ""}</span>
            <span>Updated {timeAgo(campaign.lastActivity)}</span>
          </div>
        </div>
      </a>
    </li>
  );
}
