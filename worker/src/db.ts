import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// Service-role client — bypasses RLS. Server-side only.
export const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type DraftKind =
  | "email_reply"
  | "social_post"
  | "newsletter"
  | "blog_post"
  | "video"
  | "brief"
  | "spec"
  | "debug"
  | "contract_draft"
  | "risk_review"
  | "memory_update";

export type DraftStatus = "pending" | "approved" | "rejected" | "sent" | "failed";

export interface DraftInput {
  kind: DraftKind;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
}

export interface DraftRow extends DraftInput {
  id: string;
  run_id: string | null;
  agent_id: string;
  body_edited: string | null;
  meta: Record<string, unknown>;
  status: DraftStatus;
  reject_reason: string | null;
  created_at: string;
  decided_at: string | null;
}
