// football-data.org v4 types

export type FDMatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  crest: string;
}

export interface FDMatch {
  id: number;
  utcDate: string;
  status: FDMatchStatus;
  stage: string;
  group: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  odds: {
    msg?: string;
    homeWin: number | null;
    draw: number | null;
    awayWin: number | null;
  } | null;
}

export interface FDMatchesResponse {
  matches: FDMatch[];
  resultSet: {
    count: number;
    first: string;
    last: string;
    played: number;
  };
}
