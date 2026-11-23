import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingCart, ArrowLeft, Loader2, AlertCircle, Package } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useForexRate } from '@/contexts/ForexContext';
import { formatPriceInRupees, formatRupees, formatCurrency } from '@/lib/utils';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useTranslation } from '@/contexts/I18nContext';
import { insforge } from '@/lib/insforge';
import { useState } from 'react';
import { toast } from 'sonner';

export function Cart() {
  const { items, removeItem, updateQuantity, clearCart, totalAmount } = useCart();
  const { profile, user } = useAuth();
  const forexRate = useForexRate();
  const navigate = useNavigate();
  const { t } = useTranslation();
  usePageMeta('Shopping Cart');
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile?.role === 'sme_owner') {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl text-center py-12">
        <ShoppingCart className="w-16 h-16 mx-auto text-text-tertiary opacity-30" />
        <h1 className="text-2xl font-bold text-text-primary">{t('Cart is for buyers only')}</h1>
        <p className="text-text-secondary">{t('As an exporter, you can manage your listings and view received orders.')}</p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard/marketplace" className="btn btn-primary">{t('Browse Marketplace')}</Link>
          <Link to="/dashboard/sales" className="btn bg-bg-tertiary text-text-primary hover:bg-border">{t('Received Orders')}</Link>
        </div>
      </div>
    );
  }

  const handleCheckout = async () => {
    if (!profile || !user) {
      navigate('/login');
      return;
    }
    if (items.length === 0) return;
    if (items.some((i) => i.price == null)) {
      setError(t('Some items have no price and cannot be checked out.'));
      return;
    }
    // Prevent buying own listings
    try {
      const { data: sellerProfile } = await insforge.database.from('seller_profiles').select('id').eq('user_id', profile.id).maybeSingle();
      if (sellerProfile) {
        const sellerId = (sellerProfile as { id: string }).id;
        const { data: own } = await insforge.database.from('marketplace_listings').select('id').in('id', items.map((i) => i.listingId)).eq('seller_profile_id', sellerId);
        if (own && (own as Array<{id:string}>).length > 0) {
          setError(t('You cannot purchase your own listings. Please remove them from cart.'));
          return;
        }
      }
    } catch {
      // non-fatal, continue to checkout but backend will also enforce
    }
    setCheckingOut(true);
    setError(null);
    try {
      // Stripe Checkout requires a single presentment currency — fail fast
      // with a clear message instead of a cryptic Stripe error.
      const currencies = Array.from(new Set(items.map((i) => (i.currency || 'LKR').toLowerCase())));
      if (currencies.length !== 1) {
        throw new Error(t('Mixed-currency carts are not supported. Please check out items in one currency.'));
      }
      // Calculate total in LKR and USD (Stripe prefers smallest unit)
      const totalLkr = totalAmount(forexRate);
      // Create pending order first (for webhook fulfillment)
      const { data: order, error: orderError } = await insforge.database
        .from('orders')
        .insert([{
          user_id: profile.id,
          status: 'pending',
          total_amount: totalLkr,
          currency: 'LKR',
          metadata: { items: items.map((i) => ({ listingId: i.listingId, title: i.title, quantity: i.quantity, price: i.price, currency: i.currency })) }
        }])
        .select()
        .single();
      if (orderError) throw orderError;
      const orderId = (order as { id: string }).id;

      // Create order_items snapshot
      const orderItemsPayload = items.map((i) => ({
        order_id: orderId,
        listing_id: i.listingId,
        quantity: i.quantity,
        unit_price: i.price!,
        currency: i.currency,
        title: i.title,
      }));
      const { error: itemsError } = await insforge.database.from('order_items').insert(orderItemsPayload);
      if (itemsError) throw itemsError;

      // Try InsForge Stripe Checkout (requires Stripe configured via CLI)
      // We use a generic price creation via edge function for dynamic cart totals.
      // First try edge function that creates Stripe session with price_data (dynamic amounts)
      const origin = window.location.origin;
      const successUrl = `${origin}/dashboard/cart/success?order_id=${orderId}`;
      const cancelUrl = `${origin}/dashboard/cart/cancel?order_id=${orderId}`;

      // Prepare line items for the edge function. Amounts are re-priced
      // server-side from order_items (client values are ignored), so this
      // payload only carries identity/quantity.
      const lineItems = items.map((i) => {
        const currency = (i.currency || 'LKR').toLowerCase();
        const unitAmountCents = Math.round(i.price! * 100);
        return {
          name: i.title,
          unitAmount: unitAmountCents,
          quantity: i.quantity,
          currency,
        };
      });

      // Call edge function
      const { data: fnData, error: fnError } = await insforge.functions.invoke('create-checkout-session', {
        body: {
          orderId,
          lineItems,
          successUrl,
          cancelUrl,
          customerEmail: user.email ?? null,
        }
      });

      // Fallback: edge function unavailable or Stripe not configured there.
      // Do NOT clear the cart — payment never happened. Keep the pending
      // order so the buyer can retry from the order detail page.
      if (fnError || !(fnData as { url?: string })?.url) {
        const fnUrl = (fnData as { url?: string })?.url;
        if (fnUrl) {
          window.open(fnUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        // Check if error is due to missing Stripe config
        const msg = fnError ? (fnError as { message?: string }).message : '';
        if (msg && msg.toLowerCase().includes('stripe')) {
          setError(t('Payments are not configured yet. Your order was saved as pending — please try again later.'));
        } else {
          // Still created the order but got no checkout URL — review it.
          toast.success(t('Order created. Awaiting payment.'));
          navigate(`/dashboard/orders/${orderId}`);
          return;
        }
        throw fnError;
      }

      const url = (fnData as { url: string }).url;
      // Save session id to order for tracking
      await insforge.database.from('orders').update({ stripe_checkout_session_id: (fnData as { sessionId?: string }).sessionId ?? null }).eq('id', orderId);
      // New-tab checkout: the app tab stays open; Stripe redirects the new
      // tab to the success/cancel page, which shares cart state via localStorage.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('Checkout failed. Please try again.');
      setError(msg);
      toast.error(msg);
    } finally {
      setCheckingOut(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto text-center py-12">
        <ShoppingCart className="w-16 h-16 mx-auto text-text-tertiary opacity-30" />
        <h1 className="text-2xl font-bold text-text-primary">{t('Your cart is empty')}</h1>
        <p className="text-text-secondary">{t('Browse the marketplace to add products.')}</p>
        <Link to="/dashboard/marketplace" className="btn btn-primary inline-flex">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('Go to Marketplace')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">{t('Shopping Cart')}</h1>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/orders" className="btn bg-bg-tertiary text-text-primary hover:bg-border text-sm py-1.5">
            <Package className="w-4 h-4 mr-1.5" />{t('Orders')}
          </Link>
          <button onClick={clearCart} className="text-sm text-danger-500 hover:underline ml-2">{t('Clear Cart')}</button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-500">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.listingId} className="card p-4 flex gap-4 items-center">
            <div className="w-16 h-16 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0">
              <ShoppingCart className="w-8 h-8 opacity-20" />
            </div>
            <div className="flex-1 min-w-0">
              <Link to={`/dashboard/marketplace/${item.listingId}`} className="font-semibold text-text-primary hover:text-primary-500 truncate block">
                {item.title}
              </Link>
              {item.sellerName && <p className="text-xs text-text-tertiary">{item.sellerName} {item.category ? `· ${item.category}` : ''}</p>}
              <p className="text-sm font-bold text-text-primary mt-1">
                {formatPriceInRupees(item.price, item.currency, forexRate)}
                <span className="text-xs font-normal text-text-tertiary ml-2">x {item.quantity}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateQuantity(item.listingId, item.quantity - 1)} className="w-8 h-8 rounded-lg bg-bg-tertiary hover:bg-border flex items-center justify-center">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-medium">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.listingId, item.quantity + 1)} className="w-8 h-8 rounded-lg bg-bg-tertiary hover:bg-border flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => removeItem(item.listingId)} className="p-2 text-text-tertiary hover:text-danger-500">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex justify-between text-text-secondary">
          <span>{t('Subtotal')} ({items.reduce((s, i) => s + i.quantity, 0)} {t('items')})</span>
          <span className="font-bold text-text-primary">{formatRupees(totalAmount(forexRate))}</span>
        </div>
        <div className="flex justify-between text-sm text-text-tertiary">
          <span>{t('USD equivalent')} </span>
          <span>{formatCurrency(totalAmount(forexRate) / forexRate, 'USD')}</span>
        </div>
        <button onClick={handleCheckout} disabled={checkingOut} className="btn btn-primary w-full">
          {checkingOut ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
          {t('Proceed to Checkout with Stripe')}
        </button>
        <p className="text-xs text-text-tertiary text-center">{t('Secure payment via Stripe. You will be redirected to Stripe Checkout.')}</p>
      </div>
    </div>
  );
}
