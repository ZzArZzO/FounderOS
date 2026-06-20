import { generateDrafts } from "../runner";
import { MODELS } from "../config";

/**
 * Turn an approved newsletter into platform-native derivatives: a handful of social
 * posts plus one SEO blog post. Each piece takes ONE angle and stands alone (not a
 * summary). Fired by the executor when a newsletter is approved.
 */
export async function repurposeNewsletter(title: string, body: string): Promise<{ count: number }> {
  const userContent =
    `An issue of the Sunday newsletter was just approved. Repurpose it into platform-native ` +
    `content that pulls readers toward the newsletter. Do NOT summarize the whole issue; each ` +
    `piece should take ONE sharp angle or insight and stand on its own.\n` +
    `Produce 4 social posts (kind "social_post"; set "channel" to LinkedIn or X and "day" Mon-Fri) ` +
    `and 1 SEO blog post (kind "blog_post"; "title" = a search-friendly headline, "body" = a ` +
    `400-600 word article expanding one theme for organic search). On-brand, human voice, ` +
    `strictly non-advice.\n\n` +
    `--- Source newsletter: ${title} ---\n${body}`;

  const { count } = await generateDrafts({
    agentId: "marketing",
    role: "Marketing Agent",
    model: MODELS.sonnet,
    trigger: "auto:repurpose",
    defaultKind: "social_post",
    effort: "low",
    maxTokens: 3500,
    userContent,
    input: { source: title },
  });
  return { count };
}
