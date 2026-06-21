import { anthropic } from "./anthropic";
import { db, type DraftInput } from "./db";
import { buildSystemPrompt } from "./memory";
import { estimateCostUsd, MODELS } from "./config";
import { errMessage } from "./util";
import { findViolations, isCompliant } from "./guardrails";

// Public-facing kinds get the non-advice guardrail; internal briefs/specs/reviews
// (which may legitimately say "recommend") do not.
const PUBLIC_KINDS = new Set(["social_post", "newsletter", "blog_post"]);

interface DraftCandidate {
  kind?: string;
  title?: string;
  body?: string;
  channel?: string;
  day?: string;
}

interface RunOpts {
  agentId: string;
  role: string;
  model: string;
  trigger: string;
  /** Volatile per-run context — goes in the user message, never the cached system prompt. */
  userContent: string;
  input?: Record<string, unknown>;
  thinking?: boolean; // adaptive thinking (use for Opus work)
  effort?: "low" | "medium" | "high"; // only opus/sonnet support this
  maxTokens?: number;
}

export interface RunResult {
  runId: string;
  text: string;
}

/** One Claude call wrapped in an agent_runs record with token usage + cost. */
export async function runAgent(opts: RunOpts): Promise<RunResult> {
  const { data: run, error: runErr } = await db
    .from("agent_runs")
    .insert({ agent_id: opts.agentId, trigger: opts.trigger, input: opts.input ?? null })
    .select("id")
    .single();
  if (runErr) throw runErr;
  const runId = run.id as string;

  try {
    const system = await buildSystemPrompt(opts.agentId, opts.role);

    const params: Record<string, unknown> = {
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4000,
      system,
      messages: [{ role: "user", content: opts.userContent }],
    };
    if (opts.thinking) params.thinking = { type: "adaptive" };
    if (opts.effort && opts.model !== MODELS.haiku) {
      params.output_config = { effort: opts.effort };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await anthropic.messages.create(params as any);

    const text: string = (res.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    const usage = res.usage ?? {};
    await db
      .from("agent_runs")
      .update({
        status: "done",
        input_tokens: usage.input_tokens ?? null,
        output_tokens: usage.output_tokens ?? null,
        cost_usd: estimateCostUsd(opts.model, usage),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return { runId, text };
  } catch (e) {
    await db
      .from("agent_runs")
      .update({
        status: "error",
        error: errMessage(e),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw e;
  }
}

/** Insert draft rows tied to a run. */
export async function insertDrafts(
  runId: string,
  agentId: string,
  drafts: DraftInput[],
): Promise<number> {
  if (drafts.length === 0) return 0;
  const rows = drafts.map((d) => ({
    run_id: runId,
    agent_id: agentId,
    kind: d.kind,
    title: d.title,
    body: d.body,
    meta: d.meta ?? {},
  }));
  const { error } = await db.from("drafts").insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Tolerant JSON extraction — handles bare JSON or ```json fenced blocks. */
export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  }
  throw new Error("Could not parse JSON from model output");
}

const JSON_CONTRACT = `

Respond with ONLY a JSON object, no prose, in exactly this shape:
{"drafts":[{"kind":"<kind>","title":"<short label>","body":"<the content>","channel":"<optional: LinkedIn|X|newsletter>","day":"<optional: Mon..Sun>"}]}
Do not wrap it in markdown. Each draft's "body" is the full content the founder will review.`;

/** One Haiku pass to strip advice-like phrasing while preserving meaning. */
async function rewriteForCompliance(text: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await anthropic.messages.create({
    model: MODELS.haiku,
    max_tokens: 1500,
    system:
      "You enforce a strict non-advice policy for a regulated EU fintech (MiFID II / MiCA). " +
      "Rewrite the copy so it contains NO personal investment advice or recommendations " +
      "(no 'you should', 'recommend', 'buy/sell/take profits', 'buy the dip', 'time to buy', etc.). " +
      "Keep it factual, observational, and educational; preserve meaning, tone, and length. " +
      "Output ONLY the rewritten text.",
    messages: [{ role: "user", content: text }],
  });
  return (res.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();
}

/** Keep a compliant body as-is; otherwise rewrite up to `maxAttempts` times.
 *  Returns the cleaned body (or the founder's original if all attempts fail)
 *  plus any remaining violations — the caller flags those for review, never drops. */
async function makeCompliant(
  body: string,
  maxAttempts = 2,
): Promise<{ body: string; violations: string[] }> {
  if (isCompliant(body)) return { body, violations: [] };
  let current = body;
  for (let i = 0; i < maxAttempts; i++) {
    current = await rewriteForCompliance(current);
    if (isCompliant(current)) return { body: current, violations: [] };
  }
  // Still non-compliant after retries — keep the original content for the founder to edit.
  return { body, violations: findViolations(body) };
}

/** Strip AI-tell em/en dashes from public copy (hyphens in compound words stay). */
export function humanizeDashes(text: string): string {
  return text
    .replace(/(^|\n)[ \t]*[—–][ \t]*/g, "$1") // leading dash (signatures, list intros)
    .replace(/\s+[—–]\s+/g, ", ") // connector dash -> comma
    .replace(/[—–]/g, "-"); // any remaining (e.g. ranges) -> hyphen
}

/**
 * High-level helper for agents that emit a list of drafts (marketing, dev, legal, ceo).
 * Adds the JSON contract, runs the model, parses, attaches default meta, inserts.
 */
export async function generateDrafts(opts: RunOpts & {
  defaultKind: string;
  defaultMeta?: Record<string, unknown>;
}): Promise<{ runId: string; count: number }> {
  const { text, runId } = await runAgent({
    ...opts,
    userContent: opts.userContent + JSON_CONTRACT,
  });

  let candidates: DraftCandidate[];
  try {
    candidates = (extractJson<{ drafts?: DraftCandidate[] }>(text).drafts ?? []).filter((d) => d.body);
  } catch {
    // Fallback: keep the raw text as a single draft so nothing is lost.
    candidates = [{ kind: opts.defaultKind, title: `${opts.role} output`, body: text }];
  }

  const drafts: DraftInput[] = [];
  let flagged = 0;
  for (const d of candidates) {
    const kind = d.kind ?? opts.defaultKind;
    let body = d.body as string;
    let title = d.title ?? `${opts.role} draft`;
    const meta: Record<string, unknown> = {
      ...(opts.defaultMeta ?? {}),
      ...(d.channel ? { channel: d.channel } : {}),
      ...(d.day ? { day: d.day } : {}),
    };
    if (PUBLIC_KINDS.has(kind)) {
      const { body: clean, violations } = await makeCompliant(body);
      body = clean;
      if (violations.length) {
        // Don't drop — surface it for the founder to fix. Publishing still requires
        // approval, and the executor re-checks before anything goes public.
        title = `⚠️ Needs compliance edit: ${title}`;
        meta.guardrail = "flagged";
        meta.guardrail_violations = violations;
        flagged++;
      }
      // Backstop the "write like a human" rule: no AI-tell em/en dashes in public copy.
      body = humanizeDashes(body);
      title = humanizeDashes(title);
    }
    drafts.push({ kind: kind as DraftInput["kind"], title, body, meta });
  }
  if (flagged) {
    console.warn(`[${opts.agentId}] flagged ${flagged} draft(s) for compliance review`);
  }

  const count = await insertDrafts(runId, opts.agentId, drafts);
  return { runId, count };
}
