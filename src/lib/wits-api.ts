interface WITSItem {
  flowCode: string;
  refYear: number;
  primaryValue: number;
}

export interface WITSTradeData {
  reporter: string;
  partner: string;
  productCode: string;
  year: number;
  tradeValue: number | null;
  tradeFlow: 'export' | 'import';
}

export async function fetchWITSTradeData(
  reporter: string = 'LKA',
  partner: string = 'WLD',
  productCode: string = 'TOTAL',
  year: number = 2023
): Promise<WITSTradeData[]> {
  const partnerName = partner;
  
  // UN Comtrade representative partner codes for regions
  const partnerCodes: Record<string, string> = {
    'East Asia': '156', // China
    'Southeast Asia': '360', // Indonesia
    'South Asia': '356', // India
    'Middle East (West Asia)': '682', // Saudi Arabia
    'Central Asia': '398', // Kazakhstan
    'Sub-Saharan Africa': '710', // South Africa
    'Western Europe': '276', // Germany
    'Eastern Europe': '643', // Russia
    'North America': '842', // USA
    'Latin America (South & Central)': '76', // Brazil
  };
  const partnerCode = partnerCodes[partner] || '0';

  // UN Comtrade reporter codes (ISO numeric). Sri Lanka is the platform's
  // home reporter; unknown reporters fall back to it since the dataset is
  // Sri Lanka-centric.
  const reporterCodes: Record<string, string> = {
    LKA: '144',
  };
  const reporterCode = reporterCodes[reporter] || '144';

  // Map natural language to HS codes for product-specific trade volume
  let hsCode = 'TOTAL';
  const lowerQuery = productCode.toLowerCase();
  if (lowerQuery.includes('tea')) hsCode = '0902';
  else if (lowerQuery.includes('cinnamon')) hsCode = '0906';
  else if (lowerQuery.includes('apple')) hsCode = '0808';
  else if (lowerQuery.includes('orange') || lowerQuery.includes('citrus')) hsCode = '0805';
  else if (lowerQuery.includes('apparel') || lowerQuery.includes('clothing') || lowerQuery.includes('garment')) hsCode = '61';
  else if (lowerQuery.includes('rubber') || lowerQuery.includes('tire')) hsCode = '40';
  else if (lowerQuery.includes('coconut') || lowerQuery.includes('coir')) hsCode = '0801';
  else if (lowerQuery.includes('spice') || lowerQuery.includes('pepper')) hsCode = '0904';
  else if (lowerQuery.includes('ginger') || lowerQuery.includes('turmeric')) hsCode = '0910';

  try {
    const res = await fetch(`/un-api/public/v1/preview/C/A/HS?reporterCode=${reporterCode}&partnerCode=${partnerCode}&flowCode=M,X&cmdCode=${hsCode}&refYear=${year}`).then(r => r.json());
    
    if (res && Array.isArray(res.data)) {
      if (res.data.length > 0) {
        const results: WITSTradeData[] = [];
        res.data.forEach((item: WITSItem) => {
          if (item.flowCode === 'M') {
            results.push({ reporter, partner: partnerName, productCode, year: item.refYear, tradeValue: item.primaryValue, tradeFlow: 'import' });
          } else if (item.flowCode === 'X') {
            results.push({ reporter, partner: partnerName, productCode, year: item.refYear, tradeValue: item.primaryValue, tradeFlow: 'export' });
          }
        });
        if (results.length > 0) return results;
      } else {
        // The API successfully connected but found legitimately zero trade! 
        // We must return 0 instead of falling back to fake estimates.
        return [
          { reporter, partner: partnerName, productCode, year, tradeValue: 0, tradeFlow: 'export' },
          { reporter, partner: partnerName, productCode, year, tradeValue: 0, tradeFlow: 'import' },
        ];
      }
    }
  } catch (err) {
    console.error("UN Comtrade live fetch failed:", err);
  }

  // If the UN API fails or returns no usable data, return nothing so the UI can
  // show "data unavailable" rather than a misleading $0 figure.
  return [];
}

export async function fetchWITSTariffData(
  _reporter: string = 'LKA',
  _partner: string = 'WLD',
  _productCode: string = 'Total',
  _year: number = 2023
): Promise<number | null> {
  return null;
}
