export interface OddsAPIOutcome {
  name: string;
  price: number;
}

export interface OddsAPIMarket {
  key: string;
  last_update: string;
  outcomes: OddsAPIOutcome[];
}

export interface OddsAPIBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsAPIMarket[];
}

export interface OddsAPIEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsAPIBookmaker[];
}
