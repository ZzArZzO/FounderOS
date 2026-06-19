import { useState } from "react";
import { runAgent } from "../lib/api";

export function TriggerBar() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [devPrompt, setDevPrompt] = useState("");
  const [legalText, setLegalText] = useState("");

  async function trigger(agent: string, body: Record<string, unknown> = {}) {
    setBusy(agent);
    setStatus(null);
    const res = await runAgent(agent, body);
    setBusy(null);
    setStatus(
      res.ok
        ? `${agent}: produced ${res.count ?? 0} draft(s).`
        : `${agent} failed: ${res.error}`,
    );
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <strong>Run an agent</strong>
        {status && <span className="muted">{status}</span>}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button disabled={busy !== null} onClick={() => trigger("marketing")}>Marketing</button>
        <button disabled={busy !== null} onClick={() => trigger("ceo")}>CEO brief</button>
        <button disabled={busy !== null} onClick={() => trigger("inbox")}>Inbox (needs Google)</button>
        <button disabled={busy !== null} onClick={() => trigger("sales")}>Sales (needs Google)</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="muted" style={{ marginBottom: 4 }}>Ask Dev (paste a stack trace, log, or question)</div>
        <textarea
          style={{ minHeight: 80 }}
          value={devPrompt}
          onChange={(e) => setDevPrompt(e.target.value)}
          placeholder="e.g. TypeError: cannot read properties of undefined… / How should I structure X?"
        />
        <div className="row" style={{ marginTop: 6 }}>
          <button
            className="btn-accent"
            disabled={busy !== null || !devPrompt.trim()}
            onClick={() => trigger("dev", { prompt: devPrompt })}
          >
            Ask Dev
          </button>
        </div>
      </div>

      <div>
        <div className="muted" style={{ marginBottom: 4 }}>Legal review (paste contract text)</div>
        <textarea
          style={{ minHeight: 80 }}
          value={legalText}
          onChange={(e) => setLegalText(e.target.value)}
          placeholder="Paste a contract or clause to get a risk review draft…"
        />
        <div className="row" style={{ marginTop: 6 }}>
          <button
            className="btn-accent"
            disabled={busy !== null || !legalText.trim()}
            onClick={() => trigger("legal", { mode: "review", text: legalText })}
          >
            Review with Legal
          </button>
        </div>
      </div>
    </div>
  );
}
