import { generateDrafts } from "../runner";
import { listRecentThreads, listTodayEvents } from "../google";
import { draftReplyForThread } from "./_replies";
import { MODELS, googleConfigured } from "../config";

/**
 * Daily brief + reply drafts. Opus writes the brief; Haiku drafts replies per thread.
 * Shared utility that feeds the CEO and Sales agents.
 */
export async function runInbox(input?: Record<string, unknown>): Promise<{ count: number }> {
  if (!googleConfigured) throw new Error("Inbox needs Google — set GOOGLE_* env vars.");

  const threads = await listRecentThreads("newer_than:1d -in:sent -in:chats category:primary", 10);
  const events = await listTodayEvents();

  const summary =
    `Today's calendar:\n${events.length ? events.join("\n") : "(nothing scheduled)"}\n\n` +
    `Recent threads:\n` +
    threads.map((t, i) => `${i + 1}. From ${t.from} — "${t.subject}": ${t.snippet}`).join("\n");

  const { count: briefCount } = await generateDrafts({
    agentId: "inbox",
    role: "Inbox",
    model: MODELS.opus,
    trigger: input ? "manual" : "cron:daily",
    defaultKind: "brief",
    thinking: true,
    effort: "high",
    maxTokens: 2500,
    userContent:
      `Write ONE "brief" draft for the founder's morning: what's urgent, what needs a decision, ` +
      `and the meetings that matter. Be concise.\n\n${summary}`,
    input: input ?? {},
  });

  let replies = 0;
  for (const thread of threads) {
    replies += await draftReplyForThread({
      agentId: "inbox",
      role: "Inbox",
      model: MODELS.haiku,
      thread,
      instruction:
        "Draft a concise reply in the founder's voice if this thread warrants one; otherwise skip.",
    });
  }

  return { count: briefCount + replies };
}
