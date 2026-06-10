"use client";

import { useEffect, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toSlug } from "./group-slug";

interface Group {
  id: string;
  name: string;
}

interface GroupSelectorProps {
  groups: Group[];
  selectedGroupId: string;
  currentGroupSlug: string | null;
}

const STORAGE_KEY = "bolao_rank_group";

export function GroupSelector({ groups, selectedGroupId, currentGroupSlug }: GroupSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // Restore last selected group from localStorage when no group param in URL
  useEffect(() => {
    if (!currentGroupSlug) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const match = groups.find((g) => toSlug(g.name) === stored);
          if (match) {
            startTransition(() => router.replace(`${pathname}?group=${stored}`));
          }
        }
      } catch {}
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (g: Group) => {
    const slug = toSlug(g.name);
    try { localStorage.setItem(STORAGE_KEY, slug); } catch {}
    startTransition(() => router.push(`${pathname}?group=${slug}`));
  };

  return (
    <div style={{
      display: "flex",
      padding: 4,
      gap: 4,
      borderRadius: 13,
      background: "var(--bolao-surface)",
      border: "1px solid var(--bolao-hairline)",
      overflowX: "auto",
    }}>
      {groups.map((g) => {
        const active = g.id === selectedGroupId;
        return (
          <button
            key={g.id}
            onClick={() => navigate(g)}
            style={{
              border: "none",
              borderRadius: 9,
              padding: "8px 15px",
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              fontFamily: '"FWC2026", system-ui, sans-serif',
              background: active ? "var(--bolao-lime)" : "transparent",
              color: active ? "var(--bolao-ink-dark)" : "var(--bolao-ink-dim)",
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
