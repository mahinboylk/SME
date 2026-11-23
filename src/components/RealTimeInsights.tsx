import { useState, useEffect } from 'react';
import { Cloud, TrendingUp, DollarSign, Globe2, Loader2, Thermometer, Wind } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { formatRupees } from '@/lib/utils';
import { useForex } from '@/contexts/ForexContext';

const getCommodityUrl = () => {
  const raw = import.meta.env.VITE_INSFORGE_PROJECT_ID as string | undefined;
  const appKey = raw ? raw.split('.')[0] : 'xae6z7h6';
  return `https://${appKey}.function2.insforge.app/commodity`;
};

// Map regions to current World Bank regional-aggregate codes for GDP growth (NY.GDP.MKTP.KD.ZG)
const regionToWBCode: Record<string, string> = {
  'East Asia': 'EAS',
  'Southeast Asia': 'EAS',
  'South Asia': 'SAS',
  'Middle East (West Asia)': 'MEA',
  'Central Asia': 'ECS',
  'Sub-Saharan Africa': 'SSF',
  'Western Europe': 'EUU',
  'Eastern Europe': 'ECS',
  'North America': 'NAC',
  'Latin America (South & Central)': 'LCN'
};

export function RealTimeInsights({ targetRegion }: { targetRegion: string }) {
  const { t } = useTranslation();
  const { rate: forexRate, change: forexChange } = useForex();
  // USD/LKR daily moves are often < 0.01%, which rounds to "0.00%" with 2 decimals.
  // Use adaptive precision so genuine micro-moves remain visible.
  const formatPercent = (value: number): string => {
    const abs = Math.abs(value);
    if (abs !== 0 && abs < 0.01) return value.toFixed(4);
    if (abs !== 0 && abs < 0.1) return value.toFixed(3);
    return value.toFixed(2);
  };
  const [weather, setWeather] = useState<{ temp: number, wind: number } | null>(null);
  const [gdp, setGdp] = useState<{ value: number, year: string } | null>(null);
  const [commodity, setCommodity] = useState<{ price: number, change: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchData = async () => {
      const withTimeout = (ms: number, signal?: AbortSignal) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        if (signal) signal.addEventListener('abort', () => ctrl.abort());
        return { ctrl, timer };
      };
      try {
        // 1. Open-Meteo (Colombo Port weather) — live
        const wxCtx = withTimeout(8000);
        const weatherRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=6.9271&longitude=79.8612&current_weather=true', { signal: wxCtx.ctrl.signal }).then(r => r.json()).catch(() => null);
        clearTimeout(wxCtx.timer);

        // 2. World Bank Indicators (GDP Growth) via proxy to bypass CORS
        const isoCode = regionToWBCode[targetRegion] || 'US';
        const gdpCtx = withTimeout(8000);
        const wbRes = await fetch(`/wb-api/v2/country/${isoCode}/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrnev=1`, { signal: gdpCtx.ctrl.signal }).then(r => r.json()).catch(() => null);
        clearTimeout(gdpCtx.timer);

        // 3. Brent Crude Oil via InsForge edge function (works in dev + production)
        const yfCtx = withTimeout(8000);
        interface CommodityMeta {
          regularMarketPrice?: number;
          previousClose?: number;
        }
        interface CommodityResponse {
          chart?: { result?: Array<{ meta?: CommodityMeta }> };
        }
        let yfRes: CommodityResponse | null = await fetch(getCommodityUrl(), { signal: yfCtx.ctrl.signal })
          .then((r) => {
            if (!r.ok) throw new Error(`commodity ${r.status}`);
            return r.json();
          })
          .catch((e) => {
            console.warn('[RealTimeInsights] edge commodity fetch failed', e);
            return null;
          });
        // Fallback via InsForge backend proxy (in case edge subdomain blocked)
        if (!yfRes) {
          yfRes = await fetch('/functions/commodity', { signal: yfCtx.ctrl.signal })
            .then((r) => {
              if (!r.ok) throw new Error(`fallback ${r.status}`);
              return r.json();
            })
            .catch((e) => {
              console.warn('[RealTimeInsights] fallback commodity fetch failed', e);
              return null;
            });
        }
        clearTimeout(yfCtx.timer);

        if (!isMounted) return;

        if (weatherRes?.current_weather) setWeather({ temp: weatherRes.current_weather.temperature, wind: weatherRes.current_weather.windspeed });
        if (wbRes && wbRes[1] && wbRes[1][0] && typeof wbRes[1][0].value === 'number') {
          setGdp({ value: wbRes[1][0].value, year: wbRes[1][0].date });
        }

        if (yfRes?.chart?.result?.[0]?.meta) {
          const meta = yfRes.chart.result[0].meta;
          const current = meta.regularMarketPrice;
          const prev = meta.previousClose;
          const change = typeof current === 'number' && typeof prev === 'number' ? ((current - prev) / prev) * 100 : 0;
          if (typeof current === 'number') setCommodity({ price: current, change });
        }
      } catch (err) {
        console.error("Real-time API error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [targetRegion]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 bg-bg-secondary/40 rounded-2xl border border-white/5 animate-pulse min-h-[120px]">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin mr-3" />
        <span className="text-text-secondary text-sm font-medium">{t('Connecting to global real-time networks...')}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in mb-8">
      {/* Forex Card */}
      <div className="card p-5 bg-gradient-to-br from-bg-secondary to-bg-tertiary/30 border border-white/5 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-primary-500/10 hover:border-primary-500/20">
        <div className="flex items-center gap-2 text-text-tertiary mb-3 text-sm font-medium">
          <div className="p-1.5 rounded-md bg-primary-500/10">
            <DollarSign className="w-4 h-4 text-primary-500" />
          </div>
          {t('Live Forex (USD/LKR)')}
        </div>
        <div className="flex items-end gap-2">
          <div className="text-2xl font-bold text-text-primary tracking-tight">
            {`Rs. ${forexRate.toFixed(2)}`}
          </div>
          <div className={`text-sm font-semibold mb-1 ${forexChange >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
            {forexChange >= 0 ? '+' : ''}{formatPercent(forexChange)}%
          </div>
        </div>
      </div>

      {/* Commodity Card */}
      <div className="card p-5 bg-gradient-to-br from-bg-secondary to-bg-tertiary/30 border border-white/5 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-accent-500/10 hover:border-accent-500/20">
        <div className="flex items-center gap-2 text-text-tertiary mb-3 text-sm font-medium">
          <div className="p-1.5 rounded-md bg-accent-500/10">
            <TrendingUp className="w-4 h-4 text-accent-500" />
          </div>
          {t('Brent Crude Oil')}
        </div>
        <div className="flex items-end gap-2">
          <div className="text-2xl font-bold text-text-primary tracking-tight">
            {commodity ? formatRupees(commodity.price * forexRate) : 'N/A'}
          </div>
          {commodity && (
            <div className={`text-sm font-semibold mb-1 ${commodity.change >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
              {commodity.change >= 0 ? '+' : ''}{commodity.change.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* World Bank GDP */}
      <div className="card p-5 bg-gradient-to-br from-bg-secondary to-bg-tertiary/30 border border-white/5 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-primary-500/10 hover:border-primary-500/20">
        <div className="flex items-center gap-2 text-text-tertiary mb-3 text-sm font-medium">
          <div className="p-1.5 rounded-md bg-primary-500/10">
            <Globe2 className="w-4 h-4 text-primary-500" />
          </div>
          <span className="truncate" title={targetRegion}>{targetRegion} {t('GDP')}</span>
        </div>
        <div className="text-2xl font-bold text-text-primary tracking-tight">
          {gdp ? `${gdp.value.toFixed(2)}%` : 'N/A'}
        </div>
      </div>

      {/* Weather */}
      <div className="card p-5 bg-gradient-to-br from-bg-secondary to-bg-tertiary/30 border border-white/5 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-accent-500/10 hover:border-accent-500/20">
        <div className="flex items-center gap-2 text-text-tertiary mb-3 text-sm font-medium">
          <div className="p-1.5 rounded-md bg-accent-500/10">
            <Cloud className="w-4 h-4 text-accent-500" />
          </div>
          {t('Colombo Port Live')}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-lg font-bold text-text-primary">
            <Thermometer className="w-4 h-4 text-danger-400" />
            {weather ? `${weather.temp}°C` : 'N/A'}
          </div>
          <div className="flex items-center gap-1 text-lg font-bold text-text-primary">
            <Wind className="w-4 h-4 text-primary-400" />
            {weather ? `${weather.wind} km/h` : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}
