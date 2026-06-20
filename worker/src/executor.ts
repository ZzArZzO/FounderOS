import { db, type DraftRow } from "./db";
import { createGmailDraft, saveDriveDoc } from "./google";
import { createBeehiivDraft } from "./beehiiv";
import { googleConfigured, beehiivConfigured } from "./config";
import { findViolations } from "./guardrails";

/**
 * Acts on approved drafts — the ONLY place a side-effect happens, and only on status='approved'.
 * Side-effects are kept conservative: emails become Gmail DRAFTS (never sent), documents are
 * saved to Drive, everything else is acknowledged (marked sent).
 */
export async function processApprovedDrafts(): Promise<void> {
  const { data, error } = await db
    .from("drafts")
    .select("*")
    .eq("status", "approved")
    .limit(20);
  if (error) {
    console.error("[executor] fetch error:", error.message);
    return;
  }

  for (const draft of (data ?? []) as DraftRow[]) {
    try {
      await handle(draft);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[executor] draft ${draft.id} failed:`, msg);
      await db
        .from("drafts")
        .update({ status: "failed", reject_reason: msg, decided_at: new Date().toISOString() })
        .eq("id", draft.id);
    }
  }
}

async function markSent(id: string, meta?: Record<string, unknown>) {
  await db
    .from("drafts")
    .update({ status: "sent", decided_at: new Date().toISOString(), ...(meta ? { meta } : {}) })
    .eq("id", id);
}

async function handle(draft: DraftRow): Promise<void> {
  const content = draft.body_edited ?? draft.body;
  const meta = draft.meta ?? {};

  switch (draft.kind) {
    case "email_reply": {
      if (!googleConfigured) throw new Error("Google not configured — cannot create Gmail draft.");
      const to = String(meta.to ?? "");
      const subject = String(meta.subject ?? draft.title);
      const threadId = meta.thread_id ? String(meta.thread_id) : undefined;
      const draftId = await createGmailDraft(threadId, to, subject, content);
      await markSent(draft.id, { ...meta, gmail_draft_id: draftId });
      break;
    }

    case "contract_draft":
    case "risk_review": {
      if (googleConfigured) {
        const url = await saveDriveDoc(`FounderOS — ${draft.title}`, content);
        await markSent(draft.id, { ...meta, drive_url: url });
      } else {
        await markSent(draft.id);
      }
      break;
    }

    case "social_post":
    case "newsletter": {
      // Final non-advice check on the (possibly founder-edited) copy before it
      // can go public. Currently "publish" = mark sent (manual posting); the
      // guard is here so wiring a real publisher later can't bypass it.
      const violations = findViolations(content);
      if (violations.length) {
        throw new Error(`blocked by non-advice guardrail: ${violations.join(", ")}`);
      }
      if (draft.kind === "newsletter" && beehiivConfigured) {
        const title = String(meta.subject ?? draft.title).replace(/^⚠️ Needs compliance edit — /, "");
        const post = await createBeehiivDraft(title, content);
        await markSent(draft.id, { ...meta, beehiiv_post_id: post.id, beehiiv_url: post.url });
      } else {
        await markSent(draft.id);
      }
      break;
    }

    case "memory_update": {
      const scope = String(meta.scope ?? "global");
      const key = String(meta.key ?? "");
      const newContent = String(meta.new_content ?? content);
      if (!key) throw new Error("memory_update missing meta.key");

      const { data: existing } = await db
        .from("agent_memory")
        .select("content")
        .eq("scope", scope)
        .eq("key", key)
        .maybeSingle();

      await db.from("agent_memory").upsert(
        { scope, key, kind: String(meta.kind ?? "fact"), content: newContent, updated_at: new Date().toISOString() },
        { onConflict: "scope,key" },
      );
      await db.from("memory_log").insert({
        scope,
        key,
        old_content: existing?.content ?? null,
        new_content: newContent,
        source: draft.run_id ? `run:${draft.run_id}` : "reject_feedback",
      });
      await markSent(draft.id);
      break;
    }

    // social_post | newsletter | brief | spec | debug — read-only, just acknowledge.
    default:
      await markSent(draft.id);
  }
}
