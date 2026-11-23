const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

let initialized = false;

/**
 * Initialize PostHog once at app startup. No-op when the env vars are
 * missing or when running in a test environment. The SDK is loaded
 * dynamically so it never bloats the main bundle.
 */
export function initAnalytics(): void {
  if (initialized || !KEY || !HOST) return;
  initialized = true;
  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        capture_pageview: false,
        persistence: 'localStorage',
        capture_exceptions: false,
      });
    })
    .catch(() => {
      /* analytics must never break the app */
    });
}

/**
 * Track a custom event. Best-effort: swallows failures and no-ops when
 * PostHog was never initialized.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialized || !KEY) return;
  void import('posthog-js')
    .then(({ default: posthog }) => posthog.capture(event, properties))
    .catch(() => {
      /* best-effort */
    });
}

/**
 * Track a page view. Called by usePageMeta so every documented page emits
 * a page_view event with its title.
 */
export function pageview(title: string, url?: string): void {
  track('page_view', {
    title,
    url: url ?? window.location.pathname + window.location.search,
  });
}