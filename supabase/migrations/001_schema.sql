-- ============================================================
-- Schema completo do Bolão Copa do Mundo 2026
-- ============================================================
-- Consolidado de: 001_initial_schema, 002_groups,
--   002_odds_schedule_flags, 003_profiles_group_visibility,
--   003_champion_picks, 004_ranking_snapshots,
--   007_wc26_api_id, 008_api_id_nullable
-- ============================================================


-- ── Funções utilitárias ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ── Tabelas core ─────────────────────────────────────────────

-- Perfis de usuário (estende auth.users gerenciado pelo Supabase Auth)
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Jogos da Copa do Mundo 2026
CREATE TABLE games (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id              INTEGER UNIQUE,          -- pode ser NULL para jogos importados via wc26_api_id
  wc26_api_id         TEXT UNIQUE,
  home_team           TEXT NOT NULL,
  away_team           TEXT NOT NULL,
  home_team_logo      TEXT,
  away_team_logo      TEXT,
  home_score          INTEGER,
  away_score          INTEGER,
  status              TEXT NOT NULL DEFAULT 'NS', -- NS, 1H, HT, 2H, FT, AET, PEN, LIVE, FINISHED
  match_date          TIMESTAMPTZ NOT NULL,
  stage               TEXT,
  group_name          TEXT,
  -- Odds travadas 5min antes do jogo (usadas para calcular bônus)
  locked_home_win_prob DECIMAL(5,4),
  locked_draw_prob     DECIMAL(5,4),
  locked_away_win_prob DECIMAL(5,4),
  -- Flags para controlar as 2 atualizações agendadas de odds por jogo
  -- (24h antes e 1h antes via The Odds API, plano gratuito: 500 req/mês)
  odds_fetched_24h    BOOLEAN NOT NULL DEFAULT FALSE,
  odds_fetched_1h     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE odds IS 'Odds mais recentes por jogo — atualizadas 24h e 1h antes via The Odds API';

-- Odds atualizadas por jogo (snapshot mais recente)
CREATE TABLE odds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  home_win_prob DECIMAL(5,4) NOT NULL,
  draw_prob     DECIMAL(5,4) NOT NULL,
  away_win_prob DECIMAL(5,4) NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id)
);

-- Palpites dos usuários (editável até 5min antes do jogo)
CREATE TABLE predictions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Pontuação calculada por jogo (preenchida pelo cron após FT)
CREATE TABLE game_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  base_points   INTEGER NOT NULL DEFAULT 0,
  odds_bonus    INTEGER NOT NULL DEFAULT 0,
  total_points  INTEGER GENERATED ALWAYS AS (base_points + odds_bonus) STORED,
  breakdown     JSONB, -- { "exact": bool, "winner": bool, "diff": bool, "loser": bool }
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);


-- ── Grupos ───────────────────────────────────────────────────

-- Bolões independentes
CREATE TABLE groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Whitelist de emails por grupo
CREATE TABLE group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, email)
);


-- ── Funcionalidades extras ───────────────────────────────────

-- Palpite de campeão da Copa
CREATE TABLE champion_picks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name      TEXT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  calculated_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Snapshots diários de ranking por grupo (para calcular variação de posição)
CREATE TABLE ranking_snapshots (
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  game_day   DATE NOT NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank       INTEGER NOT NULL,
  points     INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, game_day, user_id)
);


-- ── Índices ──────────────────────────────────────────────────

CREATE INDEX idx_games_status       ON games(status);
CREATE INDEX idx_games_match_date   ON games(match_date);
CREATE INDEX idx_games_odds_schedule ON games(match_date, status, odds_fetched_24h, odds_fetched_1h);

CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_game_id ON predictions(game_id);

CREATE INDEX idx_game_scores_user_id ON game_scores(user_id);

CREATE INDEX idx_group_members_email    ON group_members(email);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);


-- ── Triggers ─────────────────────────────────────────────────

-- Cria perfil automaticamente quando novo usuário é criado no Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_champion_picks_updated_at
  BEFORE UPDATE ON champion_picks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds              ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE champion_picks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_snapshots ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Permite ver perfis de outros membros do mesmo grupo (necessário para o ranking)
CREATE POLICY "profiles_select_same_group" ON profiles
  FOR SELECT TO authenticated
  USING (
    email IN (
      SELECT gm.email FROM group_members gm
      WHERE gm.group_id IN (
        SELECT gm2.group_id FROM group_members gm2
        WHERE gm2.email = auth.jwt() ->> 'email'
      )
    )
  );

-- games
CREATE POLICY "games_select_authenticated" ON games
  FOR SELECT TO authenticated USING (true);

-- odds
CREATE POLICY "odds_select_authenticated" ON odds
  FOR SELECT TO authenticated USING (true);

-- predictions
CREATE POLICY "predictions_select_own" ON predictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "predictions_insert_own" ON predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "predictions_update_own" ON predictions
  FOR UPDATE USING (auth.uid() = user_id);

-- game_scores: todos veem todos (necessário para ranking)
CREATE POLICY "game_scores_select_authenticated" ON game_scores
  FOR SELECT TO authenticated USING (true);

-- groups: usuário vê apenas grupos dos quais faz parte
CREATE POLICY "groups_select_member" ON groups
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT group_id FROM group_members
    WHERE email = auth.jwt() ->> 'email'
  ));

-- group_members: usuário vê todos os membros dos seus grupos (necessário para filtrar ranking)
CREATE POLICY "group_members_select_same_group" ON group_members
  FOR SELECT TO authenticated
  USING (group_id IN (
    SELECT gm.group_id FROM group_members gm
    WHERE gm.email = auth.jwt() ->> 'email'
  ));

-- champion_picks
CREATE POLICY "Authenticated users can view all champion picks" ON champion_picks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own champion pick" ON champion_picks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own champion pick" ON champion_picks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ranking_snapshots: membros leem apenas snapshots dos próprios grupos
CREATE POLICY "group members can read ranking snapshots" ON ranking_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN profiles p ON p.email = gm.email
      WHERE gm.group_id = ranking_snapshots.group_id
        AND p.id = auth.uid()
    )
  );


-- ── GRANTs ───────────────────────────────────────────────────

-- service_role tem acesso total (necessário para cron jobs e funções server-side)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Leitura pública dos dados do bolão
GRANT SELECT ON public.games     TO anon, authenticated;
GRANT SELECT ON public.odds      TO anon, authenticated;
GRANT SELECT ON public.game_scores TO anon, authenticated;
GRANT SELECT ON public.profiles  TO anon, authenticated;

-- Palpites: autenticado pode ler e escrever os próprios (RLS reforça a restrição)
GRANT SELECT, INSERT, UPDATE ON public.predictions TO authenticated;

-- Perfis: autenticado pode atualizar o próprio
GRANT UPDATE ON public.profiles TO authenticated;

-- Grupos
GRANT SELECT ON public.groups        TO authenticated;
GRANT SELECT ON public.group_members TO authenticated;

-- Champion picks
GRANT ALL ON public.champion_picks TO authenticated, anon, service_role;

-- Ranking snapshots
GRANT SELECT ON public.ranking_snapshots TO authenticated;
