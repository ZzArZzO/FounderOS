import { db } from "../db";
import { generateDrafts } from "../runner";
import { MODELS } from "../config";

/**
 * The CEO agent reads what the other agents have been doing (recent runs + drafts) and the
 * founder's goals, then produces a weekly strategy + decisions brief. Opus, adaptive thinking.
 */
export async function runCeo(input?: Record<string, unknown>): Promise<{ count: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: runs } = await db
    .from("agent_runs")
    .select("agent_id, trigger, status, started_at")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(50);

  const { data: drafts } = await db
    .from("drafts")
    .select("agent_id, kind, title, status, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  const activity =
    `Agent runs (last 7d):\n` +
    (runs ?? []).map((r) => `- ${r.agent_id} ${r.trigger} [${r.status}] ${r.started_at}`).join("\n") +
    `\n\nDrafts produced/decided (last 7d):\n` +
    (drafts ?? [])
      .map((d) => `- ${d.agent_id}/${d.kind} "${d.title}" [${d.status}]`)
      .join("\n");

  const userContent =
    `You are leading the founder's AI team this week. Using your memory (business + goals) and ` +
    `the team activity below, produce ONE "brief" draft: (1) where things stand, (2) the 3 most ` +
    `important decisions or focuses for the coming week, (3) what each agent should prioritize. ` +
    `Be decisive and specific.\n\n--- Team activity ---\n${activity}`;

  const { count } = await generateDrafts({
    agentId: "ceo",
    role: "CEO Agent",
    model: MODELS.opus,
    trigger: input ? "manual" : "cron:weekly",
    defaultKind: "brief",
    thinking: true,
    effort: "high",
    maxTokens: 4000,
    userContent,
    input: input ?? {},
  });
  return { count };
}
