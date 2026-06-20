// FounderOS worker — Railway auto-deploys this on push to main (root dir: worker/).
import cron from "node-cron";
import { config, googleConfigured } from "./config";
import { registry } from "./agents";
import { processApprovedDrafts } from "./executor";
import { createServer } from "./server";

async function runSafe(agent: string) {
  try {
    console.log(`[cron] running ${agent}…`);
    const { count } = await registry[agent]();
    console.log(`[cron] ${agent} produced ${count} draft(s).`);
  } catch (e) {
    console.error(`[cron] ${agent} failed:`, e instanceof Error ? e.message : e);
  }
}

function scheduleCrons() {
  // Weekly strategy + content (Mon 09:00)
  cron.schedule("0 9 * * 1", () => runSafe("ceo"));
  cron.schedule("0 9 * * 1", () => runSafe("marketing"));

  // Google-dependent agents only if configured
  if (googleConfigured) {
    cron.schedule("0 7 * * *", () => runSafe("inbox")); // daily 07:00
    cron.schedule("0 8 * * 1-5", () => runSafe("sales")); // weekdays 08:00
    console.log("[cron] inbox + sales scheduled (Google configured).");
  } else {
    console.log("[cron] inbox + sales NOT scheduled — Google not configured.");
  }
  // Dev + Legal are manual-only (triggered from the UI).
}

function main() {
  scheduleCrons();

  // Approved-draft executor — poll loop.
  setInterval(() => {
    processApprovedDrafts().catch((e) =>
      console.error("[executor] loop error:", e instanceof Error ? e.message : e),
    );
  }, 15_000);

  const app = createServer();
  app.listen(config.port, () => {
    console.log(`[worker] FounderOS worker up. Trigger server on :${config.port}`);
    console.log(`[worker] agents: ${Object.keys(registry).join(", ")}`);
  });
}

main();
