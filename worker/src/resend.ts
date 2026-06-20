/**
 * Resend Broadcasts integration. On approval of a `newsletter` draft, the executor
 * creates a Resend broadcast (a DRAFT by default — the founder sends it from the Resend
 * dashboard, unless RESEND_AUTOSEND=true). Works on Resend's low-cost tiers with a
 * verified sending domain.
 *   POST https://api.resend.com/broadcasts
 */

import { config, resendConfigured } from "./config";
import { mdToHtml } from "./markdown";

export async function createResendBroadcast(
  subject: string,
  markdown: string,
): Promise<{ id: string; sent: boolean }> {
  if (!resendConfigured) {
    throw new Error("Resend not configured — set RESEND_API_KEY, RESEND_AUDIENCE_ID, RESEND_FROM.");
  }

  const res = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Resend's create-broadcast field for the recipient list.
      segment_id: config.resend.audienceId,
      from: config.resend.from,
      subject,
      html: mdToHtml(markdown),
      send: config.resend.autosend,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend broadcast failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json().catch(() => ({}));
  return { id: data?.id ?? data?.data?.id ?? "", sent: config.resend.autosend };
}
