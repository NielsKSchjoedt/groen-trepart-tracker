/** Resolve hash from location; `fane` query param is legacy alias for hash. */
export function parseSectionHash(
  hash: string,
  params: URLSearchParams,
): string | null {
  const fromHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (fromHash) return fromHash;
  const fane = params.get('fane');
  if (fane) return fane;
  return null;
}

export function encodeSectionHash(section: string | null): string {
  return section ? `#${section}` : '';
}

/** Write hash via replaceState without triggering navigation. */
export function replaceSectionHash(section: string | null): void {
  const url = new URL(window.location.href);
  url.hash = section ? `#${section}` : '';
  url.searchParams.delete('fane');
  window.history.replaceState(null, '', url.toString());
}

/** Build a shareable URL for a section anchor on the current page. */
export function buildSectionPermalink(sectionId: string, href = window.location.href): string {
  const url = new URL(href);
  url.hash = `#${sectionId}`;
  url.searchParams.delete('fane');
  return url.toString();
}
