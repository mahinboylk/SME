import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { insforge } from '@/lib/insforge';
import { track } from '@/lib/analytics';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import type { Product } from '@/types';

interface SellerProfile {
  id: string;
  user_id: string;
  company_id: string | null;
}

export function CreateListing() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  usePageMeta(isEdit ? 'Edit Listing' : 'Create Listing');
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);

  const [formData, setFormData] = useState({
    product_id: '',
    title: '',
    description: '',
    listing_price: '',
    currency: 'LKR',
  });

  const loadData = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Look up seller profile
      const { data: spData, error: spError } = await insforge.database
        .from('seller_profiles')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (spError) throw spError;

      if (spData) {
        setSellerProfile(spData as SellerProfile);

        // Resolve company via seller_profile first, fallback to company_members (handles detached profiles)
        let companyId: string | null = spData.company_id ?? null;
        if (!companyId) {
          try {
            const { data: member } = await insforge.database
              .from('company_members')
              .select('company_id')
              .eq('user_id', profile.id)
              .maybeSingle();
            if (member?.company_id) companyId = member.company_id;
          } catch {
            // ignore
          }
        }

        // If user belongs to multiple companies, collect all ids as fallback
        let companyIds: string[] = [];
        if (companyId) companyIds = [companyId];
        if (companyIds.length === 0) {
          try {
            const { data: members } = await insforge.database
              .from('company_members')
              .select('company_id')
              .eq('user_id', profile.id);
            companyIds = Array.from(
              new Set(((members || []) as Array<{ company_id: string }>).map((m) => m.company_id).filter(Boolean))
            );
          } catch {
            // ignore
          }
        }

        if (companyIds.length > 0) {
          const { data: prodData, error: prodError } = await insforge.database
            .from('products')
            .select('*')
            .in('company_id', companyIds)
            .eq('is_active', true)
            .order('name', { ascending: true });

          if (prodError) throw prodError;
          setProducts((prodData as Product[]) || []);
        } else {
          setProducts([]);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failed_to_load_data'));
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tracks which listing id the edit-prefill has already run for. The effect
  // below both reads and writes the shared `loading` state, so without this
  // guard every fetch completion would retrigger another fetch (infinite
  // refetch loop where the spinner never settles).
  const editFetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isEdit || !editId) return;
    // Wait for auth to resolve first: with profile still null, loadData bails
    // out early and sellerProfile is null for reasons unrelated to access.
    if (!profile) return;
    // Wait for the seller profile to load: checking ownership against a
    // still-null profile would skip the gate and pre-fill another
    // seller's data into the form.
    if (loading) return;
    if (editFetchedFor.current === editId) return;
    if (!sellerProfile) {
      setError(t('no_seller_profile_found'));
      return;
    }
    editFetchedFor.current = editId;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await insforge.database
          .from('marketplace_listings')
          .select('id, product_id, title, description, listing_price, currency, seller_profile_id')
          .eq('id', editId)
          .single();
        if (error) throw error;
        const row = data as unknown as { product_id: string; title: string; description: string | null; listing_price: number | null; currency: string | null; seller_profile_id: string };
        // Verify ownership via seller_profile
        if (row.seller_profile_id !== sellerProfile.id) {
          setError(t('not_authorized_to_edit'));
          return;
        }
        setFormData({
          product_id: row.product_id || '',
          title: row.title || '',
          description: row.description || '',
          listing_price: row.listing_price != null ? String(row.listing_price) : '',
          currency: row.currency || 'LKR',
        });
        // Ensure the listing's current product is selectable: products are
        // loaded for the seller's active company products only, so an
        // inactive/legacy product would otherwise leave the required select
        // with no matching option and silently block form submission.
        if (row.product_id) {
          const { data: prod } = await insforge.database
            .from('products')
            .select('*')
            .eq('id', row.product_id)
            .maybeSingle();
          if (prod) {
            const p = prod as Product;
            setProducts((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('failed_to_load_listing'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, editId, profile, sellerProfile, loading, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerProfile) {
      setError(t('no_seller_profile_found'));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (isEdit && editId) {
        const { data: updated, error: updateError } = await insforge.database
          .from('marketplace_listings')
          .update({
            product_id: formData.product_id,
            title: formData.title,
            description: formData.description || null,
            listing_price: formData.listing_price ? parseFloat(formData.listing_price) : null,
            currency: formData.currency,
          })
          .eq('id', editId)
          .eq('seller_profile_id', sellerProfile.id)
          .select('id');

        if (updateError) throw updateError;
        // PostgREST returns zero rows (not an error) when RLS filters the
        // update out — surface that instead of a false success toast.
        if (!updated || (updated as unknown[]).length === 0) {
          throw new Error('Update did not save — listing not found or permission denied.');
        }

        track('listing_updated', {
          title: formData.title,
          price: formData.listing_price,
          currency: formData.currency,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
          queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] }),
        ]);

        setSuccess(t('listing_updated_successfully'));

        await new Promise((resolve) => setTimeout(resolve, 1500));
        window.location.href = `/dashboard/marketplace/${editId}`;
        return;
      }

      const { error: insertError } = await insforge.database
        .from('marketplace_listings')
        .insert([{
          seller_profile_id: sellerProfile.id,
          product_id: formData.product_id,
          title: formData.title,
          description: formData.description || null,
          listing_price: formData.listing_price ? parseFloat(formData.listing_price) : null,
          currency: formData.currency,
          status: 'active',
          created_by: profile?.id || null,
        }]);

      if (insertError) throw insertError;

      track('listing_created', {
        title: formData.title,
        price: formData.listing_price,
        currency: formData.currency,
      });

      // Ensure dashboard Active/Available counts update immediately for seller and buyers
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] }),
      ]);

      setSuccess(t('listing_created_successfully'));

      // Reload page after short delay to guarantee fresh data
      await new Promise((resolve) => setTimeout(resolve, 1500));
      window.location.href = '/dashboard/marketplace';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failed_to_create_listing'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{isEdit ? t('Edit Listing') : t('create_listing')}</h1>
        <p className="text-text-secondary mt-1">
          {isEdit ? t('Update your marketplace listing.') : t('Create a new marketplace listing for your products.')}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-500">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-success-500/10 border border-success-500/20 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
          <p className="text-sm text-success-500">{success}</p>
        </div>
      )}

      {!sellerProfile ? (
        <div className="card p-8 text-center">
          <Package className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-text-primary">{t('Seller Profile Required')}</h3>
          <p className="text-text-secondary mt-2">
            {t('You need to have a seller profile and company to create listings. Please complete your company profile first.')}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-8">
          {/* Product Selection */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-500" />
              {t('Product')}
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Select Product *')}</label>
              <select
                name="product_id"
                value={formData.product_id}
                onChange={handleChange}
                className="input cursor-pointer"
                required
              >
                <option value="">{t('Choose a product...')}</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.category ? `(${product.category})` : ''}
                  </option>
                ))}
              </select>
              {products.length === 0 && (
                <div className="p-3 bg-warning-500/10 border border-warning-500/20 rounded-lg flex items-center justify-between gap-3">
                  <p className="text-sm text-warning-600">{t('No products available for this company.')}</p>
                  <Link to="/dashboard/company" className="text-sm font-medium text-primary-600 hover:underline shrink-0">
                    {t('Go to Company Profile')}
                  </Link>
                </div>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Listing Details */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              {t('Listing Details')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-text-primary">{t('Title *')}</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="input"
                  placeholder={t('e.g. Premium Ceylon Cinnamon Sticks — Grade Alba')}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-text-primary">{t('Description')}</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="input resize-none py-3"
                  placeholder={t('Describe your listing — quality, packaging, certifications, unique selling points...')}
                />
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Pricing & Terms */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              {t('Pricing & Order Terms')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">{t('Listing Price (FOB)')}</label>
                <input
                  type="number"
                  name="listing_price"
                  value={formData.listing_price}
                  onChange={handleChange}
                  className="input"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">{t('Currency')}</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="input cursor-pointer"
                >
                  <option value="LKR">LKR (Rs.)</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving || !formData.product_id || !formData.title}
              className="btn btn-primary"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEdit ? t('Update Listing') : t('Create Listing')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
