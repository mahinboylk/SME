interface WTODatasetItem {
  ReportingEconomyCode?: string;
  Year?: number;
  Value?: number;
}

export interface WTOTariffData {
  reporter: string;
  partner: string;
  productCode: string;
  year: number;
  dutyRate: number | null;
  preference: string | null;
  /** true when dutyRate comes from the live WTO dataset; false when it's an indicative baseline estimate */
  live?: boolean;
}

// Mapping of country names to UN M49 codes for WTO API calls
const M49_MAP: Record<string, string> = {
  'China': '156', 'Japan': '392', 'South Korea': '410', 'North Korea': '408', 'Mongolia': '496',
  'Indonesia': '360', 'Vietnam': '704', 'Thailand': '764', 'Philippines': '608', 'Malaysia': '458',
  'India': '356', 'Pakistan': '586', 'Bangladesh': '050', 'Maldives': '462', 'Nepal': '524',
  'Saudi Arabia': '682', 'Iran': '364', 'Iraq': '368', 'United Arab Emirates': '784', 'Israel': '376',
  'Kazakhstan': '398', 'Uzbekistan': '860', 'Turkmenistan': '795', 'Kyrgyzstan': '417', 'Tajikistan': '762',
  'Nigeria': '566', 'South Africa': '710', 'Kenya': '404', 'Ethiopia': '231', 'Ghana': '288',
  'France': '250', 'Germany': '276', 'United Kingdom': '826', 'Italy': '380', 'Spain': '724',
  'Russia': '643', 'Ukraine': '804', 'Poland': '616', 'Romania': '642', 'Czechia': '203',
  'United States': '842', 'Canada': '124', 'Mexico': '484', 'Cuba': '192', 'Guatemala': '320',
  'Brazil': '076', 'Argentina': '032', 'Colombia': '170', 'Chile': '152', 'Peru': '604'
};

// Baseline tariff rates used as fallback when live API is unavailable
export const BASELINE_RATES: Record<string, WTOTariffData[]> = {
  'East Asia': [
    { reporter: 'LKA', partner: 'China', productCode: '', year: 0, dutyRate: 2.5, preference: 'APTA' },
    { reporter: 'LKA', partner: 'Japan', productCode: '', year: 0, dutyRate: 3.5, preference: 'GSP' },
    { reporter: 'LKA', partner: 'South Korea', productCode: '', year: 0, dutyRate: 8.0, preference: 'APTA' },
    { reporter: 'LKA', partner: 'North Korea', productCode: '', year: 0, dutyRate: 20.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Mongolia', productCode: '', year: 0, dutyRate: 5.0, preference: 'MFN' },
  ],
  'Southeast Asia': [
    { reporter: 'LKA', partner: 'Indonesia', productCode: '', year: 0, dutyRate: 5.0, preference: 'ASEAN' },
    { reporter: 'LKA', partner: 'Vietnam', productCode: '', year: 0, dutyRate: 0.0, preference: 'ASEAN' },
    { reporter: 'LKA', partner: 'Thailand', productCode: '', year: 0, dutyRate: 5.0, preference: 'ASEAN' },
    { reporter: 'LKA', partner: 'Philippines', productCode: '', year: 0, dutyRate: 5.0, preference: 'ASEAN' },
    { reporter: 'LKA', partner: 'Malaysia', productCode: '', year: 0, dutyRate: 0.0, preference: 'ASEAN' },
  ],
  'South Asia': [
    { reporter: 'LKA', partner: 'India', productCode: '', year: 0, dutyRate: 0.0, preference: 'ISFTA' },
    { reporter: 'LKA', partner: 'Pakistan', productCode: '', year: 0, dutyRate: 0.0, preference: 'PSFTA' },
    { reporter: 'LKA', partner: 'Bangladesh', productCode: '', year: 0, dutyRate: 5.0, preference: 'SAFTA' },
    { reporter: 'LKA', partner: 'Maldives', productCode: '', year: 0, dutyRate: 0.0, preference: 'SAFTA' },
    { reporter: 'LKA', partner: 'Nepal', productCode: '', year: 0, dutyRate: 5.0, preference: 'SAFTA' },
  ],
  'Middle East (West Asia)': [
    { reporter: 'LKA', partner: 'Saudi Arabia', productCode: '', year: 0, dutyRate: 5.0, preference: 'GCC' },
    { reporter: 'LKA', partner: 'Iran', productCode: '', year: 0, dutyRate: 15.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Iraq', productCode: '', year: 0, dutyRate: 10.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'United Arab Emirates', productCode: '', year: 0, dutyRate: 5.0, preference: 'GCC' },
    { reporter: 'LKA', partner: 'Israel', productCode: '', year: 0, dutyRate: 8.0, preference: 'MFN' },
  ],
  'Central Asia': [
    { reporter: 'LKA', partner: 'Kazakhstan', productCode: '', year: 0, dutyRate: 5.0, preference: 'EAEU' },
    { reporter: 'LKA', partner: 'Uzbekistan', productCode: '', year: 0, dutyRate: 10.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Turkmenistan', productCode: '', year: 0, dutyRate: 15.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Kyrgyzstan', productCode: '', year: 0, dutyRate: 5.0, preference: 'EAEU' },
    { reporter: 'LKA', partner: 'Tajikistan', productCode: '', year: 0, dutyRate: 10.0, preference: 'EAEU' },
  ],
  'Sub-Saharan Africa': [
    { reporter: 'LKA', partner: 'Nigeria', productCode: '', year: 0, dutyRate: 20.0, preference: 'ECOWAS' },
    { reporter: 'LKA', partner: 'South Africa', productCode: '', year: 0, dutyRate: 15.0, preference: 'SACU' },
    { reporter: 'LKA', partner: 'Kenya', productCode: '', year: 0, dutyRate: 10.0, preference: 'EAC' },
    { reporter: 'LKA', partner: 'Ethiopia', productCode: '', year: 0, dutyRate: 25.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Ghana', productCode: '', year: 0, dutyRate: 15.0, preference: 'ECOWAS' },
  ],
  'Western Europe': [
    { reporter: 'LKA', partner: 'France', productCode: '', year: 0, dutyRate: 0.0, preference: 'GSP+' },
    { reporter: 'LKA', partner: 'Germany', productCode: '', year: 0, dutyRate: 0.0, preference: 'GSP+' },
    { reporter: 'LKA', partner: 'United Kingdom', productCode: '', year: 0, dutyRate: 0.0, preference: 'DCS' },
    { reporter: 'LKA', partner: 'Italy', productCode: '', year: 0, dutyRate: 0.0, preference: 'GSP+' },
    { reporter: 'LKA', partner: 'Spain', productCode: '', year: 0, dutyRate: 0.0, preference: 'GSP+' },
  ],
  'Eastern Europe': [
    { reporter: 'LKA', partner: 'Russia', productCode: '', year: 0, dutyRate: 10.0, preference: 'EAEU' },
    { reporter: 'LKA', partner: 'Ukraine', productCode: '', year: 0, dutyRate: 10.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Poland', productCode: '', year: 0, dutyRate: 0.0, preference: 'GSP+' },
    { reporter: 'LKA', partner: 'Romania', productCode: '', year: 0, dutyRate: 0.0, preference: 'GSP+' },
    { reporter: 'LKA', partner: 'Czechia', productCode: '', year: 0, dutyRate: 0.0, preference: 'GSP+' },
  ],
  'North America': [
    { reporter: 'LKA', partner: 'United States', productCode: '', year: 0, dutyRate: 4.5, preference: 'GSP' },
    { reporter: 'LKA', partner: 'Canada', productCode: '', year: 0, dutyRate: 0.0, preference: 'GPT' },
    { reporter: 'LKA', partner: 'Mexico', productCode: '', year: 0, dutyRate: 15.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Cuba', productCode: '', year: 0, dutyRate: 20.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Guatemala', productCode: '', year: 0, dutyRate: 15.0, preference: 'MFN' },
  ],
  'Latin America (South & Central)': [
    { reporter: 'LKA', partner: 'Brazil', productCode: '', year: 0, dutyRate: 12.0, preference: 'MERCOSUR' },
    { reporter: 'LKA', partner: 'Argentina', productCode: '', year: 0, dutyRate: 14.0, preference: 'MERCOSUR' },
    { reporter: 'LKA', partner: 'Colombia', productCode: '', year: 0, dutyRate: 10.0, preference: 'CAN' },
    { reporter: 'LKA', partner: 'Chile', productCode: '', year: 0, dutyRate: 6.0, preference: 'MFN' },
    { reporter: 'LKA', partner: 'Peru', productCode: '', year: 0, dutyRate: 9.0, preference: 'CAN' },
  ],
};

export const DEFAULT_RATES: WTOTariffData[] = [
  { reporter: 'LKA', partner: 'United States', productCode: '', year: 0, dutyRate: 4.5, preference: 'GSP' },
  { reporter: 'LKA', partner: 'Germany', productCode: '', year: 0, dutyRate: 0.0, preference: 'GSP+' },
  { reporter: 'LKA', partner: 'China', productCode: '', year: 0, dutyRate: 2.5, preference: 'APTA' },
  { reporter: 'LKA', partner: 'India', productCode: '', year: 0, dutyRate: 0.0, preference: 'ISFTA' },
  { reporter: 'LKA', partner: 'Brazil', productCode: '', year: 0, dutyRate: 12.0, preference: 'MERCOSUR' },
];

export async function fetchTariffData(
  hsCode: string,
  reporter: string,
  partner: string = 'ALL',
  year: number = new Date().getFullYear()
): Promise<WTOTariffData[]> {
  const partnerName = partner;

  // Get baseline fallback data for this region (indicative estimate only)
  const baseline = BASELINE_RATES[partnerName] ?? DEFAULT_RATES;
  const results: WTOTariffData[] = baseline.map(r => ({
    ...r,
    reporter,
    productCode: hsCode,
    year,
    live: false,
  }));

  // Attempt live WTO API call first
  const wtoApiKey = import.meta.env.VITE_WTO_API_KEY;
  if (!wtoApiKey) {
    console.warn('VITE_WTO_API_KEY not set — using baseline tariff data');
    return results;
  }

  try {
    const partnerCodes = results.map(r => M49_MAP[r.partner]).filter(Boolean);
    if (partnerCodes.length === 0) return results;

    // TP_A_0010 = Simple average MFN applied tariff, all products
    const url = `https://api.wto.org/timeseries/v1/data?i=TP_A_0010&r=${partnerCodes.join(',')}&fmt=json`;
    const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': wtoApiKey } });

    if (!res.ok) {
      console.warn(`WTO API returned ${res.status} — using baseline tariff data`);
      return results;
    }

    const data = await res.json();
    if (!data?.Dataset) {
      console.warn('WTO API returned no dataset — using baseline tariff data');
      return results;
    }

    // Overlay the live WTO simple-average applied MFN tariff (economy-wide) per partner
    results.forEach(r => {
      const code = M49_MAP[r.partner];
      const partnerData = data.Dataset.filter((d: WTODatasetItem) => d.ReportingEconomyCode === code);
      if (partnerData.length > 0) {
        partnerData.sort((a: WTODatasetItem, b: WTODatasetItem) => (b.Year ?? 0) - (a.Year ?? 0));
        const mfnRate = partnerData[0].Value;
        if (typeof mfnRate === 'number') {
          r.dutyRate = Number(mfnRate.toFixed(1));
          r.live = true;
        }
      }
    });
  } catch (e) {
    console.warn('WTO API call failed — using baseline tariff data:', e);
  }

  return results;
}
