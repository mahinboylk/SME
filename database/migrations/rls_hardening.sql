-- ============================================================================
-- Migration: 006_rls_hardening.sql
-- Description: Backend hardening — fix PostgREST schema introspection, revoke
--              destructive grants, drop unsafe anon users policies, and enable
--              RLS with row-level policies on all remaining tables.
-- Applied:    2026-08-15 (migration 20260815061232_rls-hardening + direct SQL)
--
-- NOTE: The two statements at the top require a `postgres` superuser
--       connection (platform CLI blocks role management and revoking grants
--       made by the postgres role). Everything below that is CLI-safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. SUPERUSER-ONLY (run via direct postgres connection, e.g. DATABASE_URL):
-- ----------------------------------------------------------------------------

-- Fix PostgREST schema-cache introspection
-- ("relation public.information_schema.columns does not exist" in logs):
-- PostgREST connects as the `postgres` role; its search_path defaulted to
-- "$user", public without information_schema, so introspection queries failed.
ALTER ROLE postgres SET search_path TO public, information_schema, pg_catalog;

-- pg_stat_statements was installed in schema public and API-exposed to
-- anonymous users (timings/userid metadata leak). Revoke everything from
-- anon, authenticated and PUBLIC. project_admin cannot do this because the
-- grants were made by postgres.
REVOKE ALL PRIVILEGES ON TABLE pg_stat_statements, pg_stat_statements_info FROM anon, authenticated, PUBLIC;

-- ----------------------------------------------------------------------------
-- B. CLI-SAFE (mirrored in migrations/20260815061232_rls-hardening.sql):
-- ----------------------------------------------------------------------------

-- Revoke destructive grants (defense in depth — RLS is the row-level gate).
-- The app never issues DELETE; anon should never INSERT/UPDATE/DELETE.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE DELETE ON TABLES FROM authenticated;

-- Drop unsafe anon policies on users (email/role leak; the app only touches
-- users after signUp/signIn, i.e. as authenticated).
DROP POLICY IF EXISTS anon_can_insert_users ON users;
DROP POLICY IF EXISTS anon_can_read_users ON users;

-- Enable RLS on all remaining tables
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_hs_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_statistics ENABLE ROW LEVEL SECURITY;

-- ai_requests — owner-scoped (HSCodeClassification history, classify, status)
CREATE POLICY users_can_read_own_ai_requests ON ai_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY users_can_insert_own_ai_requests ON ai_requests
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY users_can_update_own_ai_requests ON ai_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (user_id = auth.uid() OR created_by = auth.uid());

-- ai_results — visible through the owning request
CREATE POLICY users_can_read_own_ai_results ON ai_results
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_requests
    WHERE ai_requests.id = ai_request_id
      AND (ai_requests.user_id = auth.uid() OR ai_requests.created_by = auth.uid())
  ));

CREATE POLICY users_can_insert_own_ai_results ON ai_results
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- search_history — owner-scoped (MarketIntelligence best-effort log)
CREATE POLICY users_can_read_own_search_history ON search_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY users_can_insert_own_search_history ON search_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- chat_rooms — visible to all authenticated; members may update the preview
CREATE POLICY all_can_read_chat_rooms ON chat_rooms
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_can_insert_chat_rooms ON chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY members_can_update_chat_rooms ON chat_rooms
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE chat_room_members.chat_room_id = chat_rooms.id
      AND chat_room_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE chat_room_members.chat_room_id = chat_rooms.id
      AND chat_room_members.user_id = auth.uid()
  ));

-- company_members — users see/join only their own membership
CREATE POLICY users_can_read_own_company_memberships ON company_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY users_can_insert_own_company_memberships ON company_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND created_by = auth.uid());

-- admin_logs — admin-only (VerifyCompanies writes, AuditLogs reads)
CREATE POLICY admins_can_read_admin_logs ON admin_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'government_officer')
  ));

CREATE POLICY admins_can_insert_admin_logs ON admin_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'government_officer')
  ));

-- Reference data — read-only for authenticated
CREATE POLICY all_can_read_countries ON countries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY all_can_read_compliance_rules ON compliance_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY all_can_read_hs_codes ON hs_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY all_can_read_markets ON markets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY all_can_read_tariffs ON tariffs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY all_can_read_trade_statistics ON trade_statistics
  FOR SELECT TO authenticated USING (true);

-- system_settings — admin-only read
CREATE POLICY admins_can_read_system_settings ON system_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'government_officer')
  ));

-- bookmarks, market_recommendations, product_hs_codes, product_images,
-- reports, reviews — not used by the app; RLS on with no policies = deny all.