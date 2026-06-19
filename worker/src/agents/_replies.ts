import { runAgent, insertDrafts, extractJson } from "../runner";
import type { Thread } from "../google";

const REPLY_CONTRACT = `

Respond with ONLY this JSON, no prose:
{"action":"reply"|"skip","reason":"<why>","subject":"<reply subject>","body":"<reply body in the founder's voice>"}
Use "skip" if no reply is warranted.`;

/**
 * Drafts a single email reply for one thread (so thread_id/recipient stay accurate), or skips.
 * Returns 1 if a draft was inserted, 0 if skipped.
 */
export async function draftReplyForThread(args: {
  agentId: string;
  role: string;
  model: string;
  thread: Thread;
  instruction: string;
}): Promise<number> {
  const { agentId, role, model, thread, instruction } = args;

  const userContent =
    `${instruction}\n\n--- Email thread ---\n` +
    `From: ${thread.from}\nSubject: ${thread.subject}\n\n${thread.body || thread.snippet}` +
    REPLY_CONTRACT;

  const { runId, text } = await runAgent({
    agentId,
    role,
    model,
    trigger: "internal:reply",
    userContent,
    maxTokens: 1200,
  });

  let parsed: { action?: string; subject?: string; body?: string; reason?: string };
  try {
    parsed = extractJson(text);
  } catch {
    return 0;
  }
  if (parsed.action !== "reply" || !parsed.body) return 0;

  await insertDrafts(runId, agentId, [
    {
      kind: "email_reply",
      title: `Re: ${thread.subject || "(no subject)"}`,
      body: parsed.body,
      meta: {
        thread_id: thread.threadId,
        to: thread.from,
        subject: parsed.subject ?? `Re: ${thread.subject}`,
      },
    },
  ]);
  return 1;
}
