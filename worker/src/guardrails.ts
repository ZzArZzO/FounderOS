/**
 * Non-advice guardrail for public-facing copy (social posts, newsletter).
 *
 * Sunday is a regulated-adjacent EU fintech that must stay on the "general
 * information / publisher" side of MiFID II / MiCA — it may never give a personal
 * recommendation. Mirrors the forbidden-phrase policy in the Sunday app's
 * services/llm/guardrails so FounderOS can't publish advice-like marketing copy.
 */

const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  { pattern: /\byou should\b/i, label: "you should" },
  { pattern: /\bconsider (trimming|selling|buying|rebalanc\w*|rotating)\b/i, label: "consider <action>" },
  { pattern: /\brecommend\w*/i, label: "recommend" },
  { pattern: /\brebalance into\b/i, label: "rebalance into" },
  { pattern: /\btake profits?\b/i, label: "take profit(s)" },
  { pattern: /\bbuy the dip\b/i, label: "buy the dip" },
  { pattern: /\bit'?s a good time to\b/i, label: "it's a good time to" },
  { pattern: /\bnear take-profit zone\b/i, label: "near take-profit zone" },
  { pattern: /\btime to (buy|sell)\b/i, label: "time to buy/sell" },
];

/** Returns the labels of any forbidden phrases found in the text. */
export function findViolations(text: string): string[] {
  return FORBIDDEN.filter((f) => f.pattern.test(text)).map((f) => f.label);
}

export function isCompliant(text: string): boolean {
  return findViolations(text).length === 0;
}
