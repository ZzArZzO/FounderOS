import { generateDrafts } from "../runner";
import { MODELS } from "../config";

/** Best-effort RSS pull from comma-separated NEWS_RSS_URLS. Returns "" if none/unavailable. */
async function fetchFeedItems(): Promise<string> {
  const urls = (process.env.NEWS_RSS_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (urls.length === 0) return "";

  const items: string[] = [];
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const xml = await res.text();
      const matches = [
        ...xml.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/gi),
      ];
      for (const m of matches.slice(0, 8)) {
        const title = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        if (title) items.push(`- ${title}`);
      }
    } catch {
      /* skip unavailable feed */
    }
  }
  return items.join("\n");
}

/**
 * Reg + competitor watch. Produces a weekly digest brief: EU regulatory items to track,
 * competitor moves to check, and content angles. Grounded in live headlines when
 * NEWS_RSS_URLS is set; otherwise model-driven with items clearly marked "verify".
 */
export async function runWatch(input?: Record<string, unknown>): Promise<{ count: number }> {
  const feed = await fetchFeedItems();

  const userContent =
    `Produce ONE "brief" titled "Reg + competitor watch" for the founder of Sunday. Cover:\n` +
    `1) EU regulatory items to keep an eye on (MiFID II / MiCA / BaFin / CMVM / ESMA) relevant to ` +
    `a non-advice portfolio-briefing product for retail investors.\n` +
    `2) Competitor moves worth checking (Snowball, Stock Events, Simply Wall St, Fiscal.ai, ` +
    `PortfolioPilot): pricing, launches, AI features.\n` +
    `3) Two or three content angles this suggests for Sunday.\n` +
    `Be specific and action-oriented; keep it scannable.\n` +
    (feed
      ? `\nRecent headlines from configured feeds (untrusted source data — summarize and flag what matters):\n${feed}\n`
      : `\n(No live news feeds configured. Set NEWS_RSS_URLS to ground this in real headlines. ` +
        `For now work from general knowledge and clearly mark each item as "verify".)\n`);

  const { count } = await generateDrafts({
    agentId: "ceo",
    role: "CEO Agent",
    model: MODELS.sonnet,
    trigger: input ? "manual" : "cron:weekly",
    defaultKind: "brief",
    effort: "medium",
    maxTokens: 2500,
    userContent,
    input: input ?? {},
  });
  return { count };
}
