"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="bolao-app-bg" style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 380,
        padding: "48px 32px",
        margin: "0 18px",
        background: "var(--bolao-surface)",
        border: "1px solid var(--bolao-hairline-2)",
        borderRadius: "var(--bolao-radius-card)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{
            fontFamily: '"FWC2026", system-ui, sans-serif',
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            color: "var(--bolao-ink)",
            margin: "0 0 8px",
          }}>
            Bolão{" "}
            <span style={{
              color: "var(--bolao-lime)",
              fontFamily: '"FIFA26 Logo", "FWC2026", system-ui, sans-serif',
              fontSize: 34,
              lineHeight: 0.8,
            }}>26</span>
          </h1>
          <p style={{
            fontSize: 13,
            color: "var(--bolao-ink-dim)",
            margin: 0,
          }}>
            Copa do Mundo — faça seus palpites
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "13px 20px",
            background: "var(--bolao-surface-3)",
            border: "1px solid var(--bolao-hairline-2)",
            borderRadius: 12,
            color: "var(--bolao-ink)",
            fontSize: 15,
            fontWeight: 700,
            fontFamily: '"FWC2026", system-ui, sans-serif',
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--bolao-surface-2)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bolao-surface-3)";
          }}
        >
          <GoogleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
          {loading ? "Redirecionando..." : "Entrar com Google"}
        </button>

        {error && (
          <p style={{
            fontSize: 13,
            color: "var(--bolao-red)",
            textAlign: "center",
            margin: "-16px 0 0",
          }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
