import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatRelativeTime,
  truncate,
  slugify,
  debounce,
} from '@/lib/utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatCurrency', () => {
  it('formats USD with 0-2 decimals', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.5');
  });
  it('formats whole numbers without decimals', () => {
    expect(formatCurrency(2000)).toBe('$2,000');
  });
  it('respects a custom currency', () => {
    expect(formatCurrency(1500, 'EUR')).toBe('€1,500');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2026-08-17T10:00:00Z')).toBe('Aug 17, 2026');
  });
});

describe('formatRelativeTime', () => {
  it('returns "Just now" for < 60s', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    expect(formatRelativeTime('2026-08-17T11:59:30Z')).toBe('Just now');
  });
  it('returns minutes ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    expect(formatRelativeTime('2026-08-17T11:50:00Z')).toBe('10m ago');
  });
  it('returns hours ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    expect(formatRelativeTime('2026-08-17T08:00:00Z')).toBe('4h ago');
  });
  it('falls back to a date for older timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    expect(formatRelativeTime('2026-01-01T00:00:00Z')).toBe('Jan 1, 2026');
  });
});

describe('truncate', () => {
  it('keeps short strings intact', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  it('truncates long strings with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Organic Ceylon Cinnamon!')).toBe('organic-ceylon-cinnamon');
  });
  it('strips surrounding hyphens', () => {
    expect(slugify('  --Spices--  ')).toBe('spices');
  });
});

describe('debounce', () => {
  it('calls the function once after the delay', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
