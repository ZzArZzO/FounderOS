import { generateDrafts } from "../runner";
import { MODELS } from "../config";
import { getMarketContext } from "../marketContext";

export async function runMarketing(input?: { topic?: string }): Promise<{ count: number }> {
  const topic = input?.topic?.trim();
  const market = await getMarketContext();

  const userContent =
    `Plan this week's Sunday marketing as a CONTENT CALENDAR, grounded in the business and brand ` +
    `voice in your memory.\n` +
    (topic ? `Focus topic: ${topic}\n` : "") +
    (market
      ? `Live market context (factual — reference as neutral observations, NEVER as advice):\n${market}\n`
      : `(Live market data unavailable — keep copy evergreen.)\n`) +
    `Produce 5 social posts (kind "social_post"; set "channel" to LinkedIn or X and "day" Mon–Fri) ` +
    `and 1 newsletter section (kind "newsletter", the "Market Week Ahead"). Spread the angles across ` +
    `the week (privacy-first, stocks+crypto, signal-vs-noise, the Sunday ritual, conflict-free). ` +
    `Specific and on-brand — no generic filler, and strictly non-advice. ` +
    `CRITICAL — never use advice vocabulary: do NOT write "recommend", "you should", ` +
    `"buy"/"sell"/"take profits"/"buy the dip"/"time to", or "consider trimming/selling". ` +
    `State everything as neutral observation or education. ` +
    `Write like a human, not an AI (see your writing_style memory): no em dashes or en dashes, ` +
    `no AI-tell vocabulary, plain and direct with varied sentence length.`;

  const { count } = await generateDrafts({
    agentId: "marketing",
    role: "Marketing Agent",
    model: MODELS.sonnet,
    trigger: input ? "manual" : "cron:weekly",
    defaultKind: "social_post",
    effort: "low",
    maxTokens: 3500,
    userContent,
    input: input ?? {},
  });
  return { count };
}
