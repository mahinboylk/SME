import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { insforge } from '@/lib/insforge';
import { Search, Filter, Tag, ArrowRight, Loader2, AlertCircle, ShoppingCart, ChevronLeft, ChevronRight, Plus, Package } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { firstEmbed } from '@/lib/embed';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePagination } from '@/hooks/usePagination';
import { formatPriceInRupees } from '@/lib/utils';
import { useForexRate } from '@/contexts/ForexContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface Listing {
  id: string;
  title: string;
  description: string | null;
  listing_price: number | null;
  currency: string;
  min_order_quantity: number | null;
  status: string;
  views_count: number;
  seller_profile_id: string;
  product?: { name: string; category: string | null } | null;
  seller?: { company: { name: string; country: string; is_verified: boolean } | null } | null;
}

export function Marketplace() {
  const { profile } = useAuth();
  const forexRate = useForexRate();
  const { addItem, totalItems } = useCart();
  usePageMeta('B2B Marketplace');
  const t = useTranslation().t as (key: string, params?: Record<string, string | number>) => string;
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: listings = [], isLoading, error } = useQuery({
    queryKey: ['marketplace-listings'],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error: fetchError } = await insforge.database
        .from('marketplace_listings')
        .select(`
          id, title, description, listing_price, currency, min_order_quantity, status, views_count, seller_profile_id,
          product:product_id(name, category),
          seller:seller_profile_id(company:company_id(name, country, is_verified))
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;
      return (data || []) as unknown as Listing[];
    },
  });

  const { data: mySellerProfile } = useQuery({
    queryKey: ['my-seller-profile', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await insforge.database.from('seller_profiles').select('id').eq('user_id', profile!.id).maybeSingle();
      return data as { id: string } | null;
    },
  });

  const categories = Array.from(
    new Set(listings.map((l) => firstEmbed(l.product)?.category).filter((c): c is string => Boolean(c)))
  );

  const filteredListings = listings.filter((l) => {
    const q = searchQuery.trim().toLowerCase();
    const cat = firstEmbed(l.product)?.category;
    const matchesQuery =
      !q ||
      l.title.toLowerCase().includes(q) ||
      cat?.toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || cat === categoryFilter;
    return matchesQuery && matchesCategory;
  });

  const { pageItems: pageListings, page, totalPages, nextPage, prevPage } = usePagination(filteredListings, 10);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('B2B Marketplace')}</h1>
          <p className="text-text-secondary mt-1">{t('Discover verified products and trusted trading partners.')}</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          {profile?.role === 'buyer' && (
            <>
              <Link to="/dashboard/cart" className="btn bg-bg-tertiary text-text-primary hover:bg-border relative">
                <ShoppingCart className="w-4 h-4 mr-2" />
                {t('Cart')}
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {totalItems}
                  </span>
                )}
              </Link>
              <Link to="/dashboard/orders" className="btn bg-bg-tertiary text-text-primary hover:bg-border">
                <Package className="w-4 h-4 mr-2" />
                {t('Orders')}
              </Link>
            </>
          )}
          {profile?.role === 'sme_owner' && (
            <>
              <Link to="/dashboard/sales" className="btn bg-bg-tertiary text-text-primary hover:bg-border">
                <Package className="w-4 h-4 mr-2" />
                {t('Received Orders')}
              </Link>
              <Link to="/dashboard/marketplace/create" className="btn btn-primary">
                {t('Create New Listing')}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <input
              type="text"
              placeholder={t('Search products, categories, or companies...')}
              className="input pl-10 py-2.5 bg-bg-tertiary border-transparent focus:bg-bg-secondary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`btn px-6 ${showFilters ? 'btn-primary' : 'bg-bg-tertiary text-text-primary hover:bg-border'}`}
          >
            <Filter className="w-5 h-5 mr-2" />
            {t('Filters')}
          </button>
        </div>
        {showFilters && categories.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-text-tertiary">{t('Category:')}</span>
            <select
              className="input py-2 w-56"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">{t('All categories')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {categoryFilter && (
              <button
                type="button"
                onClick={() => setCategoryFilter('')}
                className="text-sm text-primary-500 hover:underline"
              >
                 {t('Clear')}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-500">{error instanceof Error ? error.message : t('Failed to load marketplace listings.')}</p>
        </div>
      )}

      {/* Listings Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {pageListings.map((listing) => (
            <div key={listing.id} className="card overflow-hidden flex flex-col group hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 border border-border hover:border-primary-500/30">
              {/* Product Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-bg-tertiary to-surface-200 dark:from-surface-800 dark:to-surface-900 relative">
                <div className="absolute inset-0 flex items-center justify-center text-text-tertiary">
                  <ShoppingCart className="w-12 h-12 opacity-20" />
                </div>
                {firstEmbed(listing.product)?.category && (
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="badge badge-primary glass-strong text-xs px-2.5 py-1">
                      {firstEmbed(listing.product)!.category}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-text-primary leading-tight group-hover:text-primary-500 transition-colors">
                      {listing.title}
                    </h3>
                  </div>
                  {listing.description && (
                    <p className="text-sm text-text-secondary line-clamp-2 mb-4">
                      {listing.description}
                    </p>
                  )}
                  
                  {firstEmbed(listing.seller)?.company && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded bg-primary-500/20 flex items-center justify-center text-primary-500 text-xs font-bold">
                        {firstEmbed(listing.seller)!.company!.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-text-primary truncate">
                        {firstEmbed(listing.seller)!.company!.name}
                      </span>
                      {firstEmbed(listing.seller)!.company!.is_verified && (
                        <span className="w-1.5 h-1.5 rounded-full bg-success-500 shrink-0" title={t('Verified Seller')} />
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border/50 flex flex-col gap-3 mt-auto">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-text-tertiary mb-1">{t('Price (FOB)')}</p>
                      <p className="text-lg font-bold text-text-primary">
                        {formatPriceInRupees(listing.listing_price, listing.currency, forexRate)}
                      </p>
                    </div>
                     <Link
                       to={`/dashboard/marketplace/${listing.id}`}
                       className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-colors"
                     >
                       <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform" />
                     </Link>
                  </div>
                  {mySellerProfile && listing.seller_profile_id === mySellerProfile.id ? (
                    <button disabled className="btn w-full text-sm py-2 bg-bg-tertiary text-text-tertiary cursor-not-allowed">
                      {t('Your listing')}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        addItem({
                          listingId: listing.id,
                          title: listing.title,
                          description: listing.description,
                          price: listing.listing_price,
                          currency: listing.currency,
                          category: firstEmbed(listing.product)?.category ?? null,
                          sellerName: firstEmbed(listing.seller)?.company?.name ?? null,
                        });
                        toast.success(t('Added to cart'));
                      }}
                      disabled={listing.listing_price == null}
                      className="btn btn-primary w-full text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t('Add to Cart')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredListings.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <Tag className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-medium text-text-primary">{t('No listings found')}</h3>
              <p className="text-text-secondary mt-1">{t('Try adjusting your search criteria.')}</p>
            </div>
          )}
        </div>
      )}

      {filteredListings.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-text-tertiary">
            {t('page_x_of_y', { x: page, y: totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevPage}
              disabled={page <= 1}
              className="w-9 h-9 rounded-xl bg-bg-tertiary text-text-primary flex items-center justify-center hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={t('previous_page')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={nextPage}
              disabled={page >= totalPages}
              className="w-9 h-9 rounded-xl bg-bg-tertiary text-text-primary flex items-center justify-center hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={t('next_page')}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
