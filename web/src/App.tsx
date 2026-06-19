import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { SignIn } from "./components/SignIn";
import { DraftQueue } from "./components/DraftQueue";
import { TriggerBar } from "./components/TriggerBar";
import { RunHistory } from "./components/RunHistory";
import { MemoryEditor } from "./components/MemoryEditor";

type Tab = "queue" | "runs" | "memory";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="app"><p className="muted">Loading…</p></div>;
  if (!session) return <SignIn />;

  return (
    <div className="app">
      <div className="header">
        <h1>FounderOS</h1>
        <div className="row">
          <span className="muted">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>

      <TriggerBar />

      <div className="tabs">
        {(["queue", "runs", "memory"] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "queue" ? "Approval queue" : t === "runs" ? "Runs & cost" : "Memory"}
          </button>
        ))}
      </div>

      {tab === "queue" && <DraftQueue />}
      {tab === "runs" && <RunHistory />}
      {tab === "memory" && <MemoryEditor />}
    </div>
  );
}
