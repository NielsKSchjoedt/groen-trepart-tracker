/**
 * Shared "lifted surface" styling: a white card with a soft border and the
 * layered shadow from the theme's elevation scale (see --shadow-* in index.css).
 * Use for top-level content panels (funnels, charts, summaries) so they read as
 * surfaces on the page instead of flat newspaper blocks. Add padding at the call site.
 */
export const SURFACE_CARD = 'rounded-2xl border border-border/70 bg-card shadow-md';
