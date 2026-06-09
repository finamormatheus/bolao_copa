-- Tabela de palpites de campeão da Copa do Mundo 2026
CREATE TABLE IF NOT EXISTS champion_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Mantém updated_at atualizado automaticamente
CREATE TRIGGER update_champion_picks_updated_at
  BEFORE UPDATE ON champion_picks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE champion_picks ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ler (necessário para o ranking)
CREATE POLICY "Authenticated users can view all champion picks"
  ON champion_picks FOR SELECT
  TO authenticated
  USING (true);

-- Usuário só insere e atualiza o próprio palpite (lock é validado na API)
CREATE POLICY "Users can insert own champion pick"
  ON champion_picks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own champion pick"
  ON champion_picks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Permissões de tabela para os roles do Supabase
GRANT ALL ON TABLE public.champion_picks TO authenticated;
GRANT ALL ON TABLE public.champion_picks TO anon;
GRANT ALL ON TABLE public.champion_picks TO service_role;
