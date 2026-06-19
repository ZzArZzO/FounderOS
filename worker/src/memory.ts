import { db } from "./db";

interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * Assembles the cached system prompt for an agent: global profile + this agent's memory.
 * Ordered deterministically (by weight desc, then key) so the byte prefix stays stable and
 * prompt caching keeps hitting. Volatile per-run context must go in the user message, never here.
 */
export async function buildSystemPrompt(agentId: string, role: string): Promise<SystemBlock[]> {
  const { data, error } = await db
    .from("agent_memory")
    .select("scope, key, content, weight")
    .in("scope", ["global", agentId])
    .order("weight", { ascending: false })
    .order("key", { ascending: true });

  if (error) throw error;

  const sections = (data ?? [])
    .map((m) => `## ${m.scope}:${m.key}\n${m.content}`)
    .join("\n\n");

  const text =
    `You are the ${role} in a solo founder's personal operations system (FounderOS).\n` +
    `You produce drafts for the founder to review. You never act on the outside world directly.\n\n` +
    `# Shared context and your memory\n${sections || "(no memory set yet)"}`;

  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}
