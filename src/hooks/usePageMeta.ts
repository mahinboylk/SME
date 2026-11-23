import { useEffect } from 'react';
import { pageview } from '@/lib/analytics';

const SITE_NAME = 'Brooke';
const DEFAULT_DESCRIPTION =
  'Brooke — AI-powered trade intelligence, compliance tracking, and a verified B2B marketplace for Sri Lankan SMEs.';

function upsertMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDescription = document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.getAttribute('content');

    document.title = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    if (description) upsertMeta('description', description);
    else upsertMeta('description', DEFAULT_DESCRIPTION);

    pageview(title ?? SITE_NAME);

    return () => {
      document.title = prevTitle;
      if (prevDescription) upsertMeta('description', prevDescription);
      else document.querySelector<HTMLMetaElement>('meta[name="description"]')?.remove();
    };
  }, [title, description]);
}
