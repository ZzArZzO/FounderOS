import { generateDrafts } from "../runner";
import { MODELS } from "../config";

export async function runMarketing(input?: { topic?: string }): Promise<{ count: number }> {
  const topic = input?.topic?.trim();
  const userContent =
    `Write this week's marketing content for the founder, grounded in the business and brand ` +
    `voice in your memory.\n` +
    (topic ? `Focus topic: ${topic}\n` : "") +
    `Produce 5 short social posts (kind "social_post") and 1 newsletter section (kind ` +
    `"newsletter"). Make them specific and on-brand — no generic filler.`;

  const { count } = await generateDrafts({
    agentId: "marketing",
    role: "Marketing Agent",
    model: MODELS.sonnet,
    trigger: input ? "manual" : "cron:weekly",
    defaultKind: "social_post",
    effort: "low",
    maxTokens: 3000,
    userContent,
    input: input ?? {},
  });
  return { count };
}
