import { describe, expect, it } from 'vitest';
import { escapeHtml } from './html';

describe('escapeHtml', () => {
  it('neutralises markup in external names', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
  });

  it('keeps Danish text and numbers intact', () => {
    expect(escapeHtml('Ålborg Å & Lille Vildmose')).toBe('Ålborg Å &amp; Lille Vildmose');
    expect(escapeHtml(12.5)).toBe('12.5');
    expect(escapeHtml(null)).toBe('');
  });
});
