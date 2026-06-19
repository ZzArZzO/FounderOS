import { generateDrafts } from "../runner";
import { MODELS } from "../config";

/**
 * Advisory only: takes a prompt (a question, feature description, stack trace, or log) and
 * returns a technical spec or a debug analysis as a text draft. No repo access, no code
 * execution — the founder takes the output into Claude Code to build.
 */
export async function runDev(input?: { prompt?: string }): Promise<{ count: number }> {
  const prompt = input?.prompt?.trim();
  if (!prompt) throw new Error("Dev agent needs a 'prompt' (the thing to analyze).");

  const userContent =
    `The founder asked the Dev agent to help with the following. If it's a bug/log/stack trace, ` +
    `produce a "debug" draft: likely root cause + a concrete suggested fix. If it's a feature or ` +
    `design question, produce a "spec" draft: a short technical approach and the key decisions. ` +
    `Match the tech stack and conventions in your memory. Be concrete; no boilerplate.\n\n` +
    `--- Founder's request ---\n${prompt}`;

  const { count } = await generateDrafts({
    agentId: "dev",
    role: "Dev Agent (advisory)",
    model: MODELS.sonnet,
    trigger: "manual",
    defaultKind: "spec",
    effort: "medium",
    maxTokens: 4000,
    userContent,
    input: { prompt },
  });
  return { count };
}
