/**
 * beehiiv Create-post integration. On approval of a `newsletter` draft, the
 * executor creates a beehiiv DRAFT post (status="draft") — the founder still
 * hits send inside beehiiv. Uses the public Create-post endpoint:
 *   POST https://api.beehiiv.com/v2/publications/{pubId}/posts
 * (Enterprise-tier endpoint; returns a clear error if the plan lacks access.)
 */

import { config, beehiivConfigured } from "./config";
import { mdToHtml } from "./markdown";

export async function createBeehiivDraft(
  title: string,
  markdown: string,
): Promise<{ id: string; url?: string }> {
  if (!beehiivConfigured) {
    throw new Error("beehiiv not configured — set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID.");
  }
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${config.beehiiv.publicationId}/posts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.beehiiv.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body_content: mdToHtml(markdown), status: "draft" }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`beehiiv create post failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json().catch(() => ({}));
  const post = data?.data ?? data ?? {};
  return { id: post.id ?? "", url: post.web_url ?? post.url };
}

/** Read subscriber counts (read endpoint, works on any plan). Null on error. */
export async function getSubscriberStats(): Promise<{ active: number | null; total: number | null } | null> {
  if (!beehiivConfigured) return null;
  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${config.beehiiv.publicationId}?expand[]=stats`,
      { headers: { Authorization: `Bearer ${config.beehiiv.apiKey}` } },
    );
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => ({}));
    const stats = data?.data?.stats ?? data?.stats ?? {};
    return {
      active: stats.active_subscriptions ?? stats.total_active_subscriptions ?? null,
      total: stats.total_subscriptions ?? null,
    };
  } catch {
    return null;
  }
}
