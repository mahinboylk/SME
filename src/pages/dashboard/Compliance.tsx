import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, FileCheck, Search, Loader2, ExternalLink, Globe, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { insforge } from '@/lib/insforge';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePagination } from '@/hooks/usePagination';

interface ComplianceRequirements {
  docs?: string[];
  [key: string]: unknown;
}

interface ComplianceRule {
  id: string;
  rule_type: string;
  title: string;
  description: string | null;
  requirements: ComplianceRequirements;
  source_url: string;
  country_id: string | null;
  country?: { name: string; iso_code_2: string } | null;
  effective_date?: string | null;
  expiry_date?: string | null;
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function Compliance() {
  const { t } = useTranslation();
  usePageMeta('Compliance Tracking');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const {
    data: rules = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['compliance-rules'],
    queryFn: async () => {
      const { data, error } = await insforge.database
        .from('compliance_rules')
        .select('*, country:countries(name, iso_code_2)')
        .order('effective_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as ComplianceRule[];
    },
  });

  const ruleTypes = Array.from(new Set(rules.map(r => r.rule_type).filter(Boolean))).sort();

  const filteredRules = rules.filter(r => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) ||
      (r.rule_type ?? '').toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || r.rule_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const { pageItems: pageRules, page, totalPages, nextPage, prevPage } = usePagination(filteredRules, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('compliance')} {t('Tracking')}</h1>
          <p className="text-text-secondary mt-1">{t('Stay updated with global trade regulations and requirements.')}</p>
        </div>
      </div>

      {/* Search + Type Filter */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <input
              type="text"
              placeholder={t('Search regulations (e.g., FDA, Organic, ISO)...')}
              className="input pl-10 py-3 bg-bg-tertiary border-transparent focus:bg-bg-secondary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input py-3 bg-bg-tertiary border-transparent focus:bg-bg-secondary sm:w-56"
          >
            <option value="all">{t('All types')}</option>
            {ruleTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rules Grid */}
      {queryError && (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-500">{queryError instanceof Error ? queryError.message : t('Failed to load compliance rules.')}</p>
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="card p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">
            {rules.length === 0 ? t('No compliance regulations found.') : t('No regulations match your search.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pageRules.map((rule) => {
            const countryLabel = rule.country?.name || (rule.country_id ? t('Unknown') : t('Global'));
            const effective = formatDate(rule.effective_date);
            const expiry = formatDate(rule.expiry_date);
            return (
              <div key={rule.id} className="card p-6 border border-border hover:border-primary-500/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center text-success-500">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary">{rule.title}</h3>
                      <div className="flex gap-2 mt-1">
                        <span className="badge badge-primary text-xs">{rule.rule_type}</span>
                        <span className="badge bg-bg-tertiary text-text-secondary text-xs flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {countryLabel}
                        </span>
                      </div>
                      {effective && (
                        <p className="text-xs text-text-tertiary mt-1">
                          {t('Effective:')} {effective}
                          {expiry ? ` · ${t('Expires:')} ${expiry}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                  {rule.description}
                </p>

                <div className="p-3 bg-bg-tertiary rounded-lg mb-4">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileCheck className="w-4 h-4" /> {t('Requirements')}
                  </h4>
                  <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
                    {(rule.requirements?.docs || [t('Standard Documentation')]).map((req: string, i: number) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/50">
                  <a
                    href={rule.source_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-primary-500 hover:text-primary-600 flex items-center gap-1"
                  >
                    {t('Official Source')} <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredRules.length > 0 && (
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
