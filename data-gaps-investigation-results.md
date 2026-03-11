# Data Gaps Investigation Results

**Date:** 11 March 2026
**Status:** Research complete — actionable findings for all three pillars

---

## Executive Summary

The three data gaps identified in the original research document have been investigated. Here are the headline findings:

- **CO₂ pillar:** No project-level outcome data exists yet (as expected), but KF25 sector datasheets from the Ministry provide national-level agricultural emission forecasts through 2050. DCE/Aarhus publishes the official inventory. Proxy data via DST remains the best interim option.
- **Nature pillar (20% target):** Denmark currently protects ~15% of its terrestrial area. The WFS endpoints for both Natura 2000 and §3 data are confirmed working and publicly accessible. Building the fetchers is straightforward.
- **Afforestation:** MARS's 49 ha is a tiny fraction — Klimaskovfonden alone tracks **249 afforestation projects** covering **2,871 ha**. Their data is now available via Danmarks Miljøportal's Arealdata WFS. MARS is simply not the primary source for afforestation tracking.

---

## 1. CO₂ Pillar — Detailed Findings

### Available Data Sources

#### Klimastatus og -fremskrivning (KF25/KF26)
The Ministry of Climate, Energy and Utilities publishes annual climate projections with sector-by-sector emission forecasts. KF25 (published 2025) includes:

- Sector chapters 18–32 with agricultural emissions data
- Downloadable datasheets (dataark) with CRF tables and energy balance
- Forecasts through 2050, broken down by emission source

KF25 shows Denmark expects to meet its 2030 target with a 1.5M tonne margin (reversed from a 1.5M tonne shortfall in KF24). Agricultural measures — especially the carbon tax — are a key driver.

**Access:** Downloadable Excel/PDF from [kefm.dk/klima/klimastatus-og-fremskrivning](https://www.kefm.dk/klima/klimastatus-og-fremskrivning/klimastatus-og-fremskrivning-2025). No public API exists — data is in spreadsheet form.

#### DCE — Danish Centre for Environment and Energy (Aarhus University)
DCE maintains the official Danish agricultural emission inventory using the IDA model (Integrated Database for Agricultural emissions). This covers CH₄, N₂O, NH₃, and PM from livestock and crop production.

Key reports:
- Scientific Report No. 572 (latest comprehensive report)
- Scientific Report No. 108 (foundational methodology documentation)
- Gyldenkærne & Callisen (2024): emission estimates for organic soils 1990–2022 and projections 2023–2040

**Important finding:** DCE researchers revised the estimate of carbon-rich agricultural soils downward significantly in 2023, which has major implications for the tripartite's extraction targets.

#### Klimarådet (Danish Council on Climate Change)
Klimarådet's Statusrapport 2026 (published February 2026) provides the most up-to-date assessment:

- Agriculture remains the **highest risk factor** for hitting the 2030 target
- Estimated that agriculture could deliver 1.1M additional tonnes CO₂e beyond the government's projection
- Key risks: carbon-rich soil extraction may underperform by ~700,000 tonnes, biogas sector may emit 300,000 tonnes more than projected, uncertainty around livestock feed supplements (Bovaer uptake lower than expected)
- Overall verdict: the 70% target for 2030 is now considered achievable, but fragile

**Access:** Full reports downloadable from [klimaraadet.dk](https://klimaraadet.dk/da/rapport/statusrapport-2026)

### Recommendation for Dashboard

**Short term (now):** Continue using DST FOND19/TILSKUD2 spending data as proxy. Add KF25 sector forecast data as a "projected trajectory" line — this gives a government-sourced emission reduction pathway even without actual measurements.

**Medium term (when available):** DCE's updated inventory data could be fetched annually when published. No API, but the reports follow a consistent publication schedule.

**Answer to open questions:**
- *Will MARS add a CO₂ metric?* — No indication this is planned. MARS remains focused on nitrogen, extraction, and afforestation.
- *Is there a public API for Energistyrelsen's projections?* — No. Data is distributed as downloadable spreadsheets and PDFs only.
- *Could carbon overlap percentages estimate CO₂ impact?* — Only very roughly. The overlap percentages are eligibility thresholds, not emission reduction estimates. DCE's soil-specific emission factors would be needed for any credible calculation.

---

## 2. Nature Pillar — Protected Area Data

### Current State

Denmark currently protects approximately **15% of its terrestrial area**:
- **Natura 2000 sites:** ~9% of terrestrial area (252 designated sites, covering 3,591 km²)
- **Nationally designated sites** (including §3): the remaining ~6%

The tripartite target of **20%** therefore requires roughly a 5 percentage point increase, or approximately 2,150 km² of additional protected land.

### Confirmed Data Access Points

#### Natura 2000 Boundaries — MiljøGIS WFS
The WFS endpoint is live and accessible:

```
https://wfs2-miljoegis.mim.dk/ows?service=wfs&version=1.0.0&request=GetCapabilities
```

- **Format:** GeoServer WFS (OGC standard)
- **CRS:** EPSG:25832 (ETRS89 / UTM zone 32N)
- **Layers available:** Bird protection areas (Fuglebeskyttelse), habitat areas (habitatområder), Ramsar areas, Natura 2000 composite boundaries, protected forests (fredskov), coastal protection
- **Natura 2000 plan-specific WFS:**
  ```
  https://wfs2-miljoegis.mim.dk/np3h2021/ows?service=wfs&version=1.1.0&request=GetCapabilities
  ```
- **Map viewer:** [miljoegis.mim.dk/cbkort?profile=miljoegis-natura2000](https://miljoegis.mim.dk/cbkort?profile=miljoegis-natura2000)
- **Download page:** [mst.dk — Hent data udstillet på MiljøGIS](https://mst.dk/erhverv/tilskud-miljoeviden-og-data/data-og-databaser/miljoegis-data-om-natur-og-miljoe-paa-webkort/hent-data-udstillet-paa-miljoegis)

#### §3-Protected Nature Types — Danmarks Miljøportal / Arealdata
Available via Arealdata's WFS services. The dataset `urn:dmp:ds:beskyttede-naturtyper` (already referenced in MARS) is accessible through:

```
https://arealdata.miljoeportal.dk/
```

WFS/WMS services are documented at [support.miljoeportal.dk](https://support.miljoeportal.dk/hc/da/articles/360001248778-Webservices-Arealinformation-WFS-services-og-download-af-temaer-fra-Danmarks-Arealinformation).

### Implementation Plan (Confirmed Feasible)

The original document's implementation path is validated:

1. **`etl/fetch_natura2000.py`** — Query `wfs2-miljoegis.mim.dk` for Natura 2000 composite boundaries. Standard OGC WFS `GetFeature` request. Output as GeoJSON.
2. **`etl/fetch_section3.py`** — Query Arealdata WFS for `beskyttede-naturtyper`. Same approach.
3. **Overlap computation** — Natura 2000 and §3 areas *do* overlap (Natura 2000 sites often contain §3 habitats within them). A spatial union operation is needed to avoid double-counting. This can be done with `geopandas.overlay()`.
4. **Percentage calculation** — Divide total unique protected area by ARE207 land area (42,951 km²).

**Estimated effort:** 1–2 days as originally stated. The data access is confirmed straightforward.

### Answers to Open Questions

- *Do Natura 2000 and §3 areas overlap?* — **Yes, significantly.** Many §3 habitats (heaths, bogs, meadows) are located within Natura 2000 sites. A spatial union/dissolve is essential.
- *Is there a pre-computed total?* — The EEA reports ~15% but doesn't break down the methodology in a machine-readable way. Building from source data is more reliable and auditable.
- *Does the 20% target include marine areas?* — The tripartite agreement specifies "land and sea area." For the terrestrial component, the denominator is land area only. Marine protected areas would need separate data (which MiljøGIS also provides).
- *Per-municipality breakdown?* — Yes, achievable by spatial intersection of protected area polygons with municipality boundaries (also available as WFS from Dataforsyningen).

---

## 3. Afforestation — MARS Is Not the Right Source

### Key Finding

MARS's 49 ha represents only a sliver of Danish afforestation activity. **Klimaskovfonden alone tracks 249 afforestation projects covering 2,871 ha**, with 979,352 tonnes CO₂e sequestered over time. MARS is simply not where afforestation is primarily tracked.

### Klimaskovfonden Data

Klimaskovfonden maintains a comprehensive **Klimaregister** (Climate Registry) with the following fields per project:

| Field | Description |
|-------|-------------|
| Project number | Unique identifier |
| Project type | Skovrejsning (afforestation) or Lavbund (lowland extraction) |
| Municipality | Geographic location |
| Establishment date | When project was started |
| Project period | Duration |
| Area (ha) | Hectares covered |
| Expected CO₂ (tonnes) | Projected sequestration |
| Buffer allocation | Risk buffer for non-delivery |
| Tradeable CO₂ units | Available for voluntary carbon market |
| Status | Project lifecycle stage |
| Third-party validator | External verification entity |
| Number of contributors | Funding sources |

**Access:** The registry is viewable via a Power BI dashboard at [klimaskovfonden.dk/vores-standard/register](https://klimaskovfonden.dk/vores-standard/register). No direct API to the registry itself.

**However**, the geospatial project data is now available through **Danmarks Miljøportal's Arealdata** system:
- Dataset: "Klimaskovfondens projekter"
- Access: WFS/WMS via [arealdata.miljoeportal.dk](https://arealdata.miljoeportal.dk/)
- Announced in 2025 as a new addition to the data catalog

### Other Sources

- **Naturstyrelsen (NST):** Runs national afforestation programs but no structured public data registry found
- **DST SKOV1:** Forest area by municipality — but inactive since 2002, only 1990 and 2000 data
- **Miljøstyrelsen:** Newer forest inventory data may exist but not found as structured/downloadable datasets

### Recommendation

1. **Build a fetcher for Klimaskovfonden data via Arealdata WFS** — this gives geographic project boundaries, area, and type
2. **Supplement with Klimaregister scraping or manual data entry** for the CO₂ and status fields not in the WFS layer
3. **Keep MARS afforestation data** as a secondary signal but do not treat it as the primary source
4. **Investigate Naturstyrelsen** further — their projects represent the state-funded afforestation pipeline and may surface via Arealdata or direct contact

### Answer to Open Question

*Is 49 ha genuinely all that's been afforested under the Trepart?* — **No.** Klimaskovfonden alone has 2,871 ha across 249 projects. The 49 ha in MARS likely represents only the projects that happen to intersect with MARS's nitrogen/extraction planning catchments. MARS is a water quality planning tool, not an afforestation tracker.

---

## Summary of Recommended Actions

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **High** | Build Natura 2000 + §3 fetchers for Nature pillar | 1–2 days | Enables the 20% target metric |
| **High** | Build Klimaskovfonden/Arealdata fetcher for afforestation | 1 day | Jumps from 49 ha to 2,871+ ha tracked |
| **Medium** | Download KF25 agricultural emission datasheets for CO₂ trajectory | 0.5 days | Adds government forecast to dashboard |
| **Medium** | Add spatial overlap handling for Natura 2000 ∩ §3 | Included in fetcher build | Prevents double-counting |
| **Low** | Investigate Naturstyrelsen for additional afforestation data | 0.5 days | May add state-funded projects |
| **Low** | Monitor DCE annual inventory publication for actual emission data | Ongoing | Future-proofs CO₂ pillar |

---

*Research conducted: 11 March 2026*
