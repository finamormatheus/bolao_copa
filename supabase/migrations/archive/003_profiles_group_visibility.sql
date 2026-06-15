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
