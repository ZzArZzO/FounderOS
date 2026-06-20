import { listRecentThreads } from "../google";
import { draftReplyForThread } from "./_replies";
import { MODELS, googleConfigured } from "../config";

/**
 * Early-access handler. Finds replies to the newsletter CTA that mention "early access"
 * and drafts a warm welcome for each (into the approval queue as an email_reply). The
 * founder approves -> it becomes a Gmail draft. Runs under the sales agent.
 */
export async function runEarlyAccess(): Promise<{ count: number }> {
  if (!googleConfigured) throw new Error("Early-access handler needs Google — set GOOGLE_* env vars.");

  const threads = await listRecentThreads('"early access" newer_than:14d -in:chats', 15);

  let count = 0;
  for (const thread of threads) {
    count += await draftReplyForThread({
      agentId: "sales",
      role: "Sales Agent",
      model: MODELS.haiku,
      thread,
      instruction:
        "This person replied asking for early access to the Sunday app. Draft a warm, brief, human " +
        "reply confirming they are on the early-access list and that you will email them the moment " +
        "it is ready. Invite them to reply with what they hold (stocks, crypto) if they want their " +
        "first briefing tailored. Strictly non-advice. No em dashes, no AI vocabulary.",
    });
  }
  return { count };
}
