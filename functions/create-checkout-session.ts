const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Stripe's minimum chargeable amount per currency (smallest unit). For
// currencies Stripe does not list a zero-decimal amount for, the entry is
// the minor-unit value; e.g. LKR=500 (Rs 5.00), USD=50 (50c).
// Ref: https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts
const STRIPE_MIN_AMOUNT: Record<string, number> = {
  usd: 50, eur: 50, gbp: 30, lkr: 500, inr: 50, aud: 50, cad: 50,
  sgd: 50, jpy: 50, cny: 50, nzd: 50, chf: 50, hkd: 400, myr: 200,
  thb: 100, php: 200, idr: 8000, vnd: 10000, pkr: 50, bdt: 50,
  zar: 50, aed: 200, sar: 200, qar: 200,
};
function stripeMinFor(currency: string): number {
  return STRIPE_MIN_AMOUNT[currency.toLowerCase()] ?? 50;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export default async function(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) {
    return json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY secret.' }, 500);
  }

  // Forward the caller's JWT so RLS-gated reads see only what the buyer can
  // see. The Authorization header is mandatory: RLS on orders (owner-only)
  // doubles as proof that the caller owns the order they are paying for —
  // a buyer asking about someone else's order gets zero rows (404).
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Missing Authorization bearer token' }, 401);
  }
  const userJwt = auth.slice(7).trim();

  try {
    const body = await req.json() as {
      orderId: string;
      successUrl: string;
      cancelUrl: string;
      customerEmail?: string | null;
      // Legacy clients also send lineItems with client-computed amounts.
      // They are intentionally IGNORED: amounts are always re-priced from
      // the authoritative order_items rows so buyers cannot pay less than
      // the listed price.
      lineItems?: unknown;
    };

    if (!body.orderId || !body.successUrl || !body.cancelUrl) {
      return json({ error: 'Missing orderId, successUrl or cancelUrl' }, 400);
    }

    const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
    if (!baseUrl) {
      return json({ error: 'Payment service misconfigured (missing base URL).' }, 500);
    }
    const { createClient } = await import('npm:@insforge/sdk');
    const userClient = createClient({ baseUrl, accessToken: userJwt });

    // Authoritative order read (RLS: only the owning buyer sees a row).
    const { data: order, error: orderErr } = await userClient.database
      .from('orders')
      .select('id, user_id, status, currency')
      .eq('id', body.orderId)
      .maybeSingle();
    if (orderErr || !order) {
      return json({ error: 'Order not found or not accessible' }, 404);
    }
    const ord = order as { id: string; user_id: string; status: string; currency: string };
    if (ord.status !== 'pending') {
      return json({ error: `Order is ${ord.status}, only pending orders can be paid.` }, 409);
    }

    // Authoritative line items (buyers can INSERT but never UPDATE/DELETE
    // their items, and the self-purchase trigger guards creation — but we
    // re-verify here anyway and fail closed on any check error).
    // NOTE: 4xx outcomes return directly; the catch below only sees
    // unexpected failures and always answers 500 (fail closed).
    let items: Array<{ listing_id: string | null; quantity: number; unit_price: number | string; currency: string; title: string }> = [];
    try {
      const { data: rows, error: itemsErr } = await userClient.database
        .from('order_items')
        .select('listing_id, quantity, unit_price, currency, title')
        .eq('order_id', body.orderId);
      if (itemsErr || !rows || (rows as unknown[]).length === 0) {
        return json({ error: 'Order has no items.' }, 400);
      }
      items = rows as typeof items;

      // Fail closed: every item must resolve to a listing whose seller is
      // NOT the buyer.
      for (const it of items) {
        if (!it.listing_id) continue;
        const { data: listing, error: listingErr } = await userClient.database
          .from('marketplace_listings')
          .select('seller_profile_id')
          .eq('id', it.listing_id)
          .maybeSingle();
        if (listingErr) throw new Error('Could not verify listing ownership.');
        const sellerProfileId = (listing as { seller_profile_id: string | null } | null)?.seller_profile_id;
        if (!sellerProfileId) continue;
        const { data: seller, error: sellerErr } = await userClient.database
          .from('seller_profiles')
          .select('user_id')
          .eq('id', sellerProfileId)
          .maybeSingle();
        if (sellerErr) throw new Error('Could not verify seller.');
        if ((seller as { user_id: string } | null)?.user_id === ord.user_id) {
          return json({ error: 'You cannot purchase your own listings.' }, 403);
        }
      }
    } catch (e: unknown) {
      // Fail closed: if ownership cannot be verified, do not charge.
      const msg = e instanceof Error ? e.message : 'Could not verify order items.';
      return json({ error: msg }, 500);
    }

    // Stripe Checkout requires a single presentment currency.
    const currencies = Array.from(new Set(items.map((i) => (i.currency || 'LKR').toLowerCase())));
    if (currencies.length !== 1) {
      return json({ error: 'Mixed-currency carts are not supported. Please check out items in one currency.' }, 400);
    }

    // Build Stripe line_items from DB prices (never from the caller).
    const stripeLineItems = items.map((it) => {
      const currency = (it.currency || 'LKR').toLowerCase();
      const min = stripeMinFor(currency);
      const unit = Math.max(min, Math.round(Number(it.unit_price) * 100));
      const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
      return {
        price_data: { currency, product_data: { name: it.title }, unit_amount: unit },
        quantity: qty,
      };
    });

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', body.successUrl);
    params.set('cancel_url', body.cancelUrl);
    params.set('client_reference_id', body.orderId);
    params.set('metadata[order_id]', body.orderId);
    if (body.customerEmail) params.set('customer_email', body.customerEmail);

    stripeLineItems.forEach((li, idx) => {
      params.set(`line_items[${idx}][price_data][currency]`, li.price_data.currency);
      params.set(`line_items[${idx}][price_data][product_data][name]`, li.price_data.product_data.name);
      params.set(`line_items[${idx}][price_data][unit_amount]`, String(li.price_data.unit_amount));
      params.set(`line_items[${idx}][quantity]`, String(li.quantity));
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const stripeData = await stripeRes.json() as { id?: string; url?: string; error?: { message?: string } };

    if (!stripeRes.ok) {
      return json({ error: stripeData?.error?.message || 'Stripe error', details: stripeData }, stripeRes.status);
    }

    return json({ url: stripeData.url, sessionId: stripeData.id }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
}
