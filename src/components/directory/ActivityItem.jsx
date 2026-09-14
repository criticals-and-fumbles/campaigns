/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { timeAgo } from "./CampaignCard.jsx";

export function ActivityItem({ item }) {
  return (
    <li class="activity-item">
      <a href={`/${encodeURIComponent(item.campaignSlug)}/${encodeURIComponent(item.code)}`}>
        <span class="activity-title">
          {item.sessionLabel || item.code} — {item.title}
        </span>
        <span class="activity-meta">
          <span>{item.campaignTitle}</span>
          <span>{timeAgo(item._updatedAt)}</span>
        </span>
      </a>
    </li>
  );
}
