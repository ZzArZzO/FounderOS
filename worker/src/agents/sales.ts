import { listRecentThreads } from "../google";
import { draftReplyForThread } from "./_replies";
import { MODELS, googleConfigured } from "../config";

/**
 * Sales follow-ups: scans recent threads and drafts a nudge for ones that have gone quiet and
 * warrant a follow-up. The model skips anything that isn't a sales conversation.
 */
export async function runSales(input?: Record<string, unknown>): Promise<{ count: number }> {
  if (!googleConfigured) throw new Error("Sales needs Google — set GOOGLE_* env vars.");

  const threads = await listRecentThreads("newer_than:21d -in:chats category:primary", 15);

  let count = 0;
  for (const thread of threads) {
    count += await draftReplyForThread({
      agentId: "sales",
      role: "Sales Agent",
      model: MODELS.sonnet,
      thread,
      instruction:
        "Only act if this is a SALES conversation that has gone quiet and warrants a follow-up " +
        "nudge, using the positioning and cadence in your memory. Otherwise skip. If you reply, " +
        "keep it short, personal, and move the deal forward.",
    });
  }

  return { count };
}
