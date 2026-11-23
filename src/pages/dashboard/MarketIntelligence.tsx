import { useState } from 'react';
import { Search, Lightbulb, Loader2, AlertCircle, BarChart3, TrendingUp, DollarSign } from 'lucide-react';
import { generateMarketInsights } from '@/lib/ai-insights';
import { RealTimeInsights } from '@/components/RealTimeInsights';
import { fetchTariffData, type WTOTariffData } from '@/lib/wto-api';
import { fetchWITSTradeData, type WITSTradeData } from '@/lib/wits-api';
import { insforge } from '@/lib/insforge';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatTradeValueInRupees } from '@/lib/utils';
import { useForexRate } from '@/contexts/ForexContext';

export function MarketIntelligence() {
  const t = useTranslation().t as (key: string, params?: Record<string, string | number>) => string;
  const forexRate = useForexRate();
  usePageMeta('Market Intelligence');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('Central Asia');
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [tariffData, setTariffData] = useState<WTOTariffData[] | null>(null);
  const [tradeData, setTradeData] = useState<WITSTradeData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTradeData, setShowTradeData] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setError(null);
    setInsight(null);
    setTariffData(null);
    setTradeData(null);
    setShowTradeData(false);

    try {
      const { data: { user } } = await insforge.auth.getCurrentUser();
      if (user) {
        try {
          await insforge.database.from('search_history').insert([{
            user_id: user.id,
            query,
            search_type: 'market_intelligence',
            filters: { region },
          }]);
        } catch {
          /* best-effort: don't block the search on history write failures */
        }
      }

      const aiResponse = await generateMarketInsights(query, region)
        .then(r => ({ result: r, error: null as string | null }))
        .catch((e: unknown) => ({ result: null as string | null, error: e instanceof Error ? e.message : String(e) }));

      if (aiResponse.result) {
        setInsight(aiResponse.result);
      } else if (aiResponse.error) {
        console.error('AI insight error:', aiResponse.error);
        setError(t('ai_api_error_x', { x: aiResponse.error }));
      }

      const [tariffs, witsTrade] = await Promise.all([
        fetchTariffData(query || 'ALL', 'LKA', region),
        fetchWITSTradeData('LKA', region, query),
      ]);

      const tradeFlows = witsTrade.map((flow) => ({ ...flow, source: 'WITS' as const }));

      if (tariffs.length > 0 || tradeFlows.length > 0) {
        setShowTradeData(true);
        setTariffData(tariffs.length > 0 ? tariffs : null);
        setTradeData(tradeFlows.length > 0 ? tradeFlows : null);
      }

      if (!aiResponse.result && !aiResponse.error) {
        setError(t('AI insights unavailable — showing trade data only.'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('An error occurred while fetching market intelligence.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('Market Intelligence')}</h1>
          <p className="text-text-secondary mt-1">{t('AI-powered insights and global trade data via Google AI, WTO & WITS.')}</p>
        </div>
      </div>

      <RealTimeInsights targetRegion={region} />

      <div className="card p-6 gradient-border">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <input
              type="text"
              placeholder={t('e.g., Organic Ceylon Cinnamon, Coir Products, Apparel...')}
              className="input pl-10 py-3 text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
            />
          </div>
          <select
            className="input md:w-64 py-3 text-base cursor-pointer"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="Central Asia">{t('Central Asia')}</option>
            <option value="East Asia">{t('East Asia')}</option>
            <option value="Eastern Europe">{t('Eastern Europe')}</option>
            <option value="Latin America (South & Central)">{t('Latin America (South & Central)')}</option>
            <option value="Middle East (West Asia)">{t('Middle East (West Asia)')}</option>
            <option value="North America">{t('North America')}</option>
            <option value="South Asia">{t('South Asia')}</option>
            <option value="Southeast Asia">{t('Southeast Asia')}</option>
            <option value="Sub-Saharan Africa">{t('Sub-Saharan Africa')}</option>
            <option value="Western Europe">{t('Western Europe')}</option>
          </select>
          <button
            type="submit"
            disabled={loading || !query}
            className="btn btn-primary py-3 px-8 text-base shadow-lg shadow-primary-500/20 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('Analyze Market')}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-500">{error}</p>
        </div>
      )}

      {(insight || loading) && (
        <div className="animate-fade-in">
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent-500" />
              {t('Google AI Analysis')}
            </h2>
            <div className="card p-8 min-h-[300px] relative overflow-hidden bg-gradient-to-br from-bg-secondary via-bg-secondary to-primary-900/10 border border-white/5 shadow-2xl">
              {loading && !insight ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-secondary/60 backdrop-blur-md z-10">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-24 h-24 border-4 border-primary-500/10 rounded-full"></div>
                    <div className="absolute w-24 h-24 border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
                    <Lightbulb className="w-8 h-8 text-primary-500 animate-pulse" />
                  </div>
                  <p className="mt-8 text-base font-medium text-primary-400 animate-pulse tracking-wide">{t('Synthesizing global market data...')}</p>
                </div>
              ) : (
                <div className="prose prose-base dark:prose-invert max-w-none relative z-10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -z-10 pointer-events-none mix-blend-screen"></div>
                  {insight?.split('\n').map((paragraph, idx) => (
                    <p key={idx} className="text-text-secondary leading-relaxed mb-5 text-lg font-light tracking-wide first:text-xl first:font-medium first:text-text-primary">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTradeData && !loading && (
        <div className="animate-fade-in space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            {t('Market Data')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tariffData && tariffData.length > 0 && (
              <div className="card p-6 bg-gradient-to-br from-bg-secondary to-bg-tertiary/20 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border border-white/5">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-accent-500/10">
                    <TrendingUp className="w-5 h-5 text-accent-500" />
                  </div>
                  {t('Applied Tariff Rates')}
                </h3>
                <div className="space-y-3 pb-2">
                  {tariffData.map((tariff, i) => (
                    <div key={i} className="group flex justify-between items-center py-3 px-4 rounded-xl bg-bg-tertiary/40 hover:bg-bg-tertiary transition-colors border border-transparent hover:border-accent-500/20">
                      <span className="text-sm text-text-primary font-medium">{tariff.partner}</span>
                      <span className="text-lg font-bold text-accent-500 group-hover:scale-110 transition-transform">{tariff.dutyRate != null ? `${tariff.dutyRate}%${tariff.live ? '' : ' est.'}` : 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tradeData && tradeData.length > 0 && (
              <div className="card p-6 bg-gradient-to-br from-bg-secondary to-bg-tertiary/20 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border border-white/5">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-success-500/10">
                    <DollarSign className="w-5 h-5 text-success-500" />
                  </div>
                  {t('Trade Volume (LKR)')} <span className="text-sm font-normal text-text-secondary ml-2 capitalize truncate max-w-[200px]">{t('trade_volume_for_x', { x: query || t('all_products') })}</span>
                </h3>
                <div className="space-y-3 pb-2">
                  {tradeData.slice(0, 5).map((trade, i) => (
                    <div key={i} className="group flex justify-between items-center py-3 px-4 rounded-xl bg-bg-tertiary/40 hover:bg-bg-tertiary transition-colors border border-transparent hover:border-success-500/20">
                      <div>
                        <span className="text-sm text-text-primary font-medium">{trade.partner}</span>
                        <span className={`text-xs ml-2 px-2 py-1 rounded-md font-medium uppercase tracking-wider ${trade.tradeFlow === 'export' ? 'bg-success-500/10 text-success-500' : 'bg-primary-500/10 text-primary-500'}`}>
                          {trade.tradeFlow}
                        </span>
                      </div>
                      <span className="text-base font-bold text-text-primary group-hover:text-success-400 transition-colors">
                        {formatTradeValueInRupees(trade.tradeValue, forexRate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-text-tertiary mt-4 leading-relaxed">
            {t("Tariff rates show each partner's economy-wide average applied MFN tariff (live from WTO when available, otherwise an indicative estimate). Actual product-specific tariffs vary by HS code. Trade volumes are live from UN Comtrade. Preference schemes shown are indicative.")}
          </p>
        </div>
      )}
    </div>
  );
}
