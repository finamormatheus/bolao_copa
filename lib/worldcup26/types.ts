export interface WC26Game {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name_en: string;
  away_team_name_en: string;
  home_score: string;
  away_score: string;
  home_scorers: string;
  away_scorers: string;
  time_elapsed: string;
  finished: "TRUE" | "FALSE";
  type: string;
  group: string | null;
  matchday: string;
  local_date: string;
  stadium_id: string;
}

export interface WC26GamesResponse {
  games: WC26Game[];
}
