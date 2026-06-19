import express from "express";
import { registry } from "./agents";

export function createServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Permissive CORS — personal single-user tool. Lock to your web origin if you prefer.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Manually trigger an agent. Body is passed through as the agent's input.
  app.post("/run/:agent", async (req, res) => {
    const agent = req.params.agent;
    const runner = registry[agent];
    if (!runner) return res.status(404).json({ ok: false, error: `Unknown agent: ${agent}` });
    try {
      const result = await runner(req.body ?? {});
      res.json({ ok: true, agent, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[server] /run/${agent} failed:`, msg);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  return app;
}
