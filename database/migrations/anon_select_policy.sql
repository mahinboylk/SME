-- Allow anonymous users to select from users table
-- (needed for signup/login flows where the user just authenticated but
--  is still using the anon key before the session JWT is issued)
CREATE POLICY "anon_can_read_users" ON users
  FOR SELECT TO anon
  USING (true);
