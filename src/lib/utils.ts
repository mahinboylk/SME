import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Central USD→LKR conversion used to display all monetary values in rupees.
// Live forex is fetched in RealTimeInsights; this static fallback guarantees
// consistent rendering and deterministic tests.
export const USD_TO_LKR = 300;

export function convertUSDToLKR(usd: number, rate = USD_TO_LKR): number {
  return usd * rate;
}

export function formatRupees(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPriceInRupees(price: number | null, currency: string | null, rate = USD_TO_LKR): string {
  if (price == null) return '—';
  // Treat null/undefined currency as USD (historical default) so dollar values are always shown in rupees.
  const cur = currency || 'USD';
  if (cur === 'USD') {
    return formatRupees(convertUSDToLKR(price, rate));
  }
  if (cur === 'LKR') {
    return formatRupees(price);
  }
  // For other currencies (EUR, GBP) preserve the original formatting.
  return formatCurrency(price, cur);
}

export function formatTradeValueInRupees(value: number | null, rate = USD_TO_LKR): string {
  if (value == null) return 'N/A';
  const lkr = convertUSDToLKR(value, rate);
  return formatRupees(lkr);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}
