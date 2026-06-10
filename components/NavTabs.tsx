"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/palpites", label: "Palpites" },
  { href: "/ranking", label: "Ranking" },
  { href: "/regras", label: "Regras" },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {TABS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} style={{
            fontFamily: '"FWC2026", system-ui, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            padding: "6px 11px",
            borderRadius: 8,
            color: active ? "var(--bolao-ink-dark)" : "var(--bolao-ink-dim)",
            background: active ? "var(--bolao-lime)" : "transparent",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
