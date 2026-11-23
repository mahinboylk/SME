import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { insforge } from '@/lib/insforge';
import { ArrowLeft, Loader2, AlertCircle, Tag, ShoppingCart, MessageSquare, Pencil, Package } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { firstEmbed } from '@/lib/embed';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatPriceInRupees } from '@/lib/utils';
import { useForexRate } from '@/contexts/ForexContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface ListingDetail {
  id: string;
  title: string;
  description: string | null;
  listing_price: number | null;
  currency: string;
  min_order_quantity: number | null;
  status: string;
  views_count: number;
  inquiries_count: number;
  seller_profile_id: string;
  product?: { name: string; category: string | null } | null;
  seller?: { user_id: string; company: { name: string; country: string; is_verified: boolean } | null } | null;
}

export function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const forexRate = useForexRate();
  const { profile } = useAuth();
  const { addItem, totalItems } = useCart();
  const navigate = useNavigate();
  const t = useTranslation().t as (key: string, params?: Record<string, string | number>) => string;
  const [contacting, setContacting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['listing', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error: fetchError } = await insforge.database
        .from('marketplace_listings')
        .select(`
          id, title, description, listing_price, currency, min_order_quantity, status, views_count, inquiries_count, seller_profile_id,
          product:product_id(name, category),
          seller:seller_profile_id(user_id, company:company_id(name, country, is_verified))
        `)
        .eq('id', id!)
        .single();
      if (fetchError) throw fetchError;
      return data as unknown as ListingDetail;
    },
  });
  usePageMeta(listing?.title ? `Listing: ${listing.title}` : 'Listing');

  const sellerUserId = firstEmbed(listing?.seller as unknown as { user_id: string })?.user_id || (listing?.seller as unknown as { user_id?: string })?.user_id;
  const isOwnListing = !!sellerUserId && !!profile && sellerUserId === profile.id;

  const handleContactSeller = async () => {
    if (!profile) {
      navigate('/login');
      return;
    }
    if (!sellerUserId) {
      setContactError(t('Seller information not available.'));
      return;
    }
    if (isOwnListing) {
      return;
    }
    setContacting(true);
    setContactError(null);
    try {
      // Find existing direct room between current user and seller
      const { data: myMemberships } = await insforge.database
        .from('chat_room_members')
        .select('chat_room_id')
        .eq('user_id', profile.id);
      const myRoomIds = Array.from(new Set(((myMemberships || []) as Array<{ chat_room_id: string }>).map((m) => m.chat_room_id)));
      let existingRoomId: string | null = null;
      if (myRoomIds.length > 0) {
        const { data: directRooms } = await insforge.database
          .from('chat_rooms')
          .select('id')
          .in('id', myRoomIds)
          .eq('type', 'direct');
        if (directRooms && directRooms.length > 0) {
          const candidateIds = (directRooms as Array<{ id: string }>).map((r) => r.id);
          for (const roomId of candidateIds) {
            const { data: members } = await insforge.database
              .from('chat_room_members')
              .select('user_id')
              .eq('chat_room_id', roomId);
            const memberIds = ((members || []) as Array<{ user_id: string }>).map((m) => m.user_id);
            if (memberIds.includes(sellerUserId) && memberIds.includes(profile.id)) {
              existingRoomId = roomId;
              break;
            }
          }
        }
      }
      if (existingRoomId) {
        navigate(`/dashboard/messages?room=${existingRoomId}`);
        return;
      }
      const sellerCompanyName = firstEmbed(listing?.seller as unknown as { company: { name: string } })?.company?.name || listing?.title || 'Chat';
      const roomName = sellerCompanyName;
      const { data: newRoom, error: roomErr } = await insforge.database
        .from('chat_rooms')
        .insert([{ name: roomName, type: 'direct', created_by: profile.id }])
        .select()
        .single();
      if (roomErr) throw roomErr;
      const roomId = (newRoom as { id: string }).id;
      const { error: memErr } = await insforge.database.from('chat_room_members').insert([
        { chat_room_id: roomId, user_id: profile.id },
        { chat_room_id: roomId, user_id: sellerUserId },
      ]);
      if (memErr) throw memErr;
      navigate(`/dashboard/messages?room=${roomId}`);
    } catch (err: unknown) {
      setContactError(err instanceof Error ? err.message : t('Failed to start conversation.'));
    } finally {
      setContacting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <Link to="/dashboard/marketplace" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary-500 text-sm">
          <ArrowLeft className="w-4 h-4" /> {t('Back to Marketplace')}
        </Link>
        {profile?.role === 'buyer' && (
          <div className="flex items-center gap-2">
            <Link to="/dashboard/cart" className="btn bg-bg-tertiary text-text-primary hover:bg-border text-sm py-1.5 relative">
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              {t('Cart')}
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {totalItems}
                </span>
              )}
            </Link>
            <Link to="/dashboard/orders" className="btn bg-bg-tertiary text-text-primary hover:bg-border text-sm py-1.5">
              <Package className="w-4 h-4 mr-1.5" />
              {t('Orders')}
            </Link>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-500">{error instanceof Error ? error.message : t('Failed to load listing.')}</p>
        </div>
      ) : !listing ? (
        <div className="text-center py-12">
          <Tag className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-text-primary">{t('Listing not found')}</h3>
        </div>
      ) : (
        <div className="card p-6 md:p-8">
          <div className="h-56 bg-gradient-to-br from-bg-tertiary to-surface-200 dark:from-surface-800 dark:to-surface-900 rounded-xl relative mb-6 flex items-center justify-center">
            <ShoppingCart className="w-16 h-16 opacity-20 text-text-tertiary" />
            {firstEmbed(listing.product)?.category && (
              <span className="badge badge-primary glass-strong text-xs px-2.5 py-1 absolute top-3 left-3">
                {firstEmbed(listing.product)!.category}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-text-primary">{listing.title}</h1>

          {firstEmbed(listing.seller)?.company && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-7 h-7 rounded bg-primary-500/20 flex items-center justify-center text-primary-500 text-xs font-bold">
                {firstEmbed(listing.seller)!.company!.name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-text-primary">{firstEmbed(listing.seller)!.company!.name}</span>
              {firstEmbed(listing.seller)!.company!.is_verified && (
                <span className="w-1.5 h-1.5 rounded-full bg-success-500" title={t('Verified Seller')} />
              )}
              {firstEmbed(listing.seller)!.company!.country && (
                <span className="text-xs text-text-tertiary">· {firstEmbed(listing.seller)!.company!.country}</span>
              )}
            </div>
          )}

          <div className="mt-6">
            <p className="text-xs text-text-tertiary mb-1">{t('Price (FOB)')}</p>
            <p className="text-2xl font-bold text-text-primary">
              {formatPriceInRupees(listing.listing_price, listing.currency, forexRate)}
            </p>
          </div>

          {listing.description && (
            <div className="mt-6 pt-6 border-t border-border/50">
              <h3 className="font-semibold text-text-primary mb-2">{t('Description')}</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{listing.description}</p>
            </div>
          )}

          {contactError && (
            <div className="mt-4 p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-danger-500 shrink-0 mt-0.5" />
              <p className="text-sm text-danger-500">{contactError}</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {!isOwnListing && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!listing) return;
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
                  className="btn btn-primary disabled:opacity-50"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t('Add to Cart')}
                </button>
                <button type="button" onClick={handleContactSeller} disabled={contacting} className="btn bg-bg-tertiary text-text-primary hover:bg-border">
                  {contacting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                  {t('Contact Seller')}
                </button>
              </>
            )}
            {isOwnListing && (
              <Link to={`/dashboard/marketplace/${id}/edit`} className="btn btn-primary">
                <Pencil className="w-4 h-4 mr-2" />
                {t('Edit Listing')}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
