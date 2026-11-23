import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/I18nContext';
import { insforge } from '@/lib/insforge';
import { notifyAdminsVerificationRequested } from '@/lib/notifications';
import { track } from '@/lib/analytics';
import { compressImage } from '@/lib/image';
import {
  Building, MapPin, Globe, Users, Target, Save, Loader2, AlertCircle,
  Upload, FileText, Image as ImageIcon, X, CheckCircle2, Clock, BadgeCheck, Trash2, Package, Plus,
} from 'lucide-react';
import type { Company, Product } from '@/types';
import { usePageMeta } from '@/hooks/usePageMeta';

const BUCKET = 'company-assets';

export function CompanyProfile() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  usePageMeta('Company Profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [company, setCompany] = useState<Partial<Company>>({
    name: '',
    registration_number: '',
    description: '',
    country: '',
    province: '',
    district: '',
    city: '',
    address: '',
    website: '',
    industry: '',
    employee_count: '',
    phone: '',
    email: '',
    logo_url: '',
    cover_image_url: '',
    annual_revenue: '',
    export_experience_years: null,
  });

  const [countries, setCountries] = useState<Array<{ iso_code: string; name: string }>>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [clearCover, setClearCover] = useState(false);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Products for this company (needed before creating a marketplace listing)
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    description: '',
    unit_price: '',
    currency: 'LKR',
  });
  const [addingProduct, setAddingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [productSuccess, setProductSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadCountries() {
      try {
        const { data } = await insforge.database
          .from('countries')
          .select('iso_code, name')
          .order('name');
        setCountries(data || []);
      } catch {
        /* non-critical */
      }
    }
    loadCountries();
  }, []);

  useEffect(() => {
    async function loadCompany() {
      if (!profile) {
        setLoading(false);
        return;
      }

      try {
        // Resolve company via seller_profiles first (matches CreateListing logic),
        // fallback to company_members (handles detached profiles).
        let companyId: string | null = null;

        const { data: spData } = await insforge.database
          .from('seller_profiles')
          .select('company_id')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (spData?.company_id) {
          companyId = spData.company_id;
        }

        if (!companyId) {
          const { data: memberData } = await insforge.database
            .from('company_members')
            .select('company_id')
            .eq('user_id', profile.id)
            .maybeSingle();
          if (memberData?.company_id) companyId = memberData.company_id;
        }

        if (companyId) {
          const { data: companyData, error: companyError } = await insforge.database
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();

          if (companyError) throw companyError;
            if (companyData) {
              setCompany(companyData as Company);
              if (companyData.logo_url) setLogoPreview(companyData.logo_url);
              if (companyData.cover_image_url) setCoverPreview(companyData.cover_image_url);
              if (companyData.verification_status === 'requested') setRequested(true);
            }
        }
      } catch (err) {
        console.error('Error loading company:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCompany();
  }, [profile]);

  // Load active products for this company
  useEffect(() => {
    if (!company.id) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setProductsLoading(true);
      try {
        const { data, error } = await insforge.database
          .from('products')
          .select('*')
          .eq('company_id', company.id!)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setProducts((data as Product[]) || []);
      } catch (err) {
        console.error('Error loading products:', err);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const handleNewProductChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewProduct((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.id || !profile) {
      setProductError(t('Save your company profile first before adding products.'));
      return;
    }
    if (profile.role !== 'sme_owner' && profile.role !== 'super_admin' && profile.role !== 'government_officer') {
      setProductError(t('Only exporters can add products. As a buyer, you can browse the marketplace.'));
      return;
    }
    if (!newProduct.name.trim()) {
      setProductError(t('Product name is required.'));
      return;
    }
    setAddingProduct(true);
    setProductError(null);
    try {
      const payload = {
        company_id: company.id!,
        name: newProduct.name.trim(),
        category: newProduct.category.trim() || null,
        description: newProduct.description.trim() || null,
        unit_price: newProduct.unit_price ? parseFloat(newProduct.unit_price) : null,
        currency: newProduct.currency,
        is_active: true,
        created_by: profile.id,
      };
      const { data, error } = await insforge.database.from('products').insert([payload]).select().single();
      if (error) throw error;
      if (data) setProducts((prev) => [data as Product, ...prev]);
      setNewProduct({ name: '', category: '', description: '', unit_price: '', currency: 'LKR' });
      setShowAddProduct(false);
      setProductSuccess(t('Product added successfully!'));
      setTimeout(() => setProductSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('row-level security') || msg.includes('42501')) {
        setProductError(t('Only exporters can add products. As a buyer, you can browse the marketplace.'));
      } else {
        setProductError(msg || t('Failed to add product.'));
      }
    } finally {
      setAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await insforge.database.from('products').update({ is_active: false, deleted_at: new Date().toISOString() }).eq('id', productId);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      console.error('Failed to delete product', err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'export_experience_years') {
      setCompany((prev) => ({
        ...prev,
        export_experience_years: value === '' ? null : Number(value),
      }));
      return;
    }
    setCompany((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, {
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.85,
    });
    setLogoFile(compressed);
    setClearLogo(false);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(compressed);
    });
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setClearLogo(true);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.85,
    });
    setCoverFile(compressed);
    setClearCover(false);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(compressed);
    });
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setClearCover(true);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const processed = await Promise.all(
      files.map((f) =>
        f.type.startsWith('image/')
          ? compressImage(f, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 })
          : f,
      ),
    );
    setDocFiles((prev) => [...prev, ...processed]);
  };

  const removeDoc = (idx: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadFile = async (file: File, prefix: string): Promise<{ url: string; key: string }> => {
    const ext = file.name.split('.').pop() || 'bin';
    const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const res = await insforge.storage.from(BUCKET).upload(key, file);
    if (res.error) throw res.error;
    const url =
      res.data?.url ||
      (insforge.storage.from(BUCKET).getPublicUrl(key).data?.publicUrl ?? '');
    return { url, key };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let logoUrl = company.logo_url ?? null;
      let logoKey = company.logo_key ?? null;
      let logoNote: string | null = null;
      let coverNote: string | null = null;
      if (logoFile) {
        try {
          const uploaded = await uploadFile(logoFile, `logos/${company.id || profile.id}`);
          logoUrl = uploaded.url;
          logoKey = uploaded.key;
        } catch (upErr: unknown) {
          logoNote = upErr instanceof Error ? upErr.message : 'Logo upload failed';
        }
      } else if (clearLogo) {
        logoUrl = null;
        logoKey = null;
      }

      let coverUrl = company.cover_image_url ?? null;
      let coverKey = company.cover_key ?? null;
      if (coverFile) {
        try {
          const uploaded = await uploadFile(coverFile, `covers/${company.id || profile.id}`);
          coverUrl = uploaded.url;
          coverKey = uploaded.key;
        } catch (upErr: unknown) {
          coverNote = upErr instanceof Error ? upErr.message : 'Cover image upload failed';
        }
      } else if (clearCover) {
        coverUrl = null;
        coverKey = null;
      }

      const payload = {
        name: company.name,
        registration_number: company.registration_number,
        description: company.description,
        country: company.country,
        province: company.province,
        district: company.district,
        city: company.city,
        address: company.address,
        website: company.website,
        industry: company.industry,
        employee_count: company.employee_count,
        annual_revenue: company.annual_revenue,
        export_experience_years: company.export_experience_years,
        phone: company.phone,
        email: company.email,
        logo_url: logoUrl,
        cover_image_url: coverUrl,
        logo_key: logoKey,
        cover_key: coverKey,
        updated_by: profile.id,
      };

      if (company.id) {
        const { error: updateError } = await insforge.database
          .from('companies')
          .update(payload)
          .eq('id', company.id);
        if (updateError) throw updateError;
        setCompany((prev) => ({
          ...prev,
          logo_url: logoUrl,
          cover_image_url: coverUrl,
          logo_key: logoKey,
          cover_key: coverKey,
        }));
        setSuccess(
          logoNote || coverNote
            ? t('company_profile_updated_logo_note', { note: [logoNote, coverNote].filter(Boolean).join(' ') })
            : t('company_profile_updated_successfully')
        );
      } else {
        const { data: newCompany, error: createError } = await insforge.database
          .from('companies')
          .insert([{ ...payload, created_by: profile.id }])
          .select()
          .single();
        if (createError) throw createError;

        if (newCompany) {
          const { error: linkError } = await insforge.database
            .from('company_members')
            .insert([
              {
                company_id: newCompany.id,
                user_id: profile.id,
                role: 'owner',
                is_primary_contact: true,
                created_by: profile.id,
              },
            ]);
          if (linkError) throw linkError;
          setCompany(newCompany as Company);
          setSuccess(t('company_profile_created_successfully'));
        }
      }
      setLogoFile(null);
      setClearLogo(false);
      setCoverFile(null);
      setClearCover(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failed_to_save_company_profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleRequestVerification = async () => {
    if (!profile || !company.id) return;
    setRequesting(true);
    setRequestError(null);
    setSuccess(null);

    try {
      if (!company.registration_number) {
        throw new Error(t('add_registration_number_before_verification'));
      }

      const docs: string[] = [];
      const docKeys: string[] = [];
      for (const f of docFiles) {
        try {
          const uploaded = await uploadFile(f, `verification/${company.id}`);
          docs.push(uploaded.url);
          docKeys.push(uploaded.key);
        } catch {
          /* skip individual failures */
        }
      }
      if (docFiles.length > 0 && docs.length === 0) {
        throw new Error(t('document_upload_failed'));
      }

      // Record the request on the company (persists across reloads and is visible to admins)
      const { error: vErr } = await insforge.database
        .from('companies')
        .update({
          verification_status: 'requested',
          verification_documents: docs,
          document_keys: docKeys.length > 0 ? docKeys : null,
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
          updated_by: profile.id,
        })
        .eq('id', company.id);
      if (vErr) throw vErr;

      // Alert admins (in-app notification + email)
      await notifyAdminsVerificationRequested(company.name || 'Company', profile.email);

      track('verification_requested', {
        company_id: company.id,
        company_name: company.name,
      });

      setRequested(true);
      setSuccess(t('verification_request_submitted'));
    } catch (err: unknown) {
      setRequestError(err instanceof Error ? err.message : t('failed_to_submit_verification_request'));
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const status: 'verified' | 'requested' | 'pending' | 'rejected' = company.is_verified
    ? 'verified'
    : requested
      ? 'requested'
      : company.verification_status === 'rejected'
        ? 'rejected'
        : 'pending';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('Company Profile')}</h1>
          <p className="text-text-secondary mt-1">{t('Manage your business identity and verification status.')}</p>
        </div>
        {status === 'verified' && (
          <div className="badge badge-success px-3 py-1.5 flex items-center gap-1.5 border border-success-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
            {t('Verified Business')}
          </div>
        )}
{status === 'rejected' && (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <div className="text-sm text-danger-500">
            <p className="font-semibold">{t('Your verification request was rejected.')}</p>
            {company.rejection_reason && (
              <p className="mt-1">
                {t('Reason')}: “{company.rejection_reason}”
              </p>
            )}
            <p className="mt-1">{t('Update your registration documents and submit a new request.')}</p>
          </div>
        </div>
      )}

      {status === 'requested' && (
          <div className="badge px-3 py-1.5 flex items-center gap-1.5 border border-primary-500/30 text-primary-500 bg-primary-500/10">
            <Clock className="w-3.5 h-3.5" />
            {t('Verification Requested')}
          </div>
        )}
        {status === 'rejected' && (
          <div className="badge px-3 py-1.5 flex items-center gap-1.5 border border-danger-500/30 text-danger-500 bg-danger-500/10">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('Rejected')}
          </div>
        )}
        {status === 'pending' && (
          <div className="badge px-3 py-1.5 flex items-center gap-1.5 border border-warning-500/30 text-warning-500 bg-warning-500/10">
            <Clock className="w-3.5 h-3.5" />
            {t('Pending Verification')}
          </div>
        )}
      </div>

      {status === 'requested' && (
        <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-start gap-3">
          <BadgeCheck className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
           <p className="text-sm text-primary-500">
             {t("Your verification request is submitted and under review. We'll notify you once a decision is made.")}
           </p>
        </div>
      )}

      <form onSubmit={handleSave} className="card p-6 md:p-8 space-y-8">
        {error && (
          <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-500">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-success-500/10 border border-success-500/20 rounded-xl flex items-start gap-3">
            <Target className="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
            <p className="text-sm text-success-500">{success}</p>
          </div>
        )}

        {/* Branding */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary-500" />
            {t('Logo')}
          </h3>
          <div className="flex items-center gap-4">
            {logoPreview ? (
               <img src={logoPreview} alt={t('Company logo')} loading="lazy" decoding="async" className="w-16 h-16 rounded-lg object-cover border border-border" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-tertiary">
                <Building className="w-7 h-7" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="logo-input" />
              <label htmlFor="logo-input" className="btn btn-secondary text-sm cursor-pointer">
                <Upload className="w-4 h-4 mr-1.5" />
                {logoPreview ? t('Change Logo') : t('Upload Logo')}
              </label>
              {logoPreview && (
                <button type="button" onClick={handleRemoveLogo} className="btn btn-ghost text-sm text-danger-500">
                  <Trash2 className="w-4 h-4 mr-1.5" />
                   {t('Remove')}
                </button>
              )}
            </div>
          </div>
        </div>

        <hr className="border-border" />

        {/* Cover Image */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary-500" />
            {t('Cover Image')}
          </h3>
          <div className="flex items-center gap-4">
            {coverPreview ? (
               <img src={coverPreview} alt={t('Company cover image')} loading="lazy" decoding="async" className="w-32 h-20 rounded-lg object-cover border border-border" />
            ) : (
              <div className="w-32 h-20 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-tertiary">
                <ImageIcon className="w-7 h-7" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" id="cover-input" />
              <label htmlFor="cover-input" className="btn btn-secondary text-sm cursor-pointer">
                <Upload className="w-4 h-4 mr-1.5" />
                {coverPreview ? t('Change Cover Image') : t('Upload Cover Image')}
              </label>
              {coverPreview && (
                <button type="button" onClick={handleRemoveCover} className="btn btn-ghost text-sm text-danger-500">
                  <Trash2 className="w-4 h-4 mr-1.5" />
                   {t('Remove')}
                </button>
              )}
            </div>
          </div>
        </div>

        <hr className="border-border" />

        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-primary-500" />
            {t('Basic Information')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Company Name *')}</label>
              <input
                type="text"
                name="name"
                required
                value={company.name || ''}
                onChange={handleChange}
                className="input"
                placeholder={t('e.g. Ceylon Spices Pvt Ltd')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Registration Number')}</label>
              <input
                type="text"
                name="registration_number"
                value={company.registration_number || ''}
                onChange={handleChange}
                className="input"
                placeholder={t('e.g. PV 12345')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Country')}</label>
              <select
                name="country"
                value={company.country || ''}
                onChange={handleChange}
                className="input cursor-pointer"
              >
                <option value="">{t('Select country...')}</option>
                {countries.map((c) => (
                  <option key={c.iso_code} value={c.iso_code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Industry')}</label>
              <select
                name="industry"
                value={company.industry || ''}
                onChange={handleChange}
                className="input cursor-pointer"
              >
                <option value="">{t('Select an industry...')}</option>
                <option value="Agriculture & Food">{t('Agriculture & Food')}</option>
                <option value="Apparel & Textiles">{t('Apparel & Textiles')}</option>
                <option value="Manufacturing">{t('Manufacturing')}</option>
                <option value="IT & Services">{t('IT & Services')}</option>
                <option value="Rubber & Plastics">{t('Rubber & Plastics')}</option>
                <option value="Gems & Jewellery">{t('Gems & Jewellery')}</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-text-primary">{t('Description')}</label>
              <textarea
                name="description"
                rows={4}
                value={company.description || ''}
                onChange={handleChange}
                className="input resize-none py-3"
                placeholder={t('Briefly describe your company, products, and manufacturing capabilities...')}
              />
            </div>
          </div>
        </div>

        <hr className="border-border" />

        {/* Location & Contact */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-500" />
            {t('Location & Contact')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-text-primary">{t('Registered Address')}</label>
              <input
                type="text"
                name="address"
                value={company.address || ''}
                onChange={handleChange}
                className="input"
                placeholder={t('Street address, building, etc.')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Province')}</label>
              <input
                type="text"
                name="province"
                value={company.province || ''}
                onChange={handleChange}
                className="input"
                placeholder={t('e.g. Western')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('District')}</label>
              <input
                type="text"
                name="district"
                value={company.district || ''}
                onChange={handleChange}
                className="input"
                placeholder={t('e.g. Colombo')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('City')}</label>
              <input
                type="text"
                name="city"
                value={company.city || ''}
                onChange={handleChange}
                className="input"
                placeholder={t('e.g. Colombo')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Website')}</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="url"
                  name="website"
                  value={company.website || ''}
                  onChange={handleChange}
                  className="input pl-9"
                  placeholder="https://www.example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Phone')}</label>
              <input
                type="tel"
                name="phone"
                value={company.phone || ''}
                onChange={handleChange}
                className="input"
                placeholder="+94 ..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Email')}</label>
              <input
                type="email"
                name="email"
                value={company.email || ''}
                onChange={handleChange}
                className="input"
                placeholder="contact@company.com"
              />
            </div>
          </div>
        </div>

        <hr className="border-border" />

        {/* Business Details */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-500" />
            {t('Business Details')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Employee Count')}</label>
              <select
                name="employee_count"
                value={company.employee_count || ''}
                onChange={handleChange}
                className="input cursor-pointer"
              >
                <option value="">{t('Select size...')}</option>
                <option value="1-10">{t('1 - 10')}</option>
                <option value="11-50">{t('11 - 50')}</option>
                <option value="51-200">{t('51 - 200')}</option>
                <option value="201-500">{t('201 - 500')}</option>
                <option value="500+">{t('500+')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Annual Revenue')}</label>
              <select
                name="annual_revenue"
                value={company.annual_revenue || ''}
                onChange={handleChange}
                className="input cursor-pointer"
              >
                <option value="">{t('Select revenue range...')}</option>
                <option value="Under $100K">Under $100K</option>
                <option value="$100K – $500K">$100K – $500K</option>
                <option value="$500K – $1M">$500K – $1M</option>
                <option value="$1M – $5M">$1M – $5M</option>
                <option value="$5M+">$5M+</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('Export Experience (Years)')}</label>
              <input
                type="number"
                name="export_experience_years"
                min={0}
                value={company.export_experience_years ?? ''}
                onChange={handleChange}
                className="input"
                placeholder={t('e.g. 5')}
              />
            </div>
          </div>
        </div>

        <hr className="border-border" />

        {/* Products — required before you can create marketplace listings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-500" />
              {t('Products')}
            </h3>
            {profile?.role !== 'buyer' && (
              <button
                type="button"
                onClick={() => setShowAddProduct((v) => !v)}
                disabled={!company.id}
                title={!company.id ? t('Save your company profile first') : undefined}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {t('Add Product')}
              </button>
            )}
          </div>
          {profile?.role === 'buyer' ? (
            <p className="text-sm text-text-secondary mb-4">
              {t('As a buyer, you browse products from verified sellers in the marketplace. No need to add products.')}
            </p>
          ) : (
            <p className="text-sm text-text-secondary mb-4">
              {t('Add the products you want to sell. Active products will appear in Create Listing.')}
            </p>
          )}
          {productSuccess && (
            <div className="p-3 mb-4 bg-success-500/10 border border-success-500/20 rounded-lg flex items-center gap-2 text-sm text-success-600">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {productSuccess}
            </div>
          )}
          {profile?.role === 'buyer' ? (
            <div className="card p-6 text-center border-dashed">
              <Package className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-text-primary">{t('Buyer account')}</p>
              <p className="text-sm text-text-secondary mt-1">{t('Browse the marketplace to discover products from verified exporters.')}</p>
            </div>
          ) : !company.id ? (
            <div className="p-4 bg-warning-500/10 border border-warning-500/20 rounded-xl text-sm text-warning-600">
              {t('Save your company profile first before adding products.')}
            </div>
          ) : productsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : products.length === 0 ? (
            <div className="card p-6 text-center border-dashed">
              <Package className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-text-primary">{t('No products yet')}</p>
              <p className="text-sm text-text-secondary mt-1">{t('Click Add Product to create your first product.')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-bg-tertiary rounded-xl border border-border">
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">{p.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {[p.category, p.unit_price != null ? `Rs. ${Number(p.unit_price).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${p.currency || 'LKR'}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {p.description && <p className="text-xs text-text-secondary truncate mt-0.5">{p.description}</p>}
                  </div>
                  <button type="button" onClick={() => handleDeleteProduct(p.id)} className="ml-3 text-text-tertiary hover:text-danger-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddProduct && company.id && profile?.role !== 'buyer' && (
            <div className="card p-4 mt-4 space-y-4 border-primary-500/20">
              <h4 className="font-medium text-text-primary">{t('New Product')}</h4>
              {productError && (
                <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg text-sm text-danger-500">{productError}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-text-primary">{t('Product Name *')}</label>
                  <input name="name" value={newProduct.name} onChange={handleNewProductChange} className="input" placeholder={t('e.g. Premium Ceylon Cinnamon')} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">{t('Category')}</label>
                  <input name="category" value={newProduct.category} onChange={handleNewProductChange} className="input" placeholder={t('e.g. Spices')} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">{t('Unit Price')}</label>
                  <input name="unit_price" type="number" min="0" step="0.01" value={newProduct.unit_price} onChange={handleNewProductChange} className="input" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">{t('Currency')}</label>
                  <select name="currency" value={newProduct.currency} onChange={handleNewProductChange} className="input cursor-pointer">
                    <option value="LKR">LKR (Rs.)</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-text-primary">{t('Description')}</label>
                  <textarea name="description" rows={2} value={newProduct.description} onChange={handleNewProductChange} className="input resize-none py-2" placeholder={t('Brief description')} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddProduct(false)} className="btn btn-ghost">{t('Cancel')}</button>
                <button type="button" onClick={handleAddProduct} disabled={addingProduct} className="btn btn-primary">
                  {addingProduct ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                  {t('Create Product')}
                </button>
              </div>
            </div>
          )}
        </div>

        <hr className="border-border" />

        {/* Verification */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-primary-500" />
            {t('Verification')}
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            {t('Upload supporting documents (e.g. business registration, tax certificate) and submit a request to get your business verified. Verified businesses build more trust with buyers.')}
          </p>

          {requestError && (
            <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
              <p className="text-sm text-danger-500">{requestError}</p>
            </div>
          )}

          <div className="space-y-3">
            <input
              type="file"
              multiple
              onChange={handleDocChange}
              className="hidden"
              id="doc-input"
            />
            <label htmlFor="doc-input" className="btn btn-secondary text-sm cursor-pointer w-fit">
              <FileText className="w-4 h-4 mr-1.5" />
              {t('Add Verification Documents')}
            </label>

            {docFiles.length > 0 && (
              <ul className="space-y-2">
                {docFiles.map((f, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border"
                  >
                    <span className="flex items-center gap-2 text-sm text-text-primary truncate">
                      <FileText className="w-4 h-4 text-text-tertiary shrink-0" />
                      {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDoc(idx)}
                      className="text-text-tertiary hover:text-danger-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!company.is_verified && !requested && (
            <button
              type="button"
              onClick={handleRequestVerification}
              disabled={requesting}
              className="btn btn-primary mt-4"
            >
              {requesting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {t('Request Verification')}
            </button>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
             {t('Save Changes')}
          </button>
        </div>
      </form>
    </div>
  );
}
