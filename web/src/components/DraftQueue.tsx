import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Draft } from "../types";
import { DraftCard } from "./DraftCard";

export function DraftQueue() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("drafts")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setDrafts((data ?? []) as Draft[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("drafts-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  if (loading) return <p className="muted">Loading queue…</p>;
  if (drafts.length === 0)
    return <div className="empty">Queue is empty. Trigger an agent above to generate drafts.</div>;

  return (
    <div>
      {drafts.map((d) => (
        <DraftCard key={d.id} draft={d} onDecided={load} />
      ))}
    </div>
  );
}
