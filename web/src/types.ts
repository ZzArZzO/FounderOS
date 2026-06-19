export interface Draft {
  id: string;
  run_id: string | null;
  agent_id: string;
  kind: string;
  title: string;
  body: string;
  body_edited: string | null;
  meta: Record<string, unknown>;
  status: string;
  reject_reason: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  status: string;
  trigger: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  started_at: string;
}

export interface Memory {
  id: string;
  scope: string;
  kind: string;
  key: string;
  content: string;
  weight: number;
  updated_at: string;
}
