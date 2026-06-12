"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRankingRefresher({ hasLiveGames }: { hasLiveGames: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!hasLiveGames) return;
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [hasLiveGames, router]);

  return null;
}
