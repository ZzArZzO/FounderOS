const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string) ?? "http://localhost:8787";

export async function runAgent(
  agent: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch(`${WORKER_URL}/run/${agent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { ok: boolean; count?: number; error?: string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
