import { runAgent, insertDrafts, extractJson, humanizeDashes } from "../runner";
import { getMarketContext } from "../marketContext";
import { renderShort } from "../video";
import { findViolations } from "../guardrails";
import { MODELS } from "../config";

interface Script {
  title?: string;
  cards?: string[];
  cta?: string;
}

/**
 * Proof-of-concept: generate a short "Market Week Ahead" script, render it into a vertical
 * MP4 via Shotstack, and drop a `video` draft (with the playable URL) into the approval queue.
 * Publishing to social still needs the publish-on-approval step; for now you review + post manually.
 */
export async function runVideo(input?: Record<string, unknown>): Promise<{ count: number }> {
  const market = await getMarketContext();

  const userContent =
    `Write a script for a short vertical social video, a "Market Week Ahead" for Sunday. ` +
    `Return ONLY JSON: {"title":"<short title>","cards":["<card>", ...],"cta":"<call to action>"}. ` +
    `4 to 5 cards, each a punchy full-screen caption of at most 6 words. Card 1 is a hook. ` +
    `Include one card with this week's key numbers. Human voice, no em dashes, strictly non-advice.\n` +
    (market ? `\nThis week:\n${market}\n` : "");

  const { runId, text } = await runAgent({
    agentId: "marketing",
    role: "Marketing Agent",
    model: MODELS.sonnet,
    trigger: input ? "manual" : "cron:weekly",
    userContent,
    maxTokens: 800,
  });

  let script: Script;
  try {
    script = extractJson<Script>(text);
  } catch {
    script = {};
  }
  const cards = [...(script.cards ?? []), script.cta]
    .filter(Boolean)
    .map((c) => humanizeDashes(c as string));
  if (cards.length === 0) throw new Error("video script produced no cards");

  const url = await renderShort(cards);

  // Guardrail the script copy (the video is already rendered, so flag rather than block).
  const violations = findViolations(cards.join(" . "));
  const meta: Record<string, unknown> = { video_url: url, channel: "Reels/Shorts/TikTok" };
  let title = humanizeDashes(script.title || "Market Week Ahead short");
  if (violations.length) {
    title = `⚠️ Needs compliance edit: ${title}`;
    meta.guardrail = "flagged";
    meta.guardrail_violations = violations;
  }

  const count = await insertDrafts(runId, "marketing", [
    {
      kind: "video",
      title,
      body: `Short video script:\n\n${cards.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nVideo: ${url}`,
      meta,
    },
  ]);
  return { count };
}
