-- Flags para controlar as 2 atualizações agendadas de odds por jogo
-- (24h antes e 1h antes do jogo) via The Odds API (plano gratuito: 500 req/mês)
ALTER TABLE games
  ADD COLUMN odds_fetched_24h BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN odds_fetched_1h  BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para o cron encontrar rapidamente jogos que precisam de atualização
CREATE INDEX idx_games_odds_schedule ON games(match_date, status, odds_fetched_24h, odds_fetched_1h);

-- Atualiza comentário da tabela odds (não usa mais o intervalo fixo de 3h)
COMMENT ON TABLE odds IS 'Odds mais recentes por jogo — atualizadas 24h e 1h antes via The Odds API';
