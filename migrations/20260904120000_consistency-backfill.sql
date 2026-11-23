-- Consistency backfill: codify production-only objects that were created
-- outside of migrations (via dashboard/manual SQL), so fresh environments
-- converge to the same state as production. Every statement is idempotent
-- (OR REPLACE / IF NOT EXISTS / DROP IF EXISTS + CREATE), so applying this
-- on production is a semantic no-op.
--
-- Covers:
--   1. RLS helper functions: is_order_seller, is_order_item_seller,
--      is_room_member (SECURITY DEFINER, recursion-safe for policies)
--   2. Seller order visibility: sellers_can_select_received_orders (+ items)
--   3. Chat membership lifecycle policies + DELETE grant for leave-room
--   4. Room-partner company read, own-message soft-delete UPDATE
--   5. Explicit deny policies on unused tables
--   6. companies.verification_status / verification_documents columns
--   7. Self-purchase trigger on order_items
--   8. Realtime room-event triggers (rooms:% channel) + channel row +
--      subscribe policy (previously only chat:% was declared)
--   9. Parity grants on orders / order_items

-- ---------------------------------------------------------------------------
-- 1. Helper functions (exact production definitions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_order_seller(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.marketplace_listings ml ON ml.id = oi.listing_id
    JOIN public.seller_profiles sp ON sp.id = ml.seller_profile_id
    WHERE oi.order_id = p_order_id
      AND sp.user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_order_item_seller(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.marketplace_listings ml
    JOIN public.seller_profiles sp ON sp.id = ml.seller_profile_id
    WHERE ml.id = p_listing_id
      AND sp.user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_room_member(room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.chat_room_members
      WHERE chat_room_id = room_id AND user_id = auth.uid()
    );
$function$;

-- ---------------------------------------------------------------------------
-- 2. Seller order visibility (used by Sales / Received Orders UI)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sellers_can_select_received_orders ON public.orders;
CREATE POLICY sellers_can_select_received_orders
ON public.orders FOR SELECT TO authenticated
USING (public.is_order_seller(id));

DROP POLICY IF EXISTS sellers_can_select_received_order_items ON public.order_items;
CREATE POLICY sellers_can_select_received_order_items
ON public.order_items FOR SELECT TO authenticated
USING (public.is_order_item_seller(listing_id));

-- ---------------------------------------------------------------------------
-- 3. Chat membership lifecycle
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS creator_can_add_direct_members ON public.chat_room_members;
CREATE POLICY creator_can_add_direct_members
ON public.chat_room_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE chat_rooms.id = chat_room_members.chat_room_id
      AND chat_rooms.created_by = auth.uid()
      AND chat_rooms.type = 'direct'
  )
);

DROP POLICY IF EXISTS members_can_read_room_members ON public.chat_room_members;
CREATE POLICY members_can_read_room_members
ON public.chat_room_members FOR SELECT TO authenticated
USING (public.is_room_member(chat_room_id));

DROP POLICY IF EXISTS users_can_leave_rooms ON public.chat_room_members;
CREATE POLICY users_can_leave_rooms
ON public.chat_room_members FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- The DELETE policy above is dead without the privilege (rls-hardening
-- revoked DELETE from authenticated). Re-grant scoped to this table only so
-- leave-room works.
GRANT DELETE ON public.chat_room_members TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Room-partner company read + own-message soft-delete
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS members_can_read_room_partner_company ON public.company_members;
CREATE POLICY members_can_read_room_partner_company
ON public.company_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_room_members m1
    JOIN public.chat_room_members m2 ON m1.chat_room_id = m2.chat_room_id
    WHERE m1.user_id = auth.uid()
      AND m2.user_id = company_members.user_id
  )
);

DROP POLICY IF EXISTS users_can_soft_delete_own_messages ON public.messages;
CREATE POLICY users_can_soft_delete_own_messages
ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Explicit deny policies on tables the app does not use
-- (RLS enabled with no allow-policies would already deny; these make the
-- intent explicit and match production.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS bookmarks_deny ON public.bookmarks;
CREATE POLICY bookmarks_deny ON public.bookmarks FOR ALL TO PUBLIC USING (false);

DROP POLICY IF EXISTS market_recommendations_deny ON public.market_recommendations;
CREATE POLICY market_recommendations_deny ON public.market_recommendations FOR ALL TO PUBLIC USING (false);

DROP POLICY IF EXISTS product_hs_codes_deny ON public.product_hs_codes;
CREATE POLICY product_hs_codes_deny ON public.product_hs_codes FOR ALL TO PUBLIC USING (false);

DROP POLICY IF EXISTS product_images_deny ON public.product_images;
CREATE POLICY product_images_deny ON public.product_images FOR ALL TO PUBLIC USING (false);

DROP POLICY IF EXISTS reports_deny ON public.reports;
CREATE POLICY reports_deny ON public.reports FOR ALL TO PUBLIC USING (false);

DROP POLICY IF EXISTS reviews_deny ON public.reviews;
CREATE POLICY reviews_deny ON public.reviews FOR ALL TO PUBLIC USING (false);

-- ---------------------------------------------------------------------------
-- 6. Company verification columns (live in production, never migrated)
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS verification_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 7. Self-purchase guard trigger on order_items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_self_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_seller_user UUID;
  v_buyer_user UUID;
BEGIN
  SELECT user_id INTO v_buyer_user FROM public.orders WHERE id = NEW.order_id;
  SELECT sp.user_id INTO v_seller_user
  FROM public.marketplace_listings ml
  JOIN public.seller_profiles sp ON sp.id = ml.seller_profile_id
  WHERE ml.id = NEW.listing_id;
  IF v_seller_user IS NOT NULL AND v_buyer_user IS NOT NULL AND v_seller_user = v_buyer_user THEN
    RAISE EXCEPTION 'You cannot purchase your own listing (%)', NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS check_self_purchase ON public.order_items;
CREATE TRIGGER check_self_purchase
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_purchase();

-- ---------------------------------------------------------------------------
-- 8. Realtime room-event triggers + rooms:% channel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
  BEGIN
    PERFORM realtime.publish('rooms:' || NEW.user_id::text, 'new_room', jsonb_build_object('chat_room_id', NEW.chat_room_id));
    RETURN NEW;
  END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_room_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
  BEGIN
    PERFORM realtime.publish('rooms:' || OLD.user_id::text, 'room_deleted', jsonb_build_object('chat_room_id', OLD.chat_room_id));
    RETURN OLD;
  END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_chat_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
  BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      PERFORM realtime.publish(
        'chat:' || NEW.chat_room_id::text,
        'message_deleted',
        jsonb_build_object(
          'id', NEW.id,
          'chat_room_id', NEW.chat_room_id,
          'content', NEW.content,
          'deleted_at', NEW.deleted_at,
          'file_url', NEW.file_url
        )
      );
    END IF;
    RETURN NEW;
  END;
$function$;

DROP TRIGGER IF EXISTS chat_room_member_new_room_trigger ON public.chat_room_members;
CREATE TRIGGER chat_room_member_new_room_trigger
AFTER INSERT ON public.chat_room_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_room();

DROP TRIGGER IF EXISTS chat_room_member_deleted_trigger ON public.chat_room_members;
CREATE TRIGGER chat_room_member_deleted_trigger
AFTER DELETE ON public.chat_room_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_room_deleted();

DROP TRIGGER IF EXISTS chat_message_deleted_trigger ON public.messages;
CREATE TRIGGER chat_message_deleted_trigger
AFTER UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_deleted();

-- The rooms:% channel exists in production but was never declared: clients
-- subscribe to rooms:<user_id> (DashboardHome, Messages) yet only chat:%
-- had a subscribe policy, so room events were silently denied.
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('rooms:%', 'Per-user room lifecycle events', true)
ON CONFLICT (pattern) DO UPDATE
SET description = EXCLUDED.description,
    enabled = EXCLUDED.enabled;

DROP POLICY IF EXISTS rooms_subscribe_own_channels ON realtime.channels;
CREATE POLICY rooms_subscribe_own_channels
ON realtime.channels FOR SELECT TO authenticated
USING (
  pattern = 'rooms:%'
  AND NULLIF(split_part(realtime.channel_name(), ':', 2), '') = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- 9. Parity grants (match production intent)
-- ---------------------------------------------------------------------------
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.order_items TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
