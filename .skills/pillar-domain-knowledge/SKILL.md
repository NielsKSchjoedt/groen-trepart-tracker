---
name: pillar-domain-knowledge
description: >
  Domain knowledge and policy rules for Denmark's Green Tripartite Agreement (Grøn Trepart).
  Use this skill whenever working on the groen-trepart-tracker project and you need to understand
  the environmental context — what the pillars are, where the targets come from, how metrics are
  computed, what the governance hierarchy looks like, or what the Danish terminology means. Trigger
  whenever someone mentions nitrogen reduction, wetland extraction, afforestation targets, nature
  protection, coastal water plans, VP3, MARS projects, municipalities, catchments, or the overall
  Grøn Trepart political agreement. Even general questions like "what does this dashboard track?"
  or "why is this number so low?" benefit from this domain context.
---

# Pillar Principles & Domain Knowledge — Grøn Trepart Tracker

This skill provides the environmental policy context, governance structure, and domain knowledge
needed to make sound decisions when working on the Grøn Trepart Tracker. Understanding the "why"
behind the data is just as important as the technical implementation.

## The Green Tripartite Agreement (Grøn Trepart)

In December 2023, the Danish government signed the Green Tripartite Agreement — a landmark deal
between the government, agricultural organizations, and environmental groups. It commits Denmark to
significant environmental targets across 5 pillars, primarily to meet EU Water Framework Directive
requirements and national climate goals.

The agreement was driven by the fact that Denmark's intensive agriculture contributes heavily to
nitrogen pollution of waterways and coastal areas, leading to oxygen depletion and ecological damage.

**Political context:** This is a *political agreement*, not legislation. The targets can change with
new governments or renegotiation. The dashboard should note this.

---

## The Five Pillars

### 1. Kvælstof (Nitrogen Reduction)

**Target:** ~13,780 tons N/year reduction by 2027 (the most urgent deadline)
**Why:** Nitrogen runoff from agriculture causes eutrophication — algal blooms that deplete oxygen
and kill marine life in Danish coastal waters. Denmark has been in violation of EU Water Framework
Directive requirements for years.

**How it's measured:**
- MARS tracks ~1,200 mitigation projects (wetlands, buffer zones, mini-wetlands, etc.)
- Each project has a modelled nitrogen reduction effect (NKMv2025 model)
- The 13,780-ton target is distributed across 37 coastal water group plans (kystvandoplaner)
- Each coastal water group has its own sub-target based on local conditions

**What the projects actually are:**
- **Vådområder** (wetlands) — constructed wetlands that filter nitrogen before it reaches waterways
- **Lavbundsarealer** (low-lying areas) — rewetting of drained farmland
- **Minivådområder** (mini-wetlands) — smaller constructed wetlands on individual farms
- **Skovrejsning** (afforestation) — trees reduce nitrogen leaching from the soil
- **Udtagning** (set-aside) — taking farmland out of production

**The phase problem:** Most of the reported nitrogen reduction is from projects still in the
investigation phase. Only projects with status "Anlagt" (established/built) have any real-world
effect. This is the most important insight the dashboard provides.

### 2. Lavbundsarealer (Extraction / Rewetting)

**Target:** 140,000 hectares by 2030
**Why:** Drained low-lying areas (former wetlands, bogs) are major carbon emitters and nitrogen
sources. Rewetting them reduces both CO₂ emissions and nitrogen runoff.

**How it's measured:**
- MARS tracks extraction area (hectares) per project
- The `extractionEffortHa` field on each project
- Phase breakdown applies here too — planned extraction ≠ actual extraction

### 3. Skovrejsning (Afforestation)

**Target:** 250,000 hectares of new forest by 2045
**Why:** Forests sequester carbon, reduce nitrogen leaching, and provide biodiversity habitat.
Denmark is one of Europe's least forested countries.

**How it's measured:**
- **Baseline:** Fredskov (legally protected forest) — ~532,000 hectares of land designated as
  forest under Danish law. This is the legal baseline, not a measure of actual tree cover.
- **New forest:** Measured as forest area above the fredskov baseline using the digital forest map.
- **Klimaskovfonden (live WFS):** ~2,300 ha across 210 afforestation projects, fetched from
  `test.admin.gc2.io` WFS endpoint. ETL: `etl/fetch_klimaskovfonden.py`.
- MARS projects also track `afforestationEffortHa` (but only water-quality-related projects).
- **Naturstyrelsen / SGAV:** State afforestation and the national subsidy scheme (~2,100 ha
  approved Feb 2026) — not yet integrated. Subsidy applications go through MARS.

**Important nuance:** The 250,000 ha target means 250,000 ha of *new* forest — on top of what
already exists. The fredskov figure is the starting point, not progress toward the goal.

### 4. CO₂ (Carbon Reduction)

**Target:** 1,800,000 tons CO₂e/year reduction by 2030
**Why:** Agriculture accounts for ~21% of Denmark's greenhouse gas emissions. The agreement targets
both direct emissions (livestock, fertilizer) and indirect ones (drained organic soils).

**Data status:** Currently no data source feeds this pillar. The dashboard shows a placeholder.
Future data sources may include the Danish National Inventory Report or DST statistics.

### 5. Natur (Nature Protection)

**Target:** 20% of Denmark's land area protected by 2030 (EU Biodiversity Strategy)
**Why:** Denmark has very little protected nature compared to its EU peers. The agreement aims to
expand both strict protection and general nature areas.

**How it's measured:**
- **Natura 2000:** EU-designated protection areas (~250 sites). Mix of terrestrial and marine.
  Marine sites are excluded from the land percentage calculation using a heuristic classification.
- **§3 areas:** National protection under Naturbeskyttelsesloven §3 (~186,628 polygons). Covers
  heathland, bogs, meadows, salt marshes, and lakes.
- **Overlap correction:** Natura 2000 and §3 areas overlap significantly. A conservative ~30%
  overlap is deducted from the combined total. Precise spatial union would require GIS tooling.

**Formula:**
```
protected_land_pct = (natura2000_terrestrial + section3_total - estimated_overlap) / denmark_land_area × 100
```

---

## Governance Hierarchy

Understanding the geographic hierarchy is essential for interpreting the data:

```
Denmark (Nation)
├── 4 Vanddistrikt (Water Districts)
│   └── 23 Hovedvandoplande (Main Catchments)
│       └── 37 Kystvandoplande (Coastal Water Groups) — each has a VP3 plan with nitrogen targets
│           └── 108 Delopland (Sub-catchments)
└── 98 Kommuner (Municipalities) — cross-cutting, linked via spatial overlap
```

**Vandplaner (Water Plans):** Denmark's third-generation water plans (VP3, 2021-2027) set targets
for each coastal water group. These are the basis for the nitrogen reduction targets in the dashboard.

**Why 37 plans matter:** The national target of ~13,780 tons is not a single goal — it's the sum of
37 local targets, each calibrated to the ecological needs of a specific coastal water body. Some
coastal waters need much more reduction than others. The per-plan view shows whether effort is being
allocated where it's most needed.

**Municipalities** don't map cleanly to catchments. A municipality may span multiple catchments, and
a catchment may include parts of multiple municipalities. The dashboard handles this via spatial
overlap (GeoJSON intersection).

---

## Key Computed Metrics

These metrics are derived from the raw data and help users understand progress:

1. **Pace indicator** = `completed_value / ((now - start) / (deadline - start))`
   Ratio > 1 means ahead of schedule. Most pillars are far behind.

2. **Pipeline coverage** = `pipeline_value / target_value`
   How much of the target is at least *planned* (including preliminary projects).

3. **Conversion rate** = `completed_value / pipeline_value`
   What fraction of planned projects actually get built. Historically very low.

4. **Nitrogen gap** = `target - current_pipeline_nitrogen_effect`
   Tons of nitrogen reduction still unaccounted for in any plan.

5. **Municipal participation** = municipalities with ≥1 project / 98
   Shows geographic spread of effort.

6. **Combined protected area** = Natura 2000 terrestrial + §3 areas − estimated overlap
   Compared against 20% land area target.

---

## MARS Project Lifecycle

MARS tracks 18 possible project statuses. The dashboard groups these into 3 phases:

| Phase | MARS Status | Danish Name | Real-world meaning |
|-------|-------------|-------------|--------------------|
| **Preliminary** | 6 | Forundersøgelsestilsagn | Investigation money granted. Consultant is studying whether the project is feasible. No construction, no environmental effect. |
| **Approved** | 10 | Etableringstilsagn | Construction approved and funded. Work may or may not have started. No guaranteed environmental effect yet. |
| **Established** | 15 | Anlagt | Physically built and operational. This is the only phase with actual environmental impact. |

All other status codes (there are 15 more) are mapped to "preliminary" as a conservative default.

**Why this matters for the dashboard:** If you show "3,446 tons N reduced" without context, it
sounds like significant progress (27% of target). But only ~26 tons comes from built projects.
The rest is aspirational. The phase breakdown is the single most important feature of this dashboard.

---

## Data Quality Principles

1. **Show the uncertainty.** Environmental data is messy. Models have error margins. Estimates
   overlap. The dashboard should acknowledge this — not with academic precision, but with honest
   disclaimers that a concerned citizen can understand.

2. **Don't overcount.** When Natura 2000 and §3 areas overlap, subtract. When marine areas inflate
   the terrestrial percentage, exclude them. When a project is in preliminary study, don't count it
   as "achieved."

3. **Source everything.** Every number should link back to a public data source. This is an
   open-source project tracking public commitments with public data. Transparency is the point.

4. **Update regularly.** Data should be refreshed via the ETL pipeline at least daily. Stale data
   undermines trust. The `fetchedAt` timestamp should be prominently displayed.

5. **Danish context first.** The dashboard is primarily for Danish citizens, journalists, NGOs, and
   policymakers. Use Danish terminology in the UI, Danish date formats, and references that a Danish
   audience would recognize.

---

## Acronyms & References

- **VP3** — Vandområdeplan 3 (Water Area Plan, 3rd cycle, 2021-2027)
- **MARS** — Miljøstyrelsens Arealregister (Environmental Protection Agency's Area Register)
- **NOVANA** — Det Nationale Overvågningsprogram for Vandmiljø og Natur (national monitoring program)
- **NKMv2025** — Nitrogen calculation model, version 2025
- **DST** — Danmarks Statistik
- **DAWA** — Danmarks Adressers Web API
- **WFD** — EU Water Framework Directive
- **PSI-loven** — Danish law on reuse of public sector information
- **Fredskov** — Legally protected forest under Skovloven
- **§3** — Section 3 of Naturbeskyttelsesloven (Nature Protection Act)
