/**
 * One-time helper: runs the Google OAuth loopback flow and prints a refresh token.
 *
 * Prereqs: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in worker/.env (from a "Desktop app"
 * OAuth client in Google Cloud Console).
 *
 * Run:  npx tsx scripts/google-auth.ts
 * Then open the printed AUTH_URL, approve, and the refresh token is printed.
 */
import "dotenv/config";
import http from "node:http";
import { google } from "googleapis";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in worker/.env first.");
  process.exit(1);
}

const PORT = 5599;
const redirectUri = `http://localhost:${PORT}/oauth2callback`;
const scopes = [
  "https://www.googleapis.com/auth/gmail.modify", // read threads + create drafts
  "https://www.googleapis.com/auth/calendar.readonly", // today's events
  "https://www.googleapis.com/auth/drive", // read referenced docs + save contracts
];

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
});

console.log("AUTH_URL " + authUrl);

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith("/oauth2callback")) {
    res.end("ok");
    return;
  }
  const code = new URL(req.url, redirectUri).searchParams.get("code");
  if (!code) {
    res.end("No code in callback.");
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.end("FounderOS: Google connected. You can close this tab.");
    if (tokens.refresh_token) {
      console.log("REFRESH_TOKEN " + tokens.refresh_token);
    } else {
      console.log("NO_REFRESH_TOKEN — revoke access at myaccount.google.com/permissions and re-run.");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.end("Error: " + msg);
    console.log("ERROR " + msg);
  } finally {
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  }
});

server.listen(PORT, () => console.log("LISTENING " + redirectUri));
