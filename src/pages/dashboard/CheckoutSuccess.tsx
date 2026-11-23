import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, Package, ShoppingBag } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useTranslation } from '@/contexts/I18nContext';
import { useCart } from '@/contexts/CartContext';
import { insforge } from '@/lib/insforge';

export function CheckoutSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const { clearCart } = useCart();
  const { t } = useTranslation();
  usePageMeta('Payment Success');
  // Only clear the cart once the order is verified paid. Never trust the
  // URL alone — it can be visited manually without paying.
  const [verified, setVerified] = useState<boolean | null>(orderId ? null : true);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await insforge.database
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .maybeSingle();
        if (cancelled) return;
        const paid = (data as { status?: string } | null)?.status === 'paid';
        setVerified(paid);
        if (paid) clearCart();
      } catch {
        if (!cancelled) setVerified(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, clearCart]);

  if (verified === null) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 space-y-6 animate-fade-in">
        <Clock className="w-10 h-10 text-primary-500 mx-auto animate-pulse" />
        <h1 className="text-2xl font-bold text-text-primary">{t('Confirming your payment…')}</h1>
        <p className="text-text-secondary">{t('Please wait while we verify your order status.')}</p>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 space-y-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-warning-500/10 flex items-center justify-center mx-auto">
          <Clock className="w-10 h-10 text-warning-500" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary">{t('Payment not confirmed yet')}</h1>
        <p className="text-text-secondary">
          {t('Your order is still pending. If you just paid, confirmation can take a moment.')}
          {orderId && <span className="block mt-2 font-mono text-sm">Order #{orderId.slice(0,8)}</span>}
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <Link to={orderId ? `/dashboard/orders/${orderId}` : '/dashboard/orders'} className="btn btn-primary">
            <Package className="w-4 h-4 mr-2" />
            {t('View Order')}
          </Link>
          <Link to="/dashboard/cart" className="btn bg-bg-tertiary text-text-primary hover:bg-border">
            <ShoppingBag className="w-4 h-4 mr-2" />
            {t('Back to Cart')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-12 space-y-6 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-success-500/10 flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-success-500" />
      </div>
      <h1 className="text-3xl font-bold text-text-primary">{t('Payment Successful!')}</h1>
      <p className="text-text-secondary">
        {t('Thank you for your order. Your payment has been confirmed.')}
        {orderId && <span className="block mt-2 font-mono text-sm">Order #{orderId.slice(0,8)}</span>}
      </p>
      <p className="text-sm text-text-tertiary">{t('You will receive a confirmation email shortly. Your order will be processed by the sellers.')}</p>
      <div className="flex gap-3 justify-center pt-4">
        <Link to="/dashboard/orders" className="btn btn-primary">
          <Package className="w-4 h-4 mr-2" />
          {t('View Orders')}
        </Link>
        <Link to="/dashboard/marketplace" className="btn bg-bg-tertiary text-text-primary hover:bg-border">
          <ShoppingBag className="w-4 h-4 mr-2" />
          {t('Continue Shopping')}
        </Link>
      </div>
    </div>
  );
}

export function CheckoutCancel() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const { t } = useTranslation();
  usePageMeta('Payment Cancelled');
  return (
    <div className="max-w-2xl mx-auto text-center py-12 space-y-6 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-warning-500/10 flex items-center justify-center mx-auto">
        <span className="text-3xl">⚠️</span>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">{t('Payment Cancelled')}</h1>
      <p className="text-text-secondary">
        {t('Your payment was cancelled. Your cart has been saved.')}
        {orderId && <span className="block mt-2 font-mono text-sm">Order #{orderId.slice(0,8)} · {t('pending')}</span>}
      </p>
      <div className="flex gap-3 justify-center pt-4">
        <Link to="/dashboard/cart" className="btn btn-primary">
          {t('Return to Cart')}
        </Link>
        <Link to="/dashboard/marketplace" className="btn bg-bg-tertiary text-text-primary hover:bg-border">
          {t('Browse Marketplace')}
        </Link>
      </div>
    </div>
  );
}
