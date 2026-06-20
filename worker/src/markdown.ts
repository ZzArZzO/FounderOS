/** Minimal markdown -> email HTML (bold, bullets, headings, paragraphs). Shared by the
 *  newsletter publishers (Resend, beehiiv). Wraps output in a simple table cell so styling
 *  inherits from the provider template. */
export function mdToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const out: string[] = [];
  let inList = false;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");

  return `<table><tbody><tr><td style="padding:0 20px;">${out.join("\n")}</td></tr></tbody></table>`;
}
