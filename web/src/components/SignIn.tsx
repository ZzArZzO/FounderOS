import { useState } from "react";
import { supabase } from "../lib/supabase";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="app">
      <div className="header"><h1>FounderOS</h1></div>
      <div className="card" style={{ maxWidth: 420 }}>
        <h3>Sign in</h3>
        {sent ? (
          <p className="muted">Check your email for a magic link.</p>
        ) : (
          <>
            <div className="row">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn-accent" onClick={send} disabled={!email}>Send link</button>
            </div>
            {error && <p style={{ color: "var(--red)" }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
