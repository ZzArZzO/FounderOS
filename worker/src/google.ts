import { google } from "googleapis";
import { config, googleConfigured } from "./config";

function getAuth() {
  if (!googleConfigured) {
    throw new Error("Google is not configured — set GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN.");
  }
  const oauth2 = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret);
  oauth2.setCredentials({ refresh_token: config.google.refreshToken });
  return oauth2;
}

const gmail = () => google.gmail({ version: "v1", auth: getAuth() });
const calendar = () => google.calendar({ version: "v3", auth: getAuth() });
const drive = () => google.drive({ version: "v3", auth: getAuth() });

export interface Thread {
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
}

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodePart(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  for (const part of payload.parts ?? []) {
    const text = decodePart(part);
    if (text) return text;
  }
  if (payload.body?.data) return Buffer.from(payload.body.data, "base64").toString("utf-8");
  return "";
}

/** Recent threads matching a Gmail query (e.g. "newer_than:1d -in:sent -category:promotions"). */
export async function listRecentThreads(q: string, maxResults = 15): Promise<Thread[]> {
  const g = gmail();
  const list = await g.users.threads.list({ userId: "me", q, maxResults });
  const threads: Thread[] = [];
  for (const t of list.data.threads ?? []) {
    if (!t.id) continue;
    const full = await g.users.threads.get({ userId: "me", id: t.id, format: "full" });
    const msgs = full.data.messages ?? [];
    const last = msgs[msgs.length - 1];
    const headers = last?.payload?.headers ?? [];
    threads.push({
      threadId: t.id,
      from: header(headers, "From"),
      to: header(headers, "To"),
      subject: header(headers, "Subject"),
      snippet: t.snippet ?? "",
      body: decodePart(last?.payload).slice(0, 4000),
    });
  }
  return threads;
}

export async function listTodayEvents(): Promise<string[]> {
  const c = calendar();
  const now = new Date();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const res = await c.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? []).map((e) => {
    const start = e.start?.dateTime ?? e.start?.date ?? "";
    return `${start} — ${e.summary ?? "(no title)"}`;
  });
}

function encodeEmail(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

/** Create a Gmail DRAFT (never sends). Returns the draft id. */
export async function createGmailDraft(
  threadId: string | undefined,
  to: string,
  subject: string,
  body: string,
): Promise<string> {
  const g = gmail();
  const res = await g.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw: encodeEmail(to, subject, body), threadId } },
  });
  return res.data.id ?? "";
}

/** Save text as a Google Doc in Drive. Returns the document URL. */
export async function saveDriveDoc(name: string, content: string): Promise<string> {
  const d = drive();
  const res = await d.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.document" },
    media: { mimeType: "text/plain", body: content },
    fields: "id, webViewLink",
  });
  return res.data.webViewLink ?? `https://docs.google.com/document/d/${res.data.id}`;
}

export async function readDriveFile(fileId: string): Promise<string> {
  const d = drive();
  const res = await d.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
  return res.data as string;
}
