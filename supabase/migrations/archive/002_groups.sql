-- Adiciona email ao profiles (necessário para cruzar group_members → user_id)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE profiles SET email = (SELECT email FROM auth.users WHERE auth.users.id = profiles.id);

-- Atualiza trigger para incluir email em novos perfis
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

-- Grupos (bolões independentes)
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Whitelist de emails por grupo
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, email)
);

CREATE INDEX idx_group_members_email ON group_members(email);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);

-- RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas grupos dos quais faz parte
CREATE POLICY "groups_select_member" ON groups
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT group_id FROM group_members
    WHERE email = auth.jwt() ->> 'email'
  ));

-- Usuário vê todos os membros do seu próprio grupo (necessário para filtrar ranking)
CREATE POLICY "group_members_select_same_group" ON group_members
  FOR SELECT TO authenticated
  USING (group_id IN (
    SELECT gm.group_id FROM group_members gm
    WHERE gm.email = auth.jwt() ->> 'email'
  ));

GRANT SELECT ON public.groups TO authenticated;
GRANT SELECT ON public.group_members TO authenticated;
GRANT ALL ON public.groups TO service_role;
GRANT ALL ON public.group_members TO service_role;
