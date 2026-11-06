import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoastalWaterDetailPanel } from './CoastalWaterDetailPanel';
import type { CoastalWaterStatusData } from '@/lib/types';

const coastal: CoastalWaterStatusData = JSON.parse(
  readFileSync(resolve(__dirname, '../../public/data/coastal-water-status.json'), 'utf8'),
);

describe('CoastalWaterDetailPanel', () => {
  it('links to vandplandata.dk and shows the status without national substances when it differs', () => {
    const [name, entry] =
      Object.entries(coastal.waters).find(
        ([, w]) => w.ecologicalStatusExclNationalSubstances === 'God' && w.ecologicalStatus !== 'God',
      ) ?? Object.entries(coastal.waters)[0];
    render(<CoastalWaterDetailPanel name={name} entry={entry} onClose={() => {}} />);

    const link = screen.getByRole('link', { name: /Se kystvandet på vandplandata\.dk/ });
    expect(link).toHaveAttribute('href', entry.vandplandataUrl);
    expect(screen.queryByText('Makroalger')).not.toBeInTheDocument();
    if (entry.ecologicalStatusExclNationalSubstances === 'God') {
      expect(screen.getByText(/Uden nationalt specifikke stoffer ville tilstanden være/)).toBeInTheDocument();
    }
  });
});
