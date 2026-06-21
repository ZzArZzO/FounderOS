import { runCeo } from "./ceo";
import { runMarketing } from "./marketing";
import { runDev } from "./dev";
import { runLegal } from "./legal";
import { runInbox } from "./inbox";
import { runSales } from "./sales";
import { runEarlyAccess } from "./leads";
import { runWatch } from "./watch";
import { runVideo } from "./video";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentRunner = (input?: any) => Promise<{ count: number }>;

export const registry: Record<string, AgentRunner> = {
  ceo: runCeo,
  marketing: runMarketing,
  dev: runDev,
  legal: runLegal,
  inbox: runInbox,
  sales: runSales,
  earlyaccess: runEarlyAccess,
  watch: runWatch,
  video: runVideo,
};
