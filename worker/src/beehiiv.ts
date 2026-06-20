/**
 * beehiiv Create-post integration. On approval of a `newsletter` draft, the
 * executor creates a beehiiv DRAFT post (status="draft") — the founder still
 * hits send inside beehiiv. Uses the public Create-post endpoint:
 *   POST https://api.beehiiv.com/v2/publications/{pubId}/posts
 * (Enterprise-tier endpoint; returns a clear error if the plan lacks access.)
 */

import { config, beehiivConfigured } from "./config";

/** Minimal markdown -> HTML for beehiiv body_content (bold, bullets, headings, paragraphs). */
function mdToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const out: string[] = [];
  let inList = false;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");

  return `<table><tbody><tr><td style="padding:0 20px;">${out.join("\n")}</td></tr></tbody></table>`;
}

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
