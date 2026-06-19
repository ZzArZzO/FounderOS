import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Memory } from "../types";

export function MemoryEditor() {
  const [rows, setRows] = useState<Memory[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("agent_memory")
      .select("*")
      .order("scope", { ascending: true })
      .order("weight", { ascending: false });
    const list = (data ?? []) as Memory[];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((m) => [m.id, m.content])));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(m: Memory) {
    await supabase
      .from("agent_memory")
      .update({ content: drafts[m.id], updated_at: new Date().toISOString() })
      .eq("id", m.id);
    setSavedId(m.id);
    setTimeout(() => setSavedId(null), 1500);
  }

  return (
    <div>
      <p className="muted">
        Shared context for every agent. <code>global</code> rows apply to all; others are
        per-agent. Keep these tight — they're cached into every prompt.
      </p>
      {rows.map((m) => (
        <div className="card" key={m.id}>
          <div className="meta">
            <span><span className="pill">{m.scope}</span> {m.key}</span>
            <span>{savedId === m.id ? "saved ✓" : `weight ${m.weight}`}</span>
          </div>
          <textarea
            style={{ minHeight: 90 }}
            value={drafts[m.id] ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <button
              className="btn-accent"
              disabled={drafts[m.id] === m.content}
              onClick={() => save(m)}
            >
              Save
            </button>
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className="empty">No memory rows. Run the migration seed.</div>}
    </div>
  );
}
