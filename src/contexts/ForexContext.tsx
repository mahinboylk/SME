import { createContext, useContext, useEffect, useState } from 'react';
import { USD_TO_LKR } from '@/lib/utils';

interface ForexState {
  rate: number;
  change: number;
}

const ForexContext = createContext<ForexState>({ rate: USD_TO_LKR, change: 0 });

export function ForexProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ForexState>(() => {
    try {
      const cached = localStorage.getItem('forex_usd_lkr');
      const prevCached = localStorage.getItem('forex_usd_lkr_prev');
      if (cached) {
        const rate = parseFloat(cached);
        const prev = prevCached ? parseFloat(prevCached) : rate;
        if (!Number.isNaN(rate) && rate > 0) {
          const change = !Number.isNaN(prev) && prev > 0 && prev !== rate ? ((rate - prev) / prev) * 100 : 0;
          return { rate, change };
        }
      }
    } catch {
      // ignore
    }
    return { rate: USD_TO_LKR, change: 0 };
  });

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const fetchHistorical = async (currentLkr: number, prevCachedRate: number | null) => {
      // Try to get yesterday's close via free CDN (fawazahmed0) – supports CORS, no key.
      for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
        if (cancelled) return;
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const dateStr = d.toISOString().split('T')[0];
        try {
          const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/usd.json`);
          if (!res.ok) continue;
          const json = (await res.json()) as { usd?: Record<string, number> };
          // API returns lowercase keys (e.g. usd.lkr); be defensive about casing.
          const hist = json?.usd?.lkr ?? json?.usd?.LKR;
          if (typeof hist === 'number' && hist > 0) {
            const change = ((currentLkr - hist) / hist) * 100;
            if (!cancelled) setState({ rate: currentLkr, change });
            return;
          }
        } catch {
          // try next day (weekend/holiday may 404)
        }
      }
      // Fallback: previous cached fetch delta (uses value captured BEFORE overwrite)
      if (prevCachedRate && prevCachedRate > 0 && prevCachedRate !== currentLkr) {
        const change = ((currentLkr - prevCachedRate) / prevCachedRate) * 100;
        if (!cancelled) setState({ rate: currentLkr, change });
      }
    };

    fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        const lkr = (data as { rates?: { LKR?: number } })?.rates?.LKR;
        if (typeof lkr === 'number' && lkr > 0) {
          // Optimistically set rate immediately (change will update after historical fetch)
          setState((prev) => ({ rate: lkr, change: prev.change }));
          // Capture previous cached rate BEFORE overwriting so the fallback delta is valid.
          let prevCachedRate: number | null = null;
          try {
            const oldCached = localStorage.getItem('forex_usd_lkr');
            if (oldCached) {
              const parsed = parseFloat(oldCached);
              if (!Number.isNaN(parsed) && parsed > 0) prevCachedRate = parsed;
              localStorage.setItem('forex_usd_lkr_prev', oldCached);
            }
            localStorage.setItem('forex_usd_lkr', String(lkr));
          } catch {
            // ignore
          }
          // Fetch historical in background to compute real daily % like Brent
          fetchHistorical(lkr, prevCachedRate);
        }
      })
      .catch(() => {
        // keep fallback
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  return <ForexContext.Provider value={state}>{children}</ForexContext.Provider>;
}

export function useForexRate(): number {
  return useContext(ForexContext).rate;
}

export function useForex(): ForexState {
  return useContext(ForexContext);
}
