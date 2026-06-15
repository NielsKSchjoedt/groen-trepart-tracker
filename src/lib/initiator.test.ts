import { describe, it, expect } from 'vitest';
import { classifyInitiator } from './initiator';

describe('classifyInitiator', () => {
  it("NST → 'state'", () => {
    expect(classifyInitiator('NST', 'NST Klima-Lavbund')).toBe('state');
  });
  it("LBST Privat Skovrejsning → 'private'", () => {
    expect(classifyInitiator('LBST', 'Privat Skovrejsning')).toBe('private');
  });
  it('Minivådområder → private', () => {
    expect(classifyInitiator('SGAV', 'Minivådområder')).toBe('private');
  });
  it('SGAV Kvælstofvådområder → municipal', () => {
    expect(classifyInitiator('SGAV', 'Kvælstofvådområder')).toBe('municipal');
  });
});
