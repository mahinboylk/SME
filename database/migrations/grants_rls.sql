-- ============================================================================
-- Migration: 003_grants_rls.sql
-- Description: Grant API access to public schema tables and enable RLS
-- Created: 2026-07-12
-- ============================================================================

BEGIN;

-- Grant schema usage to both anonymous and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant table access for all current and future tables in public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- Enable RLS on users (and other key tables)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read users (for profiles)
CREATE POLICY "authenticated_can_read_users" ON users
  FOR SELECT TO authenticated
  USING (true);

-- Allow users to insert their own profile
CREATE POLICY "users_can_insert_own_profile" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY "users_can_update_own_profile" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow anonymous to insert (for signup flow before auth is confirmed)
CREATE POLICY "anon_can_insert_users" ON users
  FOR INSERT TO anon
  WITH CHECK (true);

-- Grant sequences usage (for SERIAL/BIGSERIAL columns if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon, authenticated;

COMMIT;
