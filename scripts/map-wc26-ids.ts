/**
 * Script one-time: popula wc26_api_id em cada row da tabela games
 * cruzando pelo nome dos times (normalizado).
 *
 * Executar com:
 *   npx tsx scripts/map-wc26-ids.ts
 *
 * Requer WC26_JWT_TOKEN e SUPABASE_SERVICE_ROLE_KEY no ambiente.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT = process.env.WC26_JWT_TOKEN!;

// Aliases para nomes que diferem entre football-data.org e worldcup26.ir
const NAME_ALIASES: Record<string, string> = {
  "south korea": "korea republic",
  "czech republic": "czechia",
  "ivory coast": "côte d'ivoire",
  "cape verde": "cape verde islands",
  "democratic republic of the congo": "congo dr",
  "bosnia and herzegovina": "bosnia-herzegovina",
};

function normalize(name: string): string {
  const lower = name.toLowerCase().trim();
  return NAME_ALIASES[lower] ?? lower;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY || !JWT) {
    console.error(
      "Faltam variáveis: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WC26_JWT_TOKEN"
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Busca jogos da API
  const apiRes = await fetch("https://worldcup26.ir/get/games", {
    headers: { Authorization: `Bearer ${JWT}` },
  });
  if (!apiRes.ok) throw new Error(`worldcup26.ir error ${apiRes.status}`);
  const { games: apiGames } = await apiRes.json();

  // 2. Busca jogos do DB
  const { data: dbGames, error } = await supabase
    .from("games")
    .select("id, home_team, away_team, wc26_api_id");
  if (error) throw error;

  // 3. Cruza por home+away normalizado
  let mapped = 0;
  let errors = 0;
  const unmatched: string[] = [];

  for (const apiGame of apiGames) {
    if (!apiGame.home_team_name_en || !apiGame.away_team_name_en) continue;

    const apiHome = normalize(apiGame.home_team_name_en);
    const apiAway = normalize(apiGame.away_team_name_en);

    const dbRow = dbGames?.find(
      (r) => normalize(r.home_team) === apiHome && normalize(r.away_team) === apiAway
    );

    if (!dbRow) {
      unmatched.push(
        `[API id=${apiGame.id}] "${apiGame.home_team_name_en}" vs "${apiGame.away_team_name_en}"`
      );
      continue;
    }

    if (dbRow.wc26_api_id === apiGame.id) {
      continue; // já mapeado
    }

    const { error: updateError } = await supabase
      .from("games")
      .update({ wc26_api_id: apiGame.id })
      .eq("id", dbRow.id);

    if (updateError) {
      console.error(`Erro ao mapear jogo ${apiGame.id}:`, updateError.message);
      errors++;
    } else {
      mapped++;
    }
  }

  console.log(`\nMapeados: ${mapped}, Erros: ${errors}`);

  if (unmatched.length > 0) {
    console.warn(`\nNão encontrados no DB (${unmatched.length}):`);
    unmatched.forEach((u) => console.warn(" ", u));
    console.warn(
      "\nAdicione aliases em NAME_ALIASES para os pares acima e execute novamente."
    );
  } else {
    console.log("Todos os jogos mapeados com sucesso.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
