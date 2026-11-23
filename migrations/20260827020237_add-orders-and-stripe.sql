-- Orders + Order Items for Stripe checkout (cart)
-- Enables RLS for InsForge Stripe runtime tables and adds webhook fulfillment

-- Ensure pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','expired')),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'LKR',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  metadata JSONB
);

-- Order items (line items snapped from marketplace_listings at purchase time)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  currency TEXT NOT NULL DEFAULT 'LKR',
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_listing_id ON public.order_items(listing_id);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage their own orders
DROP POLICY IF EXISTS "users_can_insert_own_orders" ON public.orders;
CREATE POLICY "users_can_insert_own_orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_can_select_own_orders" ON public.orders;
CREATE POLICY "users_can_select_own_orders"
ON public.orders FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_can_update_own_orders" ON public.orders;
CREATE POLICY "users_can_update_own_orders"
ON public.orders FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS: order_items via parent order ownership
DROP POLICY IF EXISTS "users_can_insert_own_order_items" ON public.order_items;
CREATE POLICY "users_can_insert_own_order_items"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

DROP POLICY IF EXISTS "users_can_select_own_order_items" ON public.order_items;
CREATE POLICY "users_can_select_own_order_items"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

-- Stripe runtime RLS (InsForge managed tables in payments schema)
-- These tables are created by InsForge; we just add policies so authenticated users can create checkout
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='payments' AND table_name='stripe_checkout_sessions') THEN
    EXECUTE 'ALTER TABLE payments.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "users create their stripe checkout sessions" ON payments.stripe_checkout_sessions';
    EXECUTE $p$
      CREATE POLICY "users create their stripe checkout sessions"
      ON payments.stripe_checkout_sessions FOR INSERT TO authenticated
      WITH CHECK (subject_type = 'user' AND subject_id = auth.uid()::text)
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "users read their stripe checkout sessions" ON payments.stripe_checkout_sessions';
    EXECUTE $p$
      CREATE POLICY "users read their stripe checkout sessions"
      ON payments.stripe_checkout_sessions FOR SELECT TO authenticated
      USING (subject_type = 'user' AND subject_id = auth.uid()::text)
    $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='payments' AND table_name='stripe_customer_portal_sessions') THEN
    EXECUTE 'ALTER TABLE payments.stripe_customer_portal_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "users create their stripe portal sessions" ON payments.stripe_customer_portal_sessions';
    EXECUTE $p$
      CREATE POLICY "users create their stripe portal sessions"
      ON payments.stripe_customer_portal_sessions FOR INSERT TO authenticated
      WITH CHECK (subject_type = 'user' AND subject_id = auth.uid()::text)
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "users read their stripe portal sessions" ON payments.stripe_customer_portal_sessions';
    EXECUTE $p$
      CREATE POLICY "users read their stripe portal sessions"
      ON payments.stripe_customer_portal_sessions FOR SELECT TO authenticated
      USING (subject_type = 'user' AND subject_id = auth.uid()::text)
    $p$;
  END IF;
END $$;

-- Webhook fulfillment: mark orders paid from verified Stripe events
-- Idempotent, handles out-of-order delivery (payload may arrive before customer_mappings)
CREATE OR REPLACE FUNCTION public.fulfill_stripe_paid_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.provider = 'stripe'
     AND NEW.processing_status = 'processed'
     AND NEW.event_type IN (
       'checkout.session.completed',
       'checkout.session.async_payment_succeeded',
       'payment_intent.succeeded',
       'invoice.paid'
     )
     AND (NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'order_id') IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'paid',
        paid_at = COALESCE(NEW.processed_at, NOW()),
        stripe_payment_intent_id = COALESCE(
          NEW.payload -> 'data' -> 'object' ->> 'payment_intent',
          stripe_payment_intent_id
        ),
        stripe_checkout_session_id = COALESCE(
          NEW.payload -> 'data' -> 'object' ->> 'id',
          stripe_checkout_session_id
        )
    WHERE id::text = NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'order_id'
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS fulfill_stripe_paid_order_from_webhook ON payments.webhook_events;
CREATE TRIGGER fulfill_stripe_paid_order_from_webhook
  AFTER INSERT OR UPDATE ON payments.webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fulfill_stripe_paid_order();

-- Grants (InsForge default roles already have broad DML, but ensure)
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.order_items TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
