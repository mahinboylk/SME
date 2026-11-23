import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { insforge } from '@/lib/insforge';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useTranslation } from '@/contexts/I18nContext';
import { formatRupees, formatDate } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';

interface Order {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  stripe_checkout_session_id: string | null;
}

export function Orders() {
  const { profile } = useAuth();
  const { totalItems } = useCart();
  const t = useTranslation().t as (k:string)=>string;
  usePageMeta('My Orders');

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders', profile?.id],
    enabled: !!profile?.id && profile?.role !== 'sme_owner',
    queryFn: async () => {
      const { data, error: err } = await insforge.database
        .from('orders')
        .select('id, status, total_amount, currency, created_at, paid_at, stripe_checkout_session_id')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false });
      if (err) throw err;
      return (data || []) as unknown as Order[];
    }
  });

  if (profile?.role === 'sme_owner') {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl text-center py-12">
        <Package className="w-16 h-16 mx-auto text-text-tertiary opacity-30" />
        <h1 className="text-2xl font-bold text-text-primary">{t('Orders are for buyers only')}</h1>
        <p className="text-text-secondary">{t('As an exporter, check your received orders from buyers.')}</p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard/sales" className="btn btn-primary">{t('Received Orders')}</Link>
          <Link to="/dashboard/marketplace" className="btn bg-bg-tertiary text-text-primary hover:bg-border">{t('Browse Marketplace')}</Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  if (error) return <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex gap-3"><AlertCircle className="w-5 h-5 text-danger-500" /><p className="text-sm text-danger-500">{error instanceof Error ? error.message : t('Failed to load orders')}</p></div>;

  if (orders.length === 0) return (
    <div className="text-center py-12 space-y-4">
      <Package className="w-16 h-16 mx-auto text-text-tertiary opacity-30" />
      <h2 className="text-xl font-bold text-text-primary">{t('No orders yet')}</h2>
      <p className="text-text-secondary">{t('Your orders will appear here after checkout.')}</p>
      <Link to="/dashboard/marketplace" className="btn btn-primary inline-flex"><ShoppingCart className="w-4 h-4 mr-2" />{t('Browse Marketplace')}</Link>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">{t('My Orders')}</h1>
        <Link to="/dashboard/cart" className="btn bg-bg-tertiary text-text-primary hover:bg-border text-sm py-1.5 relative">
          <ShoppingCart className="w-4 h-4 mr-1.5" />{t('Cart')}
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {totalItems}
            </span>
          )}
        </Link>
      </div>
      <div className="space-y-3">
        {orders.map((o) => (
          <Link key={o.id} to={`/dashboard/orders/${o.id}`} className="card p-4 flex items-center justify-between hover:border-primary-500/30 transition-colors">
            <div>
              <p className="font-mono text-sm text-text-primary">#{o.id.slice(0,8)}</p>
              <p className="text-xs text-text-tertiary">{formatDate(o.created_at)} · {o.currency} {formatRupees(o.total_amount)}</p>
            </div>
            <span className={`badge text-xs px-2.5 py-1 ${o.status === 'paid' ? 'bg-success-500/10 text-success-500 border-success-500/20' : o.status === 'pending' ? 'bg-warning-500/10 text-warning-500 border-warning-500/20' : 'bg-danger-500/10 text-danger-500'}`}>{o.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams<{id:string}>() as { id: string };
  const { profile, user } = useAuth();
  const t = useTranslation().t as (k:string)=>string;
  usePageMeta('Order Detail');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    enabled: !!id && profile?.role !== 'sme_owner',
    queryFn: async () => {
      const { data, error } = await insforge.database.from('orders').select('id, status, total_amount, currency, created_at, paid_at, metadata').eq('id', id).single();
      if (error) throw error;
      return data as unknown as Order & { metadata: { items?: Array<{ title:string, quantity:number, price:number, currency:string }> } | null };
    }
  });
  const { data: items = [] } = useQuery({
    queryKey: ['order-items', id],
    enabled: !!id && profile?.role !== 'sme_owner',
    queryFn: async () => {
      const { data, error } = await insforge.database.from('order_items').select('id, listing_id, quantity, unit_price, currency, title').eq('order_id', id);
      if (error) throw error;
      return data as unknown as Array<{ id:string, listing_id:string|null, quantity:number, unit_price:number, currency:string, title:string }>;
    }
  });

  if (profile?.role === 'sme_owner') {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">{t('This order view is for buyers. Check received orders instead.')}</p>
        <Link to="/dashboard/sales" className="btn btn-primary mt-4">{t('Received Orders')}</Link>
      </div>
    );
  }
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  if (!order) return <div className="text-center py-12">{t('Order not found')}</div>;

  // Retry payment for pending orders (e.g. cancelled/expired sessions).
  // Amounts are re-priced server-side from order_items.
  const handlePayNow = async () => {
    if (!order || paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const origin = window.location.origin;
      const { data, error } = await insforge.functions.invoke('create-checkout-session', {
        body: {
          orderId: order.id,
          successUrl: `${origin}/dashboard/cart/success?order_id=${order.id}`,
          cancelUrl: `${origin}/dashboard/cart/cancel?order_id=${order.id}`,
          customerEmail: user?.email ?? null,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error(t('Could not start checkout. Please try again.'));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : t('Could not start checkout. Please try again.'));
    } finally {
      setPaying(false);
    }
  };
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Link to="/dashboard/orders" className="text-sm text-text-secondary hover:text-primary-500">← {t('Back to Orders')}</Link>
      <div className="card p-6 space-y-4">
        <div className="flex justify-between">
          <h1 className="text-xl font-bold text-text-primary">Order #{order.id.slice(0,8)}</h1>
          <span className={`badge ${order.status==='paid'?'bg-success-500/10 text-success-500':'bg-warning-500/10 text-warning-500'}`}>{order.status}</span>
        </div>
        <p className="text-sm text-text-tertiary">{formatDate(order.created_at)} {order.paid_at ? `· Paid ${formatDate(order.paid_at)}` : ''}</p>
        <div className="border-t border-border/50 pt-4 space-y-2">
          {items.map((it)=>(
            <div key={it.id} className="flex justify-between text-sm">
              <span className="text-text-primary">{it.title} × {it.quantity}</span>
              <span className="text-text-secondary">{it.currency} {it.unit_price} each</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border/50 pt-4 flex justify-between font-bold">
          <span>{t('Total')}</span>
          <span>{formatRupees(Number(order.total_amount))}</span>
        </div>
        {order.status === 'pending' && (
          <div className="border-t border-border/50 pt-4 space-y-2">
            {payError && <p className="text-sm text-danger-500">{payError}</p>}
            <button onClick={handlePayNow} disabled={paying} className="btn btn-primary w-full disabled:opacity-50">
              {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
              {paying ? t('Starting checkout…') : t('Complete Payment')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
