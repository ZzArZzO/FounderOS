import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { Draft } from "../types";

export function DraftCard({ draft, onDecided }: { draft: Draft; onDecided: () => void }) {
  const [body, setBody] = useState(draft.body);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = body !== draft.body;
  const to = draft.meta?.to as string | undefined;

  async function decide(status: "approved" | "rejected") {
    setBusy(true);
    const patch: Record<string, unknown> = {
      status,
      decided_at: new Date().toISOString(),
    };
    if (status === "approved" && dirty) patch.body_edited = body;
    if (status === "rejected") {
      const reason = window.prompt("Why are you rejecting this? (teaches the agent)") ?? "";
      patch.reject_reason = reason;
    }
    await supabase.from("drafts").update(patch).eq("id", draft.id);
    setBusy(false);
    onDecided();
  }

  return (
    <div className="card">
      <div className="meta">
        <span>
          <span className="pill">{draft.agent_id}</span>{" "}
          <span className="pill">{draft.kind}</span>
        </span>
        {to && <span>→ {to}</span>}
      </div>
      <h3>{draft.title}</h3>

      {editing ? (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} />
      ) : (
        <pre>{body}</pre>
      )}

      <div className="row">
        <button className="btn-green" disabled={busy} onClick={() => decide("approved")}>
          {dirty ? "Approve edited" : "Approve"}
        </button>
        <button disabled={busy} onClick={() => setEditing((e) => !e)}>
          {editing ? "Done editing" : "Edit"}
        </button>
        <button className="btn-red" disabled={busy} onClick={() => decide("rejected")}>
          Reject
        </button>
      </div>
    </div>
  );
}
