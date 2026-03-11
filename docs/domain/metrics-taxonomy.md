# Metrics Taxonomy

The tracker organizes metrics in four layers to avoid mixing "plan", "pipeline", "implementation", and "environmental outcomes".

## Layer 1: Governance & Process

Tracks whether the institutional machinery is functioning. Data primarily from MARS status views, SGAV communications, and municipal council records.

| Metric | Definition | Source | Update frequency | FOI needed? |
|--------|-----------|--------|------------------|-------------|
| Local tripartite established | Date + lead/secretariat municipality | SGAV/KL | One-time | No |
| First sketch projects in MARS | Whether deadline met (Jul 2025) | MARS | One-time | No |
| Coastal water group report published | Per kystvandgruppe, per local tripartite | MARS status | As published | No |
| SGAV verification requested/completed | Date + any comments | SGAV flow | 2025 (Sep-Oct) | Possibly |
| Municipal principle adoption | Date per municipality | Council minutes | End 2025 | Possibly (if not centralized) |

## Layer 2: Pipeline & Implementation Progress

Tracks projects and their status. Primary source: MARS. Unit of measurement: projects, hectares, tonnes N.

| Metric | Definition | Source | Level | Update |
|--------|-----------|--------|-------|--------|
| Project count by type/status | Projects in skitse→forundersøgelse→etablering→anlagt | MARS | National/kommune/tripartite | Continuous |
| Area by instrument/status | Hectares per virkemiddel per status phase | MARS | Kystvandgruppe/national | Continuous |
| Nitrogen effect | Tonnes N per sub-catchment/coastal water group | MARS calculation model | Delopland/kystvandgruppe | Continuous |
| Lowland extraction | Ha carbon-rich soil (Kulstof2022 overlap) planned/realized | MARS | National/tripartite/kommune | Continuous |
| Afforestation | Ha planned/realized (incl. untouched forest) | MARS + subsidy data | National/kommune | Continuous |
| Nature projects | Ha nature projects + nature potential registered | MARS (nature potential layer) | National/tripartite | Continuous |
| Implementation velocity | Avg months in each project phase (træghedsindeks) | Historical MARS snapshots | National | Monthly (self-built) |

## Layer 3: Finance & Capacity

Typically no fully central, public data stream. Trackable with effort.

| Metric | Definition | Source | Level | Update |
|--------|-----------|--------|-------|--------|
| Subsidies granted (kr) | Tilsagn per scheme per region | Landbrugsstyrelsen / SGAV | National/kommune | Periodic |
| Subsidies paid out (kr) | Actual disbursements | Landbrugsstyrelsen | National | Annual |
| Land acquisition | Ha purchased/redistributed | SGAV/Naturstyrelsen | National | Unknown cadence |
| Municipal capacity | FTEs, consultant spend | KL templates, municipal reports | Kommune | Often FOI |

## Layer 4: Environmental Outcomes

Validates whether land transformation actually delivers environmental improvement. Primary source: NOVANA/DCE and Vandområdeplaner.

**Note on VP3 / EU Water Framework Directive**: The ecological status metrics below originate from the Vandområdeplaner (VP3), which implement the EU Water Framework Directive. The tracker does not report VP3 as a separate goal track — the Green Tripartite's nitrogen target (13,780 T) supersedes VP3's (10,400 T) and uses the same MARS infrastructure. However, Layer 4 provides crucial context: the EU directive ultimately requires ~24,000 T/year reduction, and only 5 of 109 coastal waters currently meet "good ecological status." These outcome metrics tell us whether the Trepart's targets are *sufficient*, not just whether they're being *met*.

| Metric | Definition | Source | Level | Update |
|--------|-----------|--------|-------|--------|
| Nitrogen transport to coast | Tonnes N/year, normalized for precipitation | NOVANA Stoftransport | National/regional | Annual (~12mo lag) |
| Ecological status (streams) | % achieving "good" status (WFD) | Vandplandata.dk | Vandområde | Per plan period |
| Ecological status (lakes) | % achieving "good" combined status | Vandplandata.dk | Vandområde | Per plan period |
| Ecological status (coastal) | # in good ecological status (currently 5/109) | Vandplandata.dk | Vandområde | Per plan period |
| Carbon-rich soil under cultivation | Ha remaining (Kulstof2022 × land use) | MiljøGIS + LandbrugsGIS | National/kommune | Annual |
| Protected nature area | % land/sea protected (target: 20% by 2030) | Natura 2000, §3, DAI | National | Annual |
| Species/biodiversity indicators | Composite from Arter.dk, DOFbasen, NOVANA | Multiple | National | Periodic |

## The "Pace" Indicator

The most important derived metric — answers "er vi på sporet?"

**Calculation**: Linear and exponential projection of current transformation velocity against 2030/2045 deadlines. Visualized as Red/Yellow/Green.

**Method**: Mirrors Klimarådet's approach in their 2026 report, where they explicitly warned that the 2030 climate targets were no longer "anskueliggjort".

**Limitation**: Linear projections underestimate the "hump effect" where large areas transition from multi-year pre-investigations to establishment simultaneously near deadlines.

## Data source priority for "on-track/off-track" assessment

To determine whether implementation is on-track, the tracker needs (in order of importance):

1. **MARS status data** — hectares by project phase (the gap: no public API)
2. **Nitrogen reduction calculations** — MARS model + NKMv2025 retention maps
3. **Environmental baselines** — NOVANA annual data, water body status from Vandplandata
4. **Trend analysis** — self-built time series from periodic snapshots of the above
