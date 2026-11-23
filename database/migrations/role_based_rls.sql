BEGIN;

-- Enable RLS on all business tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SELLER PROFILES — only sme_owner can manage
-- ============================================================
CREATE POLICY "all_can_read_seller_profiles" ON seller_profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sme_owner_can_insert_seller_profile" ON seller_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'sme_owner')
  );

CREATE POLICY "sme_owner_can_update_own_seller_profile" ON seller_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'sme_owner')
  );

-- ============================================================
-- BUYER PROFILES — only buyer can manage
-- ============================================================
CREATE POLICY "all_can_read_buyer_profiles" ON buyer_profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "buyer_can_insert_buyer_profile" ON buyer_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'buyer')
  );

CREATE POLICY "buyer_can_update_own_buyer_profile" ON buyer_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'buyer')
  );

-- ============================================================
-- MARKETPLACE LISTINGS — only sme_owner can create
-- ============================================================
CREATE POLICY "all_can_read_marketplace_listings" ON marketplace_listings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sme_owner_can_insert_listings" ON marketplace_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'sme_owner'
    )
    AND EXISTS (
      SELECT 1 FROM seller_profiles WHERE id = seller_profile_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "sme_owner_can_update_own_listings" ON marketplace_listings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM seller_profiles WHERE id = seller_profile_id AND user_id = auth.uid()
    )
  );

-- ============================================================
-- COMPANIES — only sme_owner can create
-- ============================================================
CREATE POLICY "all_can_read_companies" ON companies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sme_buyer_can_insert_companies" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('sme_owner', 'buyer'))
  );

CREATE POLICY "sme_buyer_can_update_own_companies" ON companies
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ============================================================
-- PRODUCTS — only sme_owner can create
-- ============================================================
CREATE POLICY "all_can_read_products" ON products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sme_owner_can_insert_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'sme_owner')
  );

CREATE POLICY "sme_owner_can_update_own_products" ON products
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ============================================================
-- MESSAGES — users can only see their own conversations
-- ============================================================
CREATE POLICY "users_can_read_own_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members
      WHERE chat_room_id = messages.chat_room_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_insert_own_messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- ============================================================
-- CHAT ROOM MEMBERS — users can only see their own memberships
-- ============================================================
CREATE POLICY "users_can_read_own_memberships" ON chat_room_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- NOTIFICATIONS — users can only see their own
-- ============================================================
CREATE POLICY "users_can_read_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- SAVED LISTINGS — users can only see their own
-- ============================================================
CREATE POLICY "users_can_read_own_saved_listings" ON saved_listings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_can_insert_own_saved_listings" ON saved_listings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- DOCUMENTS — company documents; only sme_owner can manage
-- ============================================================
CREATE POLICY "all_can_read_documents" ON documents
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sme_owner_can_insert_documents" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'sme_owner')
  );

COMMIT;
