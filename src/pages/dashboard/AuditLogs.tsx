import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { insforge } from '@/lib/insforge';
import { FileText, Search, Loader2, ChevronDown, ChevronUp, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePagination } from '@/hooks/usePagination';
import type { AdminLog } from '@/types';

export function AuditLogs() {
  const { t } = useTranslation();
  usePageMeta('Audit Logs');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const { data, error: fetchError } = await insforge.database
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      return (data as AdminLog[]) || [];
    },
  });

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entity_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entity_id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterAction === 'all' || log.action === filterAction;

    return matchesSearch && matchesFilter;
  });

  const actionTypes = [...new Set(logs.map(l => l.action))];

  const {
    page,
    totalPages,
    pageItems,
    nextPage,
    prevPage,
  } = usePagination(filteredLogs, 10);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('create') || action.includes('verify')) return 'badge-success';
    if (action.includes('update') || action.includes('edit')) return 'badge-warning';
    if (action.includes('delete') || action.includes('remove')) return 'badge-danger';
    return 'badge-primary';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('audit_logs')}</h1>
        <p className="text-text-secondary mt-1">
          {t('System audit trail of administrative actions.')}
        </p>
      </div>

      {/* Search & Filter */}
      <div className="card p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <input
            type="text"
            placeholder={t('Search by action, entity type, or ID...')}
            className="input pl-10 py-2.5 bg-bg-tertiary border-transparent focus:bg-bg-secondary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="input pl-9 pr-8 py-2.5 bg-bg-tertiary border-transparent focus:bg-bg-secondary cursor-pointer appearance-none"
          >
            <option value="all">{t('All Actions')}</option>
            {actionTypes.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl">
          <p className="text-sm text-danger-500">{error instanceof Error ? error.message : t('Failed to load audit logs.')}</p>
        </div>
      )}

      {/* Logs Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-text-primary">{t('No audit logs found')}</h3>
          <p className="text-text-secondary mt-1">
            {searchQuery || filterAction !== 'all' ? t('Try adjusting your filters.') : t('No administrative actions recorded yet.')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-tertiary/50">
                  <th className="text-left py-3 px-4 text-text-tertiary font-medium">{t('Timestamp')}</th>
                  <th className="text-left py-3 px-4 text-text-tertiary font-medium">{t('Action')}</th>
                  <th className="text-left py-3 px-4 text-text-tertiary font-medium hidden md:table-cell">{t('Entity')}</th>
                  <th className="text-left py-3 px-4 text-text-tertiary font-medium hidden lg:table-cell">{t('User ID')}</th>
                  <th className="text-right py-3 px-4 text-text-tertiary font-medium">{t('Details')}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((log) => (
                  expandedId === log.id ? (
                    <tr key={log.id} className="border-b border-border/50">
                      <td colSpan={5} className="p-0">
                        <div className="bg-bg-tertiary/30 px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                               <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">{t('Old Data')}</p>
                              <pre className="text-xs text-text-secondary bg-bg rounded-lg p-3 overflow-x-auto max-h-40">
                                {log.old_data ? JSON.stringify(log.old_data, null, 2) : '—'}
                              </pre>
                            </div>
                            <div>
                               <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">{t('New Data')}</p>
                              <pre className="text-xs text-text-secondary bg-bg rounded-lg p-3 overflow-x-auto max-h-40">
                                {log.new_data ? JSON.stringify(log.new_data, null, 2) : '—'}
                              </pre>
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedId(null)}
                            className="text-xs text-primary-500 mt-2 flex items-center gap-1"
                          >
                             <ChevronUp className="w-3 h-3" /> {t('Collapse')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-bg-tertiary/50">
                      <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${getActionBadgeColor(log.action)} text-xs`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-secondary hidden md:table-cell">
                        {log.entity_type || '—'}
                        {log.entity_id && (
                          <span className="text-text-tertiary ml-1 text-xs">
                            ({log.entity_id.slice(0, 8)}...)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-text-tertiary hidden lg:table-cell text-xs">
                        {log.user_id ? log.user_id.slice(0, 8) + '...' : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setExpandedId(log.id)}
                          className="text-xs text-primary-500 flex items-center gap-1 ml-auto"
                        >
                           {t('View')} <ChevronDown className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      {!isLoading && filteredLogs.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevPage}
              disabled={page <= 1}
              aria-label={t('Previous page')}
              className="w-9 h-9 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-primary hover:bg-border disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-text-secondary">
              {t('page_x_of_y', { x: String(page), y: String(totalPages) })}
            </span>
            <button
              type="button"
              onClick={nextPage}
              disabled={page >= totalPages}
              aria-label={t('Next page')}
              className="w-9 h-9 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-primary hover:bg-border disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-text-tertiary text-center">
            {t('showing_x_of_y_logs', { x: String(pageItems.length), y: String(logs.length) })}
          </p>
        </div>
      )}
    </div>
  );
}
