import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FremskrivningCard } from './fremskrivning/FremskrivningCard';
import type { DashboardData } from '@/lib/types';

function minimalDashboard(): DashboardData {
  return {
    fetchedAt: '2026-06-01T00:00:00Z',
    driftFinansiering: undefined,
    national: {
      targets: {
        nitrogenReductionT: 12776,
        extractionHa: 140000,
        afforestationHa: 250000,
        protectedNaturePct: 20,
        deadline: '2030-12-31',
        forestDeadline: '2045-12-31',
      },
      progress: {
        nitrogenAchievedT: 26.7,
        nitrogenProgressPct: 0.2,
        extractionAchievedHa: 604,
        extractionProgressPct: 0.4,
        afforestationAchievedHa: 3000,
        afforestationProgressPct: 1.2,
        afforestationMarsHa: 530,
        afforestationSupplementaryHa: 2470,
        afforestationKsfHa: 2000,
        afforestationKsfProjectCount: 120,
        afforestationNstCompletedHa: 400,
        afforestationNstOngoingHa: 70,
        afforestationNstMatchedCount: 20,
        naturePotentialAreaHa: 0,
        natureProtectedPct: 12,
        natura2000TerrestrialPct: 8,
        section3Pct: 5,
      },
      pipelineScenarios: {
        established: {
          nitrogenAchievedT: 26.7,
          nitrogenProgressPct: 0.2,
          extractionAchievedHa: 604,
          extractionProgressPct: 0.4,
          afforestationAchievedHa: 3000,
          afforestationProgressPct: 1.2,
        },
        approved: {
          nitrogenAchievedT: 660,
          nitrogenProgressPct: 5,
          extractionAchievedHa: 22631,
          extractionProgressPct: 16,
          afforestationAchievedHa: 5500,
          afforestationProgressPct: 2.2,
        },
        preliminary: {
          nitrogenAchievedT: 4535,
          nitrogenProgressPct: 35,
          extractionAchievedHa: 90038,
          extractionProgressPct: 64,
          afforestationAchievedHa: 5500,
          afforestationProgressPct: 2.2,
        },
        all: {
          nitrogenAchievedT: 19587,
          nitrogenProgressPct: 153,
          extractionAchievedHa: 249240,
          extractionProgressPct: 178,
          afforestationAchievedHa: 32440,
          afforestationProgressPct: 13,
        },
      },
      byPipelinePhase: {
        nitrogen: {
          established: { count: 65, nitrogenT: 26.7, extractionHa: 17, afforestationHa: 484 },
          establishment_grant: { count: 591, nitrogenT: 633.7, extractionHa: 9065, afforestationHa: 2297 },
          preliminary_grant: { count: 486, nitrogenT: 3875, extractionHa: 46554, afforestationHa: 0 },
          preliminary_done: { count: 0, nitrogenT: 0, extractionHa: 0, afforestationHa: 0 },
          sketch: {
            count: 5036,
            nitrogenT: 15052,
            extractionHa: 157662,
            afforestationHa: 26886,
            subStates: {
              kladde: { count: 5036, nitrogenT: 15052, extractionHa: 157662, afforestationHa: 26886 },
              ansoegt: { count: 0, nitrogenT: 0, extractionHa: 0, afforestationHa: 0 },
            },
          },
        },
        extraction: {
          established: { count: 7, nitrogenT: 0.6, extractionHa: 604, afforestationHa: 0 },
          establishment_grant: { count: 202, nitrogenT: 515, extractionHa: 22027, afforestationHa: 0 },
          preliminary_grant: { count: 527, nitrogenT: 3769, extractionHa: 67406, afforestationHa: 0 },
          preliminary_done: { count: 0, nitrogenT: 0, extractionHa: 0, afforestationHa: 0 },
          sketch: {
            count: 2985,
            nitrogenT: 13840,
            extractionHa: 159203,
            afforestationHa: 0,
            subStates: {
              kladde: { count: 2985, nitrogenT: 13840, extractionHa: 159203, afforestationHa: 0 },
              ansoegt: { count: 0, nitrogenT: 0, extractionHa: 0, afforestationHa: 0 },
            },
          },
        },
        afforestation: {
          established: { count: 10, nitrogenT: 0, extractionHa: 0, afforestationHa: 530 },
          establishment_grant: { count: 50, nitrogenT: 0, extractionHa: 0, afforestationHa: 2642 },
          preliminary_grant: { count: 0, nitrogenT: 0, extractionHa: 0, afforestationHa: 0 },
          preliminary_done: { count: 0, nitrogenT: 0, extractionHa: 0, afforestationHa: 0 },
          sketch: {
            count: 508,
            nitrogenT: 417,
            extractionHa: 0,
            afforestationHa: 26940,
            subStates: {
              kladde: { count: 508, nitrogenT: 417, extractionHa: 0, afforestationHa: 26940 },
              ansoegt: { count: 0, nitrogenT: 0, extractionHa: 0, afforestationHa: 0 },
            },
          },
        },
      },
      phases: { established: 0, approved: 0, preliminary: 0, sketches: 0, assessed: 0 },
    },
    plans: [],
    catchments: [],
    kommuner: [],
  } as unknown as DashboardData;
}

describe('FremskrivningCard', () => {
  it('viser trin 1 og tempo-advarsel for kvælstof', () => {
    render(<FremskrivningCard data={minimalDashboard()} pillar="nitrogen" />);
    expect(screen.getByText(/Vælg, hvad du tror bliver til virkelighed/)).toBeInTheDocument();
    expect(screen.getByText(/Hastigheden er problemet, ikke pipelinen/)).toBeInTheDocument();
    expect(screen.getAllByText('Gennemførte').length).toBeGreaterThan(0);
  });

  it('opdaterer scenarietal når godkendte toggles', () => {
    render(<FremskrivningCard data={minimalDashboard()} pillar="nitrogen" />);
    fireEvent.click(screen.getByRole('button', { name: /Godkendte/i }));
    expect(screen.getByText(/alle realiseres/)).toBeInTheDocument();
  });

  it('viser Gennemførte som valgt under MARS-projekter', () => {
    render(<FremskrivningCard data={minimalDashboard()} pillar="extraction" />);
    expect(screen.getByText('MARS-projekter')).toBeInTheDocument();
    const gennemfoerte = screen.getByText('tæller altid med').closest('[aria-pressed]');
    expect(gennemfoerte).toHaveAttribute('aria-pressed', 'true');
  });
  it('viser eksterne kilder for skov som standard tændt', () => {
    render(<FremskrivningCard data={minimalDashboard()} pillar="afforestation" />);
    expect(screen.getByText(/Eksterne kilder/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Klimaskovfonden/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
