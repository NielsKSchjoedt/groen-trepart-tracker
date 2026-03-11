# Data Gaps Research — Multi-Pillar Dashboard

This document maps the data readiness for each of the five pillars of the Green Tripartite agreement and details what research is needed to close the gaps.

## Pillar data readiness summary

| # | Pillar | Danish name | Target | Status | Source | Gap |
|---|--------|-------------|--------|--------|--------|-----|
| 1 | Nitrogen | Kvælstofreduktion | 13.780 T/year | **Complete** | MARS plans + vos | None |
| 2 | Extraction | Lavbundsarealer | 140.000 ha | **Complete** | MARS plans + projects | Sparse per-catchment data (only 1/23 non-zero) |
| 3 | Afforestation | Skovrejsning | 250.000 ha | **ETL gap (fixed)** | MARS plans + vos | Only 49 ha tracked — see section 4 |
| 4 | CO₂ | Klimaindsats | 1,8M tonnes CO₂e | **Fundamental gap** | None | No outcome data in any source |
| 5 | Nature | Natur & biodiversitet | 20% protected land | **Partial** | MARS nature potentials | 20% target needs Natura 2000 + §3 data |

## 1. CO₂ pillar — fundamental research needed

### The target

The Green Tripartite commits to reducing agricultural greenhouse gas emissions by 1.8 million tonnes CO₂e per year by 2030. This is primarily driven by the carbon tax on agricultural emissions (CO₂-afgift på landbrug) taking effect 2030, with a rate of DKK 300/tonne CO₂e rising to DKK 750/tonne by 2035.

### Why no data exists

The carbon tax hasn't started. There is currently no public reporting mechanism for agricultural CO₂ emissions at a project or geographic level. MARS tracks nitrogen reduction, extraction, and afforestation — but not CO₂ emissions.

### What MARS does have (indirect/proxy)

- `requiredCarbonOverlapPercentage` on subsidy schemes (e.g. "SGAV Klima-Lavbund" requires 60% overlap with carbon-rich soil)
- `extractionEffortDependsOnCarbon` flag on mitigation measures
- References to `urn:dmp:ds:kulstof-2022-lavbundskort` (carbon soil map dataset)
- Subsidy scheme descriptions mentioning "klima", "kulstof", "drivhusgasser"

These are eligibility rules, not outcome measurements.

### Proxy metrics available now

| Source | Metric | Latest value | Type |
|--------|--------|-------------|------|
| DST FOND19 | Spending on "CO₂ reducerende formål" | 667–676 Mio. kr/year (2022-2023) | Input (money spent) |
| DST TILSKUD2 | "Klima og miljøvenligt græs" subsidies | 235–347 Mio. kr/year | Input (money spent) |

These measure money invested, not tonnes reduced.

### Sources to investigate

1. **Energistyrelsen (Danish Energy Agency)** — Publishes *Klimastatus og -fremskrivning* (climate projections) annually. May have agricultural emissions forecasts. Website: [ens.dk](https://ens.dk)
2. **DCE / Aarhus University** — Publishes the national emissions inventory (UNFCCC reporting) and annual greenhouse gas inventories for agriculture. Website: [dce.au.dk](https://dce.au.dk)
3. **Klimarådet (Danish Council on Climate Change)** — Annual status reports on sectoral targets. Website: [klimaraadet.dk](https://klimaraadet.dk)
4. **EU ETS / LULUCF reporting** — Denmark's land use, land use change, and forestry emissions data
5. **Skatteministeriet** — The carbon tax implementation timeline and any early reporting frameworks

### Recommended interim approach

Show DST spending as a proxy indicator ("DKK investeret i CO₂-reduktion") with a clear caveat that outcome data awaits the carbon tax implementation in 2030. The dashboard stub message should explain this.

### Open questions

- Will MARS add a CO₂/carbon metric when the carbon tax starts?
- Does SGAV plan to track CO₂ reductions per project alongside nitrogen?
- Is there a public API for Energistyrelsen's climate projections?
- Could the "carbon overlap" percentages from MARS subsidy schemes be used to estimate CO₂ impact from extraction projects?

## 2. Nature pillar — 20% protected target needs new fetcher

### What we have now

MARS provides `totalNaturePotentialAreaHa` per plan and per catchment (nature project potential areas). National total: ~240,646 ha. This is now surfaced in the dashboard.

### What the 20% target actually means

20% of Denmark's land and sea area designated as protected nature by 2030. This includes:
- Natura 2000 areas (designated under EU Habitats and Birds Directives)
- §3-protected nature types (designated under Danish Nature Protection Act / Naturbeskyttelsesloven)
- New designations from the tripartite agreement

### Why MARS nature potential ≠ the 20% metric

Nature potential area measures where nature *projects* could happen — not where land is *legally protected*. A catchment with high nature potential doesn't mean it has high protected area coverage.

### Data sources for protected area percentage

| Source | Dataset | Access | Notes |
|--------|---------|--------|-------|
| MiljøGIS WFS | Natura 2000 boundaries | Public, WFS at `miljoegis.mim.dk` | Referenced in `docs/data-sources/miljoeportal-apis.md` |
| Danmarks Miljøportal / Arealdata.dk | §3-protected nature types | Public, dataset `urn:dmp:ds:beskyttede-naturtyper` | Already referenced in MARS master-data subsidy scheme overlaps |
| DST ARE207 | Total land area | Already fetched | ~42,951 km² (denominator for percentage) |

### Implementation path

1. Build `etl/fetch_natura2000.py` to fetch Natura 2000 boundaries via MiljøGIS WFS
2. Build `etl/fetch_section3.py` to fetch §3-protected areas via Arealdata.dk
3. Compute total protected area (handling overlaps between the two datasets)
4. Derive percentage against total land area from ARE207
5. Add to dashboard data as `national.progress.protectedNaturePct`

Estimated effort: 1–2 days.

### Open questions

- Do Natura 2000 and §3 areas overlap significantly (risk of double-counting)?
- Is there a pre-computed "total protected area" statistic published by Miljøstyrelsen?
- Does the 20% target include marine protected areas? If so, what is the denominator (land + EEZ)?
- Is there a per-municipality breakdown of protected area?

## 3. Afforestation geographic sparsity

### The situation

The national target is 250,000 ha of new forest by 2045. MARS only reports 48.9 ha across 3 plans (Århus Bugt og Begtrup Vig: 13.7 ha, Kattegat Læsø: 27.4 ha, Nordlige Kattegat Ålbæk Bugt: 7.9 ha).

### Possible explanations

- Afforestation projects may be tracked in different systems (Naturstyrelsen, Klimaskovfonden) rather than MARS
- The 250,000 ha target includes private and municipal afforestation not registered in the MARS project pipeline
- Many afforestation projects may still be at sketch/planning stage with 0 ha established

### Sources to investigate

1. **Klimaskovfonden** — MARS references `urn:dmp:ds:klimaskovfondens-projekter` in its demarkation checks. The fund likely has its own project registry.
2. **Naturstyrelsen (NST)** — Runs national afforestation programs, may publish project-level data
3. **DST SKOV1** — Forest area by municipality and tree type, but only 1990 and 2000 data (table is inactive since 2002)
4. **Miljøstyrelsen** — May publish newer forest inventory data

### Open question

Is 49 ha genuinely all that's been afforested under the Trepart so far, or is MARS simply not the right source for tracking afforestation progress?

---

*Last updated: March 2026*
