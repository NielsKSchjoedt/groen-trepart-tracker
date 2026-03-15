import { useEffect } from 'react';

const BASE_URL = 'https://treparttracker.dk';
const SITE_TITLE = 'Den Grønne Trepart — Er vi på sporet?';

interface PageMetaOptions {
  /** Short page-specific title, e.g. "Kvælstof". Will be combined with SITE_TITLE. */
  title: string;
  /** Full page description for <meta name="description"> and OG tags. */
  description?: string;
  /** URL path relative to BASE_URL, e.g. '/kvælstof'. Used for canonical and og:url. */
  path?: string;
}

const DEFAULT_DESCRIPTION =
  'Dashboard der følger implementeringen af Danmarks Grønne Trepart-aftale. ' +
  'Kvælstofreduktion, lavbundsarealer, skovrejsning, CO₂ og beskyttet natur.';

/**
 * Dynamically updates page-level meta tags in <head> for the active pillar view.
 * Affects: document.title, description, og:title, og:description, og:url,
 * twitter:title, twitter:description, and the canonical link.
 *
 * Googlebot executes JavaScript so per-pillar meta tags will be indexed.
 * Social scrapers (Twitter/Facebook) read static HTML, so the defaults in
 * index.html cover those cases.
 *
 * @example
 * ```tsx
 * usePageMeta({
 *   title: 'Kvælstof',
 *   description: 'Kvælstofreduktion i vandmiljøet — følg fremskridt mod 12.776 ton N/år',
 *   path: '/kvælstof',
 * });
 * ```
 */
export function usePageMeta({ title, description = DEFAULT_DESCRIPTION, path = '/' }: PageMetaOptions) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE_TITLE}`;
    const canonicalUrl = `${BASE_URL}${path}`;

    document.title = fullTitle;

    /** Upsert a <meta> tag by its identifying attribute. */
    const setMeta = (selector: string, idAttr: string, idVal: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(idAttr, idVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    /** Upsert a <link> tag. */
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    setMeta('meta[name="description"]',     'name',     'description',     description);
    setMeta('meta[property="og:title"]',    'property', 'og:title',        fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]',      'property', 'og:url',          canonicalUrl);
    setMeta('meta[name="twitter:title"]',   'name',     'twitter:title',   fullTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setLink('canonical', canonicalUrl);
  }, [title, description, path]);
}
