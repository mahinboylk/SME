import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { insforge } from '@/lib/insforge';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useTranslation } from '@/contexts/I18nContext';
import { formatRupees, formatDate } from '@/lib/utils';

interface ReceivedOrder {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  user_id: string;
}

export function Sales() {
  const { profile } = useAuth();
  const t = useTranslation().t as (k:string)=>string;
  usePageMeta('Received Orders');

  // Defense in depth alongside SmeOwnerRoute: only exporters have received
  // orders (sellers_can_select_received_orders RLS). Hooks stay
  // unconditional — the gate returns below, after all hooks.
  const isSmeOwner = !profile || profile.role === 'sme_owner';

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['received-orders', profile?.id],
    enabled: !!profile?.id && isSmeOwner,
    queryFn: async () => {
      // Get seller_profile for current exporter
      const { data: sellerProfile } = await insforge.database
        .from('seller_profiles')
        .select('id')
        .eq('user_id', profile!.id)
        .maybeSingle();
      if (!sellerProfile) return [];
      const { data: myListings } = await insforge.database
        .from('marketplace_listings')
        .select('id')
        .eq('seller_profile_id', (sellerProfile as { id:string }).id);
      const listingIds = ((myListings || []) as Array<{id:string}>).map(l=>l.id);
      if (listingIds.length === 0) return [];
      // Find order_items that reference my listings
      const { data: items } = await insforge.database
        .from('order_items')
        .select('order_id')
        .in('listing_id', listingIds);
      const orderIds = Array.from(new Set(((items||[]) as Array<{order_id:string}>).map(i=>i.order_id)));
      if (orderIds.length === 0) return [];
      const { data: ordersData, error: err } = await insforge.database
        .from('orders')
        .select('id, status, total_amount, currency, created_at, paid_at, user_id')
        .in('id', orderIds)
        .order('created_at', { ascending: false });
      if (err) throw err;
      return (ordersData || []) as unknown as ReceivedOrder[];
    },
  });

  if (!isSmeOwner) {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl text-center py-12">
        <Package className="w-16 h-16 mx-auto text-text-tertiary opacity-30" />
        <h1 className="text-2xl font-bold text-text-primary">{t('Received orders are for exporters')}</h1>
        <p className="text-text-secondary">{t('As a buyer, track your purchases under My Orders.')}</p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard/orders" className="btn btn-primary">{t('My Orders')}</Link>
          <Link to="/dashboard/marketplace" className="btn bg-bg-tertiary text-text-primary hover:bg-border">{t('Browse Marketplace')}</Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  if (error) return <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex gap-3"><AlertCircle className="w-5 h-5 text-danger-500" /><p className="text-sm text-danger-500">{error instanceof Error ? error.message : t('Failed to load received orders')}</p></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('Received Orders')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('Orders from buyers for your listings. You’ll be notified when a new order is paid.')}</p>
        </div>
        <Link to="/dashboard/marketplace" className="btn bg-bg-tertiary text-text-primary hover:bg-border text-sm">
          <ShoppingCart className="w-4 h-4 mr-1.5" />{t('Marketplace')}
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="card p-8 text-center">
          <Package className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-text-primary">{t('No received orders yet')}</h3>
          <p className="text-text-secondary mt-1">{t('When buyers purchase your products, they will appear here. Paid orders trigger automatic fulfillment.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/dashboard/sales/${o.id}`} className="card p-4 flex items-center justify-between hover:border-primary-500/30 transition-colors">
              <div>
                <p className="font-mono text-sm text-text-primary">#{o.id.slice(0,8)} · {o.status === 'paid' ? t('Paid') : t('Pending')}</p>
                <p className="text-xs text-text-tertiary">{formatDate(o.created_at)} · {o.currency} {formatRupees(o.total_amount)} · {t('Buyer')} {o.user_id.slice(0,8)}</p>
              </div>
              <span className={`badge text-xs px-2.5 py-1 ${o.status === 'paid' ? 'bg-success-500/10 text-success-500 border-success-500/20' : 'bg-warning-500/10 text-warning-500 border-warning-500/20'}`}>{o.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SaleDetail() {
  const { id } = useParams<{id:string}>() as { id: string };
  const t = useTranslation().t as (k:string)=>string;
  usePageMeta('Sale Detail');
  const { data: order, isLoading } = useQuery({
    queryKey: ['sale', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await insforge.database.from('orders').select('id, status, total_amount, currency, created_at, paid_at, user_id, metadata').eq('id', id).single();
      if (error) throw error;
      return data as unknown as ReceivedOrder & { metadata: unknown };
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ['sale-items', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await insforge.database.from('order_items').select('id, listing_id, quantity, unit_price, currency, title').eq('order_id', id);
      if (error) throw error;
      return data as unknown as Array<{ id:string, listing_id:string|null, quantity:number, unit_price:number, currency:string, title:string }>;
    },
  });
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  if (!order) return <div className="text-center py-12">{t('Order not found')}</div>;
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Link to="/dashboard/sales" className="text-sm text-text-secondary hover:text-primary-500">← {t('Back to Received Orders')}</Link>
      <div className="card p-6 space-y-4">
        <div className="flex justify-between">
          <h1 className="text-xl font-bold text-text-primary">Order #{order.id.slice(0,8)}</h1>
          <span className={`badge ${order.status==='paid'?'bg-success-500/10 text-success-500':'bg-warning-500/10 text-warning-500'}`}>{order.status}</span>
        </div>
        <p className="text-sm text-text-tertiary">{formatDate(order.created_at)} {order.paid_at ? `· Paid ${formatDate(order.paid_at)}` : ''} · Buyer {order.user_id.slice(0,8)}</p>
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
      </div>
    </div>
  );
}
