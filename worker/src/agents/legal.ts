import { generateDrafts } from "../runner";
import { readDriveFile } from "../google";
import { MODELS, googleConfigured } from "../config";

/**
 * Legal agent: drafts contracts or reviews risk/compliance from text you provide or a Drive doc.
 * Outputs are DRAFTS for your review, not legal advice.
 */
export async function runLegal(input?: {
  mode?: "review" | "draft";
  text?: string;
  driveFileId?: string;
  brief?: string;
}): Promise<{ count: number }> {
  let source = input?.text?.trim() ?? "";
  if (!source && input?.driveFileId) {
    if (!googleConfigured) throw new Error("Drive not configured — provide 'text' instead.");
    source = await readDriveFile(input.driveFileId);
  }

  const mode = input?.mode ?? "review";
  const userContent =
    mode === "draft"
      ? `Draft a contract per the brief below, following the jurisdiction and standard terms in ` +
        `your memory. Produce one "contract_draft". Flag anything you assumed.\n\n` +
        `--- Brief ---\n${input?.brief ?? source}`
      : `Review the document below for risk and compliance issues. Produce one "risk_review": a ` +
        `bulleted list of risks ranked high/medium/low with the specific clause and a suggested ` +
        `change for each. Remember: this is a draft for the founder, not legal advice.\n\n` +
        `--- Document ---\n${source || "(no document provided)"}`;

  const { count } = await generateDrafts({
    agentId: "legal",
    role: "Legal Agent",
    model: MODELS.sonnet,
    trigger: "manual",
    defaultKind: mode === "draft" ? "contract_draft" : "risk_review",
    effort: "medium",
    maxTokens: 4000,
    userContent,
    input: { mode, driveFileId: input?.driveFileId },
  });
  return { count };
}
