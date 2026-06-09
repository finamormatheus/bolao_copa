"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Trophy, Lock, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChampionPick } from "@/lib/supabase/types";

type ChampionGroupPick = {
  display_name: string;
  avatar_url: string | null;
  team_name: string | null;
  points_awarded: number;
};

const CHAMPION_POINTS = 20;

interface Props {
  teams: string[];
  initialPick: ChampionPick | null;
  locked: boolean;
}

export default function ChampionPicker({ teams, initialPick, locked }: Props) {
  const [pick, setPick] = useState<string | null>(initialPick?.team_name ?? null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [groupPicks, setGroupPicks] = useState<ChampionGroupPick[] | null | "loading">(null);
  const ref = useRef<HTMLDivElement>(null);

  async function handleExpand() {
    if (!expanded && groupPicks === null) {
      setGroupPicks("loading");
      try {
        const res = await fetch("/api/group-champion-picks");
        const json = await res.json();
        setGroupPicks(res.ok ? json.picks : []);
      } catch {
        setGroupPicks([]);
      }
    }
    setExpanded((v) => !v);
  }

  const filtered = teams.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSelect(team: string) {
    if (locked || saving) return;
    setOpen(false);
    setSearch("");
    setSaving(true);
    try {
      const res = await fetch("/api/champion-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_name: team }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Erro ao salvar (${res.status}): ${body?.error ?? "desconhecido"}`);
      }
      setPick(team);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Trophy className="size-4 text-amber-500" />
        <span className="text-sm font-semibold">Campeão da Copa</span>
        {locked ? (
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
            <Lock className="size-3" />
            Palpite encerrado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            +{CHAMPION_POINTS} pts se acertar
          </Badge>
        )}
      </div>

      <div ref={ref} className="relative w-full max-w-xs">
        <Button
          variant="outline"
          disabled={locked || saving}
          onClick={() => !locked && setOpen((v) => !v)}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!pick && "text-muted-foreground")}>
            {saving ? "Salvando..." : (pick ?? "Escolha o campeão")}
          </span>
          {locked ? (
            <Lock className="size-4 opacity-40" />
          ) : (
            <ChevronDown
              className={cn(
                "size-4 opacity-50 transition-transform",
                open && "rotate-180"
              )}
            />
          )}
        </Button>

        {open && (
          <div className="absolute top-full mt-1 z-50 w-full rounded-lg border bg-background shadow-lg">
            <div className="p-1.5 border-b">
              <Input
                placeholder="Pesquisar país..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="h-8"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                  Nenhum país encontrado.
                </div>
              ) : (
                filtered.map((team) => (
                  <button
                    key={team}
                    type="button"
                    onClick={() => handleSelect(team)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        pick === team ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    {team}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {initialPick && initialPick.points_awarded > 0 && (
        <p className="text-sm font-medium text-amber-600">
          Parabéns! Você acertou o campeão e ganhou {initialPick.points_awarded} pts!
        </p>
      )}

      {/* Palpites do grupo — só visível após o lock */}
      {locked && (
        <div className="border-t pt-2">
          <button
            onClick={handleExpand}
            className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              Palpites do grupo
            </span>
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              {groupPicks === "loading" ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : groupPicks === null || groupPicks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum participante encontrado.</p>
              ) : (
                groupPicks.map((gp, i) => {
                  const initials = gp.display_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={gp.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="truncate text-muted-foreground">{gp.display_name}</span>
                      </div>
                      <span className="font-medium shrink-0">
                        {gp.team_name ? (
                          gp.points_awarded > 0 ? (
                            <span className="text-amber-600">🏆 {gp.team_name}</span>
                          ) : (
                            gp.team_name
                          )
                        ) : (
                          <span className="text-muted-foreground">Sem palpite</span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
