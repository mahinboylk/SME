import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { insforge } from '@/lib/insforge';
import { notifyCompanyVerified, notifyCompanyRejected } from '@/lib/notifications';
import { track } from '@/lib/analytics';
import { ShieldCheck, Search, Loader2, AlertCircle, CheckCircle, Building, Filter, Clock, X } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import type { Company } from '@/types';

export function VerifyCompanies() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  usePageMeta('Verify Companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Company | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0 });

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      // Stats reflect ALL companies (exact counts), not just the fetched page.
      const [totalRes, pendingRes] = await Promise.all([
        insforge.database.from('companies').select('*', { count: 'exact', head: true }),
        insforge.database
          .from('companies')
          .select('*', { count: 'exact', head: true })
          .eq('is_verified', false),
      ]);
      setStats({ total: totalRes.count ?? 0, pending: pendingRes.count ?? 0 });

      let query = insforge.database
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      // Default: show only unverified companies.
      if (filterStatus === 'pending') query = query.eq('is_verified', false);

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setCompanies(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to load companies.'));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, t]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleVerify = async (company: Company) => {
    if (!profile) return;
    setVerifyingId(company.id);
    setError(null);
    setSuccess(null);

    try {
        const { error: updateError } = await insforge.database
          .from('companies')
          .update({
            is_verified: true,
            verification_status: 'verified',
            verified_at: new Date().toISOString(),
            verified_by: profile.id,
            updated_by: profile.id,
          })
          .eq('id', company.id);

      if (updateError) throw updateError;

      // Log the action
      await insforge.database
        .from('admin_logs')
        .insert([{
          user_id: profile.id,
          action: 'verify_company',
          entity_type: 'company',
          entity_id: company.id,
          new_data: { is_verified: true, verified_at: new Date().toISOString() },
        }]);

      // Notify the company owners (in-app + email)
      await notifyCompanyVerified(company.id, company.name);

      track('company_verified', {
        company_id: company.id,
        company_name: company.name,
      });

      setSuccess(t('company_verified_success', { name: company.name }));
      // Refresh list
      fetchCompanies();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to verify company.'));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleReject = async () => {
    if (!profile || !rejectTarget) return;
    setRejecting(true);
    setError(null);
    setSuccess(null);

    try {
      const reason = rejectionReason.trim();
      const { error: updateError } = await insforge.database
        .from('companies')
        .update({
          verification_status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: profile.id,
          rejection_reason: reason || null,
          updated_by: profile.id,
        })
        .eq('id', rejectTarget.id);

      if (updateError) throw updateError;

      await insforge.database
        .from('admin_logs')
        .insert([{
          user_id: profile.id,
          action: 'reject_company',
          entity_type: 'company',
          entity_id: rejectTarget.id,
          new_data: { verification_status: 'rejected', rejection_reason: reason || null },
        }]);

      await notifyCompanyRejected(rejectTarget.id, rejectTarget.name, reason, profile.email);

      track('company_rejected', {
        company_id: rejectTarget.id,
        company_name: rejectTarget.name,
      });

      setSuccess(t('company_rejected_success', { name: rejectTarget.name }));
      setRejectTarget(null);
      setRejectionReason('');
      fetchCompanies();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to reject company.'));
    } finally {
      setRejecting(false);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.industry || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.country || '').toLowerCase().includes(searchQuery.toLowerCase());

    // 'pending' filtering happens server-side; keep client search only.
    return matchesSearch;
  });

  const pendingCount = stats.pending;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('verify_companies')}</h1>
        <p className="text-text-secondary mt-1">
          {t('Verify registered companies to build trust in the marketplace.')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-tertiary uppercase tracking-wider">{t('Total Companies')}</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-tertiary uppercase tracking-wider">{t('Pending Verification')}</p>
          <p className="text-2xl font-bold text-warning-500 mt-1">{pendingCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-tertiary uppercase tracking-wider">{t('Verified')}</p>
          <p className="text-2xl font-bold text-success-500 mt-1">{stats.total - pendingCount}</p>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Search & Filter */}
      <div className="card p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <input
            type="text"
            placeholder={t('Search by name, industry, or country...')}
            className="input pl-10 py-2.5 bg-bg-tertiary border-transparent focus:bg-bg-secondary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
          className={`btn px-6 ${
            filterStatus === 'pending'
              ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20'
              : 'bg-bg-tertiary text-text-primary hover:bg-border'
          }`}
        >
          <Filter className="w-5 h-5 mr-2" />
          {filterStatus === 'pending' ? t('Pending Only') : t('Show All')}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="card p-12 text-center">
          <Building className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-text-primary">{t('No companies found')}</h3>
          <p className="text-text-secondary mt-1">
            {filterStatus === 'pending' ? t('All companies have been verified!') : t('No companies match your search.')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-tertiary/50">
                   <th className="text-left py-3 px-4 text-text-tertiary font-medium">{t('Company')}</th>
                  <th className="text-left py-3 px-4 text-text-tertiary font-medium hidden md:table-cell">{t('Industry')}</th>
                  <th className="text-left py-3 px-4 text-text-tertiary font-medium hidden lg:table-cell">{t('Country')}</th>
                  <th className="text-left py-3 px-4 text-text-tertiary font-medium">{t('Status')}</th>
                  <th className="text-right py-3 px-4 text-text-tertiary font-medium">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="border-b border-border/50 hover:bg-bg-tertiary/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500 text-xs font-bold shrink-0">
                          {company.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">{company.name}</p>
                           <p className="text-xs text-text-tertiary">{company.registration_number || t('No reg. number')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-text-secondary hidden md:table-cell">
                      {company.industry || '—'}
                    </td>
                    <td className="py-3 px-4 text-text-secondary hidden lg:table-cell">
                      {company.country || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {company.is_verified ? (
                        <span className="badge badge-success text-xs flex items-center gap-1 w-fit">
                           <CheckCircle className="w-3 h-3" /> {t('Verified')}
                         </span>
                       ) : company.verification_status === 'requested' ? (
                         <span className="badge text-xs flex items-center gap-1 w-fit bg-primary-500/10 text-primary-500 border border-primary-500/20">
                           <Clock className="w-3 h-3" /> {t('Requested')}
                         </span>
                       ) : company.verification_status === 'rejected' ? (
                         <span className="badge text-xs flex items-center gap-1 w-fit bg-danger-500/10 text-danger-500 border border-danger-500/20">
                           <X className="w-3 h-3" /> {t('Rejected')}
                         </span>
                       ) : (
                         <span className="badge badge-warning text-xs">{t('Pending')}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!company.is_verified && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerify(company)}
                            disabled={verifyingId === company.id || rejecting}
                            className="btn btn-primary text-xs px-3 py-1.5"
                          >
                            {verifyingId === company.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                 <ShieldCheck className="w-3 h-3 mr-1" />
                                {t('Verify')}
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => { setRejectTarget(company); setRejectionReason(''); }}
                            disabled={verifyingId === company.id || rejecting}
                            className="btn text-xs px-3 py-1.5 bg-danger-500/10 text-danger-500 border border-danger-500/20 hover:bg-danger-500/20"
                          >
                            <X className="w-3 h-3 mr-1" />
                            {t('Reject')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 animate-fade-in-up">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary">{t('Reject Verification')}</h3>
                <p className="text-sm text-text-secondary mt-1">{rejectTarget.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="text-text-tertiary hover:text-text-primary"
                aria-label={t('Dismiss')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('Rejection reason (optional)')}
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder={t('e.g. Registration document is unclear or expired...')}
              className="input w-full bg-bg-tertiary border-transparent focus:bg-bg-secondary resize-none"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="btn bg-bg-tertiary text-text-primary hover:bg-border"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting}
                className="btn bg-danger-500 text-white hover:bg-danger-600"
              >
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
