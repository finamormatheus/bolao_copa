export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import NavTabs from "@/components/NavTabs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("group_members")
      .select("group_id")
      .eq("email", user.email!)
      .limit(1)
      .maybeSingle(),
  ]);

  const displayName = profile?.display_name ?? user.email ?? "?";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const headerEl = (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 20,
      background: "rgba(10,10,14,0.82)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--bolao-hairline)",
    }}>
      <div className="hdr-inner" style={{ maxWidth: 760, margin: "0 auto" }}>
        <span className="hdr-brand" style={{
          fontFamily: '"FWC2026", system-ui, sans-serif',
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 7,
          color: "var(--bolao-ink)",
        }}>
          Bolão{" "}
          <span style={{
            color: "var(--bolao-lime)",
            fontFamily: '"FIFA26 Logo", "FWC2026", system-ui, sans-serif',
            fontSize: 24,
            lineHeight: 0.8,
          }}>26</span>
        </span>

        <NavTabs />

        <div className="hdr-user">
          <span style={{
            fontSize: 13,
            color: "var(--bolao-ink-dim)",
            fontFamily: '"FWC2026", system-ui, sans-serif',
            display: "none",
          }} className="sm:inline">
            {displayName.split(" ")[0]}
          </span>
          <span style={{
            width: 32,
            height: 32,
            borderRadius: 99,
            background: "var(--bolao-surface-2)",
            color: "var(--bolao-ink)",
            fontSize: 12,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: '"FWC2026", system-ui, sans-serif',
            flexShrink: 0,
          }}>
            {initials}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );

  if (!membership) {
    return (
      <div className="bolao-app-bg" style={{ minHeight: "100vh", position: "relative" }}>
        {headerEl}
        <main style={{ maxWidth: 760, margin: "0 auto", padding: "22px 18px 80px", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", padding: "64px 0", color: "var(--bolao-ink-dim)" }}>
            <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>Você não está em nenhum bolão.</p>
            <p style={{ fontSize: 13, margin: 0 }}>Entre em contato com o administrador.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bolao-app-bg" style={{ minHeight: "100vh", position: "relative" }}>
      {headerEl}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "22px 18px 80px", position: "relative", zIndex: 1 }}>
        {children}
      </main>
    </div>
  );
}
