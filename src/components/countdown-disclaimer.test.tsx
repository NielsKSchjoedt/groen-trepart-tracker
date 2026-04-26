import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CountdownProjection } from './CountdownProjection';

const base = {
  deadline: '2030-12-31',
  achieved: 10,
  target: 1000,
  unit: 'ha' as const,
};

const scenarios = {
  established: { achieved: 10 },
  approved: { achieved: 20 },
  preliminary: { achieved: 30 },
  all: { achieved: 40 },
};

describe('CountdownProjection Klimarådet-note', () => {
  it('viser disclaimer når vurdering findes (etableret-scenarie)', () => {
    const citat = 'Risiko for at arealmål ikke nås uden acceleration.';
    render(
      <CountdownProjection
        {...base}
        klimaraadetVurdering={{
          risiko: 'Væsentlig',
          citat,
          ekstraUdledningTons: null,
        }}
        klimaraadetRapportUrl="https://klimaraadet.dk/da/rapport/statusrapport-2026"
        scenarios={scenarios}
      />,
    );
    expect(screen.getByText('Lineær fremskrivning er fase-blind')).toBeInTheDocument();
    expect(screen.getByText(citat)).toBeInTheDocument();
  });

  it('skjuler disclaimer når et bredere scenarie (forundersøgelse) vælges', () => {
    const citat = 'Risiko for at arealmål ikke nås uden acceleration.';
    render(
      <CountdownProjection
        {...base}
        klimaraadetVurdering={{
          risiko: 'Væsentlig',
          citat,
          ekstraUdledningTons: null,
        }}
        klimaraadetRapportUrl="https://klimaraadet.dk/da/rapport/statusrapport-2026"
        scenarios={scenarios}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /forundersøgelse/i }));
    expect(screen.queryByText('Lineær fremskrivning er fase-blind')).not.toBeInTheDocument();
  });
});
