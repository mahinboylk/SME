import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/I18nContext';
import { insforge } from '@/lib/insforge';
import { ArrowUpRight, MessageSquare, Building2, Store, CheckCircle2, Clock, AlertCircle, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { track } from '@/lib/analytics';
import { firstEmbed } from '@/lib/embed';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatPriceInRupees } from '@/lib/utils';
import { useForexRate } from '@/contexts/ForexContext';

interface DashboardStat {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: 'primary' | 'success' | 'warning';
}

interface MiniListing {
  id: string;
  title: string;
  description: string | null;
  listing_price: number | null;
  currency: string | null;
  min_order_quantity: number | null;
  views_count: number;
  product?: { category: string | null } | null;
}

interface MiniRoom {
  id: string;
  name: string;
  updated_at: string | null;
}

export function DashboardHome() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  usePageMeta('Dashboard');

  const roleText = profile?.role === 'buyer' ? t('Buyer') : t('Exporter');
  const roleGreeting = profile?.role === 'buyer'
    ? t('Find top suppliers and products')
    : t('Expand your reach to global markets');

  const isBuyer = profile?.role === 'buyer';
  const isSmeOwner = profile?.role === 'sme_owner';
  const forexRate = useForexRate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', profile?.id, profile?.role],
    enabled: !!profile,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
    queryFn: async () => {
      const userId = profile?.id;
      if (!userId) throw new Error('Not authenticated');

      // Company membership + verification status
      let hasCompany = false;
      let companyVerified = false;
      try {
        const { data: member } = await insforge.database
          .from('company_members')
          .select('company_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (member?.company_id) {
          hasCompany = true;
          const { data: comp } = await insforge.database
            .from('companies')
            .select('is_verified')
            .eq('id', member.company_id)
            .maybeSingle();
          companyVerified = !!comp?.is_verified;
        }
      } catch { /* non-fatal */ }

      const buyerMode = profile?.role === 'buyer';

      // Fetch actual listings and count client-side (SDK count:exact is unreliable via InsForge proxy)
      const allListingsQuery = insforge.database
        .from('marketplace_listings')
        .select('id, title, description, listing_price, currency, min_order_quantity, status, views_count, product:product_id(category)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      const myListingsQuery = insforge.database
        .from('marketplace_listings')
        .select('id, title, description, listing_price, currency, min_order_quantity, status, views_count, product:product_id(category)')
        .eq('created_by', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      const [
        { data: allListings },
        { data: myListings },
        { data: myMemberships },
      ] = await Promise.all([
        allListingsQuery,
        myListingsQuery,
        insforge.database
          .from('chat_room_members')
          .select('chat_room_id')
          .eq('user_id', userId),
      ]);
      const conversations = myMemberships?.length ?? 0;

      // Received orders count for exporters only (admins have no RLS access to orders).
      let receivedOrders = 0;
      if (profile?.role === 'sme_owner') {
        try {
          const { data: sellerProfile } = await insforge.database.from('seller_profiles').select('id').eq('user_id', userId).maybeSingle();
          if (sellerProfile) {
            const { data: myListingIds } = await insforge.database.from('marketplace_listings').select('id').eq('seller_profile_id', (sellerProfile as {id:string}).id);
            const ids = ((myListingIds||[]) as Array<{id:string}>).map(r=>r.id);
            if (ids.length > 0) {
              const { data: items } = await insforge.database.from('order_items').select('order_id').in('listing_id', ids);
              const oids = Array.from(new Set(((items||[]) as Array<{order_id:string}>).map(i=>i.order_id)));
              receivedOrders = oids.length;
            }
          }
        } catch { /* non-fatal */ }
      }

      const activeListings = buyerMode ? (allListings?.length ?? 0) : (myListings?.length ?? 0);
      const listingData = buyerMode ? allListings : myListings;

      // Only conversations I belong to — chat_rooms is world-readable by RLS.
      const myRoomIds = Array.from(
        new Set(((myMemberships || []) as Array<{ chat_room_id: string }>).map((m) => m.chat_room_id))
      );
      let roomData: MiniRoom[] | null = null;
      if (myRoomIds.length > 0) {
        const { data: roomsRows } = await insforge.database
          .from('chat_rooms')
          .select('id, name, updated_at')
          .in('id', myRoomIds)
          .order('updated_at', { ascending: false })
          .limit(4);
        roomData = (roomsRows as MiniRoom[]) || null;
      }

      return {
        hasCompany,
        companyVerified,
        activeListings,
        conversations: conversations ?? 0,
        receivedOrders,
        listings: (listingData as unknown as MiniListing[]) || [],
        rooms: roomData || [],
      };
    },
  });

  const queryClient = useQueryClient();
  useEffect(() => {
    if (!profile?.id) return;
    const channel = `rooms:${profile.id}`;
    const onRoomsChange = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', profile.id, profile.role] });
    };
    insforge.realtime.on('new_room', onRoomsChange);
    insforge.realtime.on('room_deleted', onRoomsChange);
    insforge.realtime.subscribe(channel).catch(() => {});
    return () => {
      insforge.realtime.off('new_room', onRoomsChange);
      insforge.realtime.off('room_deleted', onRoomsChange);
      insforge.realtime.unsubscribe(channel);
    };
  }, [profile?.id, profile?.role, queryClient]);

  const hasCompany = data?.hasCompany ?? null;
  const companyVerified = data?.companyVerified ?? false;
  const listings = data?.listings ?? [];
  const rooms = data?.rooms ?? [];

  const stats = useMemo<DashboardStat[]>(() => {
    if (!data) return [];
    const base: DashboardStat[] = [
      { label: t(isBuyer ? 'Available Listings' : 'Active Listings'), value: String(data.activeListings), icon: Store, tone: 'primary' },
      { label: t('Conversations'), value: String(data.conversations), icon: MessageSquare, tone: 'primary' },
      {
        label: t('Company Status'),
        value: !data.hasCompany ? t('Not Set') : data.companyVerified ? t('Verified') : t('Pending'),
        icon: !data.hasCompany ? AlertCircle : data.companyVerified ? CheckCircle2 : Clock,
        tone: !data.hasCompany ? 'warning' : data.companyVerified ? 'success' : 'warning',
      },
    ];
    // Exporters only — admins (super_admin/government_officer) have no orders RLS access.
    if (isSmeOwner && typeof (data as { receivedOrders?: number }).receivedOrders === 'number') {
      base.splice(1, 0, { label: t('Received Orders'), value: String((data as { receivedOrders: number }).receivedOrders), icon: ShoppingCart, tone: 'primary' });
    }
    return base;
  }, [data, t, isBuyer, isSmeOwner]);

  const trackAction = (action: string) => track('recommended_action_click', { action });

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl gradient-primary p-8 md:p-10 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full mix-blend-overlay filter blur-[50px] transform translate-x-1/3 -translate-y-1/3" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {t('welcome_back_x', { x: profile?.full_name?.split(' ')[0] || t('there') })}
          </h1>
          <p className="text-primary-50 text-lg mb-6">
            {t('your_x_dashboard_is_ready_y', { x: roleText, y: roleGreeting })}
          </p>
          <Link
            to="/dashboard/company"
            className="btn bg-white text-primary-700 hover:bg-primary-50 shadow-lg"
          >
            <Building2 className="w-4 h-4" />
            {hasCompany ? t('Manage Company Profile') : t('Complete Company Profile')}
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      {error && (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-500">{error instanceof Error ? error.message : t('Failed to load dashboard.')}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          stats.map((stat, idx) => {
            const tone =
              stat.tone === 'success'
                ? 'text-success-500'
                : stat.tone === 'warning'
                ? 'text-accent-500'
                : 'text-primary-500';
            return (
              <div key={idx} className="card p-6 flex items-start justify-between group">
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-1">{stat.label}</p>
                  <h3 className="text-3xl font-bold text-text-primary mb-2">{stat.value}</h3>
                </div>
                <div className={`bg-primary-500/10 p-3 rounded-xl group-hover:bg-primary-500/20 transition-colors`}>
                  <stat.icon className={`w-6 h-6 ${tone}`} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Received Orders banner — exporters only (admins have no orders RLS access) */}
      {isSmeOwner && (
        <div className="card p-4 flex items-center justify-between bg-gradient-to-r from-primary-500/10 to-transparent border-primary-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{t('Received Orders')}</p>
              <p className="text-xs text-text-secondary">{t('View and manage orders from buyers for your listings')}</p>
            </div>
          </div>
          <Link to="/dashboard/sales" className="btn btn-primary text-sm">
            {t('View Orders')} {typeof data?.receivedOrders === 'number' && data.receivedOrders > 0 ? `(${data.receivedOrders})` : ''}
          </Link>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Real data widgets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Listings — personal for sellers, discovery for buyers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary">{t(isBuyer ? 'Featured Listings' : 'Your Active Listings')}</h2>
              <Link to="/dashboard/marketplace" className="text-sm text-primary-500 hover:underline">
                {t('View all')}
              </Link>
            </div>
            {listings.length === 0 ? (
              <div className="card p-8 text-center">
                <Store className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-50" />
                {isBuyer ? (
                  <>
                    <h3 className="text-lg font-medium text-text-primary">{t('No listings available yet')}</h3>
                    <p className="text-text-secondary mt-1">{t('Explore the marketplace to find products from verified sellers.')}</p>
                    <Link to="/dashboard/marketplace" className="btn btn-primary mt-4">
                      {t('Browse Marketplace')}
                    </Link>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-text-primary">{t('No active listings yet')}</h3>
                    <p className="text-text-secondary mt-1">{t('Create a listing to showcase your products.')}</p>
                    <Link to="/dashboard/marketplace/create" className="btn btn-primary mt-4">
                      {t('Create Listing')}
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {listings.map((l) => (
                  <Link key={l.id} to={`/dashboard/marketplace/${l.id}`} className="card overflow-hidden flex flex-col group hover:shadow-xl hover:shadow-primary-500/5 transition-all border border-border hover:border-primary-500/30">
                    <div className="h-32 bg-gradient-to-br from-bg-tertiary to-surface-200 dark:from-surface-800 dark:to-surface-900 relative">
                      <div className="absolute inset-0 flex items-center justify-center text-text-tertiary">
                        <ShoppingCart className="w-10 h-10 opacity-20" />
                      </div>
                      {firstEmbed(l.product)?.category && (
                        <div className="absolute top-3 left-3">
                          <span className="badge badge-primary glass-strong text-xs px-2.5 py-1">{firstEmbed(l.product)!.category}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-text-primary leading-tight group-hover:text-primary-500 transition-colors line-clamp-1">
                        {l.title}
                      </h3>
                      <p className="text-sm text-text-secondary line-clamp-2 mt-1 mb-3">{l.description}</p>
                      <div className="pt-3 border-t border-border/50 mt-auto">
                        <p className="text-xs text-text-tertiary mb-0.5">{t('Price (FOB)')}</p>
                        <p className="text-lg font-bold text-text-primary">
                          {formatPriceInRupees(l.listing_price, l.currency, forexRate)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Conversations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary">{t('Recent Conversations')}</h2>
              <Link to="/dashboard/messages" className="text-sm text-primary-500 hover:underline">
                {t('Open Messages')}
              </Link>
            </div>
            {rooms.length === 0 ? (
              <div className="card p-8 text-center">
                <MessageSquare className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-medium text-text-primary">{t('No conversations yet')}</h3>
                <p className="text-text-secondary mt-1">{t('Buyers and partners will appear here once you start trading.')}</p>
              </div>
            ) : (
              <div className="card divide-y divide-border">
                {rooms.map((r) => (
                  <Link
                    key={r.id}
                    to="/dashboard/messages"
                    className="p-4 hover:bg-bg-tertiary transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white shrink-0">
                        {(r.name || '?').charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-text-primary group-hover:text-primary-500 transition-colors">{r.name}</h4>
                        <p className="text-xs text-text-tertiary">
                          {r.updated_at ? new Date(r.updated_at).toLocaleDateString() : t('New')}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-text-tertiary group-hover:text-primary-500 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Actions & AI Insights */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">{t('Recommended Actions')}</h2>
          <div className="card divide-y divide-border">
            {!hasCompany && (
              <Link to="/dashboard/company" onClick={() => trackAction('complete_company_profile')} className="p-5 hover:bg-bg-tertiary transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-accent-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  <div>
                    <h4 className="font-semibold text-text-primary mb-1 group-hover:text-primary-500 transition-colors">{t('Complete Company Profile')}</h4>
                    <p className="text-sm text-text-secondary">{t('Add your business details to build trust.')}</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-text-tertiary group-hover:text-primary-500 transition-colors" />
              </Link>
            )}
            {hasCompany && !companyVerified && (
              <div className="p-5 hover:bg-bg-tertiary transition-colors flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-accent-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  <div>
                    <h4 className="font-semibold text-text-primary mb-1 group-hover:text-primary-500 transition-colors">{t('Verify Your Company')}</h4>
                    <p className="text-sm text-text-secondary">{t("Upload your business registration to gain the \"Verified\" badge.")}</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-text-tertiary group-hover:text-primary-500 transition-colors" />
              </div>
            )}
            {!isBuyer && (
              <Link to="/dashboard/intelligence" onClick={() => trackAction('explore_market_intelligence')} className="p-5 hover:bg-bg-tertiary transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(51,139,255,0.6)]" />
                  <div>
                      <h4 className="font-semibold text-text-primary mb-1 group-hover:text-primary-500 transition-colors">{t('Explore Market Intelligence')}</h4>
                      <p className="text-sm text-text-secondary">{t('Discover trending products based on recent WTO trade data.')}</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-text-tertiary group-hover:text-primary-500 transition-colors" />
              </Link>
            )}
          </div>

          {!isBuyer && (
            <>
              <h2 className="text-xl font-bold text-text-primary mb-4 mt-2">{t('AI Market Insights')}</h2>
              <Link to="/dashboard/intelligence" onClick={() => trackAction('ai_market_insights_card')}>
                <div className="card p-6 bg-gradient-to-br from-bg-secondary to-primary-500/5 relative overflow-hidden border-primary-500/20 hover:border-primary-500/40 transition-colors cursor-pointer">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full mix-blend-multiply filter blur-3xl" />
                  <h3 className="text-sm font-bold text-primary-500 uppercase tracking-wider mb-3">{t('Powered by Gemma 4')}</h3>
                  <p className="text-text-primary font-medium mb-4 leading-relaxed">
                    {t('Use AI-powered market intelligence to analyze trends, discover opportunities, and get real-time trade insights.')}
                  </p>
                  <span className="text-primary-600 font-semibold text-sm inline-flex items-center gap-1 hover:gap-2 transition-all">
                    {t('Explore Insights')} <ArrowUpRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
