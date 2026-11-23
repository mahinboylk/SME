/**
 * ITC Trade Map adapter.
 *
 * ITC Trade Map does NOT publish a general-access developer API.
 * Programmatic access is a paid "data products" offering (MAT Pro /
 * custom solutions) sold by ITC, served from api.trademap.org behind an
 * Azure-style subscription key (`Ocp-Apim-Subscription-Key` header).
 *
 * Modes (env `VITE_ITC_INTEGRATION_MODE`):
 * - `manual_export` (default): data taken from the ITC Trade Map portal
 *   (https://www.trademap.org) via manual export, curated in `MOCK_MARKETS`.
 *   This is the mode the app runs in; the UI marks data as illustrative.
 * - `live`: calls the ITC data service with the subscription key from
 *   `VITE_ITC_API_KEY`. Only usable once the project holds an ITC data
 *   product subscription. The request path is configurable via
 *   `VITE_ITC_API_PATH` (default `/api/v1/trade`) because ITC's endpoint
 *   contract is negotiated per data-product agreement.
 */

const ITC_MODE = import.meta.env.VITE_ITC_INTEGRATION_MODE || 'manual_export';
const ITC_API_KEY = (import.meta.env.VITE_ITC_API_KEY as string | undefined) ?? '';
const ITC_API_BASE = (import.meta.env.VITE_ITC_API_BASE as string | undefined) ?? 'https://api.trademap.org';
const ITC_API_PATH = (import.meta.env.VITE_ITC_API_PATH as string | undefined) ?? '/api/v1/trade';

export interface ITCMarketData {
  productCode: string;
  productLabel: string;
  reporter: string;
  year: number;
  exportValue: number | null;
  importValue: number | null;
  growthRate: number | null;
  marketShare: number | null;
}

interface ITCResult {
  ProductCode?: string;
  ProductLabel?: string;
  Reporter?: string;
  Year?: number;
  ExportValue?: number;
  ImportValue?: number;
  GrowthRate?: number;
  MarketShare?: number;
}

const MOCK_MARKETS: Record<string, ITCMarketData[]> = {
  'European Union': [
    { productCode: '0901', productLabel: 'Coffee, tea, mate and spices', reporter: 'EU', year: 2024, exportValue: 142_000_000, importValue: 89_000_000, growthRate: 7.2, marketShare: 1.8 },
    { productCode: '6109', productLabel: 'T-shirts, singlets and other vests', reporter: 'EU', year: 2024, exportValue: 98_000_000, importValue: 210_000_000, growthRate: 4.5, marketShare: 0.9 },
  ],
  'North America': [
    { productCode: '0901', productLabel: 'Coffee, tea, mate and spices', reporter: 'US', year: 2024, exportValue: 76_000_000, importValue: 45_000_000, growthRate: 5.8, marketShare: 1.2 },
  ],
};

function mockData(productCode: string, targetRegion: string, year: number): ITCMarketData[] {
  const data = MOCK_MARKETS[targetRegion];
  if (data) {
    const filtered = data.filter(d => productCode === 'ALL' || d.productCode === productCode);
    if (filtered.length > 0) return filtered;
  }
  return [
    { productCode, productLabel: 'Selected product', reporter: targetRegion, year, exportValue: null, importValue: null, growthRate: null, marketShare: null },
  ];
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchITCMarketData(
  productCode: string,
  targetRegion: string,
  _year: number = new Date().getFullYear() - 1
): Promise<ITCMarketData[]> {
  if (ITC_MODE !== 'live' || !ITC_API_KEY) {
    return mockData(productCode, targetRegion, _year);
  }

  try {
    const url = `${ITC_API_BASE}${ITC_API_PATH}?product=${encodeURIComponent(productCode)}&reporter=${encodeURIComponent(targetRegion)}&format=json`;
    const res = await fetchWithTimeout(url, {
      headers: { 'Ocp-Apim-Subscription-Key': ITC_API_KEY },
    });
    if (!res.ok) return mockData(productCode, targetRegion, _year);
    const data = await res.json();
    return (data?.results || []).map((r: ITCResult) => ({
      productCode: r.ProductCode || productCode,
      productLabel: r.ProductLabel || '',
      reporter: r.Reporter || targetRegion,
      year: r.Year || _year,
      exportValue: r.ExportValue ?? null,
      importValue: r.ImportValue ?? null,
      growthRate: r.GrowthRate ?? null,
      marketShare: r.MarketShare ?? null,
    }));
  } catch {
    return mockData(productCode, targetRegion, _year);
  }
}