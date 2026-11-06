const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape text for insertion into an HTML string.
 *
 * Leaflet tooltips and popups take raw HTML, and the names in them come from
 * external sources (MARS, Klimaskovfonden, Naturstyrelsen, Miljøportalen) that
 * many people can edit. Every external value that goes into such a string must
 * pass through here, or a project named `<img onerror=…>` runs on the site.
 *
 * @example escapeHtml('Å <b>') // "Å &lt;b&gt;"
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
