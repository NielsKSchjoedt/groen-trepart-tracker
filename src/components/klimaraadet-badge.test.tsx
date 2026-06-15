import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KlimaraadetBadge } from './KlimaraadetBadge';

describe('KlimaraadetBadge', () => {
  it('viser risiko og åbner popover med citat', () => {
    const citat = 'Testcitat med væsentlig risiko for mål uden acceleration.';
    render(
      <KlimaraadetBadge
        vurdering={{ risiko: 'Væsentlig', citat, ekstraUdledningTons: 700_000 }}
        rapportUrl="https://klimaraadet.dk/da/rapport/statusrapport-2026"
        compact
      />,
    );
    const btn = screen.getByRole('button', { name: /Klimarådet.*Væsentlig/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByText(citat)).toBeInTheDocument();
  });
});
