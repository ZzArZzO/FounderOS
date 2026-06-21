/**
 * Renders a short vertical (1080x1920) social video from a list of text cards via the
 * Shotstack API, and polls until the MP4 is ready. Used for the "Market Week Ahead" short.
 * Default env is "stage" (sandbox, watermarked, free) — set SHOTSTACK_ENV=v1 for production.
 */

import { config, shotstackConfigured } from "./config";

const SECONDS_PER_CARD = 2.6;

function buildEdit(cards: string[]) {
  const clips = cards.map((text, i) => ({
    asset: { type: "title", text, style: "minimal" },
    start: Number((i * SECONDS_PER_CARD).toFixed(2)),
    length: SECONDS_PER_CARD,
    transition: { in: "fade", out: "fade" },
  }));
  return {
    timeline: { background: "#0f1115", tracks: [{ clips }] },
    output: { format: "mp4", size: { width: 1080, height: 1920 }, fps: 25 },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function renderShort(cards: string[]): Promise<string> {
  if (!shotstackConfigured) throw new Error("Shotstack not configured — set SHOTSTACK_API_KEY.");
  const base = `https://api.shotstack.io/edit/${config.shotstack.env}`;
  const headers = { "x-api-key": config.shotstack.apiKey, "Content-Type": "application/json" };

  const post = await fetch(`${base}/render`, {
    method: "POST",
    headers,
    body: JSON.stringify(buildEdit(cards)),
  });
  if (!post.ok) {
    throw new Error(`Shotstack render submit failed (${post.status}): ${(await post.text()).slice(0, 300)}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submit: any = await post.json();
  const id = submit?.response?.id;
  if (!id) throw new Error("Shotstack did not return a render id");

  // Poll until done (or fail) — short renders typically finish well under 2 minutes.
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const res = await fetch(`${base}/render/${id}`, { headers });
    if (!res.ok) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const status = data?.response?.status;
    if (status === "done" && data?.response?.url) return data.response.url as string;
    if (status === "failed") throw new Error("Shotstack render failed");
  }
  throw new Error("Shotstack render timed out");
}
