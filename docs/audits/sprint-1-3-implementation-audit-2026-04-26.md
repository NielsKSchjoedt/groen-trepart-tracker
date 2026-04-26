# Sprint 1-3 Implementation Audit (2026-04-26)

Scope: reviewed the implemented branches against:

- `.cursor/plans/sprint_1_implementeringsplan_01a9b702.plan.md`
- `.cursor/plans/sprint_2_implementeringsplan_58348120.plan.md`
- `.cursor/plans/sprint_3_biodiversitetslag_658d4220.plan.md`

Branches checked:

- Sprint 1: `sprint-1-implementation`
- Sprint 2: `sprint-2-implementation`
- Sprint 3: `feature/sprint-3-biodiversitet-implementation`

Note: `feature/sprint-2-mars-5fase` was a duplicate local branch pointing to the same commit as `sprint-2-implementation` and has been deleted locally.

## Verification Run

- Sprint 1: `npm run ci`, `python3 -m unittest etl/test_sprint1_merge_unittest.py -v`, `npx playwright test --reporter=line`, browser smoke.
- Sprint 2: `npm run ci`, `python3 -m unittest test_mars_pipeline_s2 -v`, browser smoke.
- Sprint 3: `npm run ci`, `python3 -m unittest test_mars_pipeline_s2 test_fetch_biodiversitet -v`, browser smoke.

All build/test/browser smoke checks completed without fatal runtime failures.

## Resolution Status (2026-04-26)

- Sprint 1 fixes are committed on `sprint-1-implementation` in `f561209`.
- Sprint 2 fixes are committed on `sprint-2-implementation` in `9c9ede9`.
- Sprint 3 fixes are committed on `feature/sprint-3-biodiversitet-implementation` in the final Sprint 3 fix commit.
- DCE D1 full polygon materialisation is intentionally deferred from daily CI. Sprint 3 now documents `FULL_DCE=0` as hits-only daily behavior; `FULL_DCE=1` remains the manual/periodic path until file size and runtime are proven stable enough.

## Sprint 1 Follow-Ups

1. Resolved: `BudgetKapacitet` now converts `beloebMioKr` to `mia. kr.` for display.
2. Resolved: Skov sub-budget/detail rows are marked with `includeInTotal: false`, so the umbrella total is not double-counted.
3. Resolved: `InitiativeTypeGauge` project-count mode now respects “Inkluder skitser”.
4. Resolved: Klimarådet provenance resolves and validates the actual PDF artifact, and stores the report page separately.
5. Resolved: tests cover budget conversion and the sketch-count toggle invariant.

## Sprint 2 Follow-Ups

1. Resolved: legacy 3-phase totals exclude sketches, while `national.byPipelinePhase.sketch` remains available for the new 5-phase model.
2. Resolved: `byOwnerOrg` counts formal projects only.
3. Resolved: natur/skov projects emit `projectType: "natur"` plus `forvaltningsplanStatus: "unknown"`, and the UI shows the data gap.
4. Resolved: Python ETL tests are wired into `npm run ci`, with coverage for state 2 sub-state, owner-org counts, cancelled sidecar, and legacy compatibility.
5. Resolved: `PhaseBreakdown` visible labels include both metric values and project counts.

## Sprint 3 Follow-Ups

1. Intentionally deferred: DCE D1 remains hits-only in daily CI (`FULL_DCE=0`). This is now documented in `DATA_SOURCES.md`, the workflow, the method page, and ETL tests.
2. Resolved: VNS/MARS comparison is renamed to `countCheck`, so it no longer implies spatial overlap validation.
3. Resolved enough for Sprint 3: Data/metode now includes a visible three-step benchmark and explicit DCE daily/manual behavior. Direct report links remain ordinary public source links rather than forcing PDF-only links where the public source is a landing page.
4. Resolved: `etl-run-summary.json` is regenerated and `build_etl_summary.py` includes Arealdata/FVM daily source health.
5. Resolved: `VandNaturSkovProjekt` is added and used by the VNS GeoJSON loader.

## Small Fixes Included

- Removed root `STAKEHOLDER-EMAILS.md`; stakeholder outreach templates should stay in ignored `.cursor/` material per repository policy.
- Fixed two Danish copy issues in `src/components/PhaseBreakdown.tsx`.

## Recommended Next Order

All listed fixes have been handled. Remaining follow-up is optional: if exact VNS/MARS spatial overlap is desired, implement it in a later GIS-enabled sprint using a spatial library such as GeoPandas rather than stdlib-only ETL.
