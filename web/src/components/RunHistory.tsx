import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AgentRun } from "../types";

export function RunHistory() {
  const [runs, setRuns] = useState<AgentRun[]>([]);

  useEffect(() => {
    supabase
      .from("agent_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRuns((data ?? []) as AgentRun[]));
  }, []);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCost = runs
    .filter((r) => new Date(r.started_at) >= todayStart)
    .reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>Today's spend</strong>
          <span>${todayCost.toFixed(4)}</span>
        </div>
      </div>
      {runs.map((r) => (
        <div className="card" key={r.id}>
          <div className="meta">
            <span><span className="pill">{r.agent_id}</span> {r.trigger}</span>
            <span>{new Date(r.started_at).toLocaleString()}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">
              {r.status} · in {r.input_tokens ?? 0} / out {r.output_tokens ?? 0} tok
            </span>
            <span>${(r.cost_usd ?? 0).toFixed(4)}</span>
          </div>
        </div>
      ))}
      {runs.length === 0 && <div className="empty">No runs yet.</div>}
    </div>
  );
}
