-- Perfis de usuário (estende auth.users gerenciado pelo Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jogos da Copa do Mundo 2026
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_logo TEXT,
  away_team_logo TEXT,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'NS', -- NS, 1H, HT, 2H, FT, AET, PEN
  match_date TIMESTAMPTZ NOT NULL,
  stage TEXT,
  group_name TEXT,
  -- Odds travadas 5min antes do jogo (usadas para calcular bônus)
  locked_home_win_prob DECIMAL(5,4),
  locked_draw_prob DECIMAL(5,4),
  locked_away_win_prob DECIMAL(5,4),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Odds atualizadas a cada 3h (snapshot mais recente por jogo)
CREATE TABLE odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  home_win_prob DECIMAL(5,4) NOT NULL,
  draw_prob DECIMAL(5,4) NOT NULL,
  away_win_prob DECIMAL(5,4) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id)
);

-- Palpites dos usuários (editável até 5min antes do jogo)
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Pontuação calculada por jogo (preenchida pelo cron após FT)
CREATE TABLE game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  base_points INTEGER NOT NULL DEFAULT 0,
  odds_bonus INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER GENERATED ALWAYS AS (base_points + odds_bonus) STORED,
  breakdown JSONB, -- { "exact": bool, "winner": bool, "diff": bool, "loser": bool }
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Índices para performance nas queries mais frequentes
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_match_date ON games(match_date);
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_game_id ON predictions(game_id);
CREATE INDEX idx_game_scores_user_id ON game_scores(user_id);

-- Trigger: cria perfil automaticamente quando novo usuário é criado
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- profiles: usuário lê/escreve apenas o próprio
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- games: leitura pública para usuários autenticados
CREATE POLICY "games_select_authenticated" ON games FOR SELECT TO authenticated USING (true);

-- odds: leitura pública para usuários autenticados
CREATE POLICY "odds_select_authenticated" ON odds FOR SELECT TO authenticated USING (true);

-- predictions: usuário lê/escreve apenas as próprias
CREATE POLICY "predictions_select_own" ON predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "predictions_insert_own" ON predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_update_own" ON predictions FOR UPDATE USING (auth.uid() = user_id);

-- game_scores: leitura pública para ranking (todos veem todos)
CREATE POLICY "game_scores_select_authenticated" ON game_scores FOR SELECT TO authenticated USING (true);
