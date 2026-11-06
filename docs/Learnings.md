# Learnings — Den Grønne Trepart Tracker

Working scratchpad for domain insights, data source discoveries, and corrections.
Entries here are reviewed periodically and consolidated into the structured docs in `docs/`.

See `.skills/learning-loop/SKILL.md` for the process.

---

### 2026-09-11 [DOMAIN] — Water goal is legal WFD status, not a postponement to 2028

- **Detail**: God økologisk tilstand in all 109 coastal waters is a legal target under Lov om vandplanlægning § 7 stk. 2 nr. 2; the latest deadline in § 10 stk. 3 is 22 December 2027. Extensions are per water body (§§ 10–11), not a national one-year political postponement. BEK 1670 of 8 Dec 2025 is the current plan instrument. The tripartite delivers tonnes of N; those tonnes are necessary but not sufficient for good ecological status. Do not write “politically postponed to 2028” without a sourced legal change.
- **Context**: DN-feedback publication round (F1). Closed by reading the statute rather than treating an unverified meeting note as source.
- **Confidence**: high
- **Action**: Surfaced on the vand-kort in `src/lib/model.ts` and Data & metode. Consolidate into `docs/domain/overview.md` / metrics-taxonomy when next reviewing those docs.

### 2026-09-11 [METRICS] — Nature pipeline is lavbund + all afforestation; nitrogen wetlands are out

- **Detail**: Nature projects are `Lavbundsprojekter` + `Skovrejsning` (all schemes, including those sited for climate/nitrogen). Excluded: kvælstofvådområder, minivådområder, ekstensivering, fosforvådområder, øvrige, Forundersøgelse VLP. Show lavbund vs skov as a delta. Documented urørt skov is 26.22 ha on 9 SGAV Skovrejsning projects (type id `434633e0-4241-4f38-b451-f2b45b70ebd4`) — an undercount because Privat Skovrejsning / NST have no geometry type for it. Count unique project ids (a project in several coastal catchments is one project). Overlap threshold for the nature-overlap story is > 0.1 ha; also show the unthresholded count.
- **Context**: DN-feedback F5/F16. Fresh MARS snapshot 2026-09-11: 1,668 unique projects, 917 in the nature pipeline.
- **Confidence**: high
- **Action**: Encoded in `src/lib/nature-projects.ts` and `etl/nature_projects.py`. Keep the two files in sync.

### 2026-09-11 [METRICS] — Project × nature overlap is place-specific, not an unconditional good

- **Detail**: 15.3 % protected nature on the national card is the OECD 2024 estimate, not our GIS union of §3 + N2000. Project overlap with DCE 30 % is a different number (562/861 nature-pipeline geometries above 0.1 ha in the current overlap file). Overlap can mean a project sitting on already-protected land. MARS keeps subsidy area out of registered §3. Unlike 1 t CO₂, nature outcomes are not additive across space.
- **Context**: DN-feedback F7. NatureStatusCard label was previously “korrigeret for ~30 % overlap”.
- **Confidence**: high
- **Action**: UI copy on NatureStatusCard + Data & metode overlap section. Do not call overlap a strong positive indicator.

### 2026-09-11 [DATA-SOURCE] — Marker_2026 slim files currently lack Afgkode

- **Detail**: B3 (farmland in terrestrial Natura 2000) should use MARS `fieldDatasetConfigurations` crop-code exclusions as the headline when Afgkode is on the features. The local `data/markkort/marker-2026/*.geojson` cache only stores `sourceId`, `marknummer`, `area_ha_estimate` — no Afgkode — so the current published B3 figure is still all crops. `slim_feature` now keeps Afgkode; a `--force` refetch of Marker_2026 is required before the MARS-comparable variant can run. Denominator remains Natura 2000 only (§3 excluded). Overlap threshold language for B3 is hectares of Markkort ∩ N2000, not a shipped intersection GeoJSON.
- **Context**: DN-feedback B3/4b. Probed 99 local marker files on 2026-09-11.
- **Confidence**: high
- **Action**: Re-fetch Marker_2026 (or a propertyName=Afgkode sidecar) then rerun `etl/build_kommune_benchmark.py`. Until then, keep the honesty note in B3 UI.

### 2026-03-11 [DOMAIN] — VP3 and the Green Tripartite are not separate tracking targets

- **Detail**: The Green Tripartite's nitrogen target (13,780 T) incorporates and supersedes the Vandområdeplaner (VP3) target (10,400 T). They track the same tonnes of nitrogen through the same MARS infrastructure. The Trepart adds CO2, land conversion, afforestation, and biodiversity goals that VP3 didn't cover. Reporting VP3 separately would double-count nitrogen and confuse users. However, the EU Water Framework Directive requires ~24,000 T — important context to show on the site.
- **Context**: User realized their original 2021 interest in sea nutrient reduction (algae, eutrophication) predated the Green Tripartite and was actually about the VP3/Landbrugsaftalen 2021. Discussion clarified the relationship.
- **Confidence**: high
- **Action**: ✅ Consolidated — added "Regulatory context" section to `docs/domain/overview.md`, updated Layer 4 note in `docs/domain/metrics-taxonomy.md`

### 2026-03-11 [DOMAIN] — Landbrugsaftalen 2021 voluntary measures mostly failed

- **Detail**: The 2021 agricultural agreement relied heavily on voluntary measures for nitrogen reduction. By 2024, only ~154 T/year had been achieved through voluntary agreements — against a 10,400 T target. This failure built political pressure for the tripartite negotiations and the shift to binding regulation + CO2 tax.
- **Context**: Discovered during web research on VP3 history while answering user's question about pre-Trepart commitments.
- **Confidence**: high
- **Action**: ✅ Consolidated into `docs/domain/overview.md` regulatory context section

### 2026-03-11 [DOMAIN] — Only 5 of 109 Danish coastal waters meet "good ecological status"

- **Detail**: As of early 2026, only 5 of Denmark's 109 coastal water bodies meet "good ecological status" under the EU Water Framework Directive. This is a key piece of context for the tracker — even achieving the Trepart's 13,780 T target may not be sufficient.
- **Context**: Found in search results about VP3 and the Water Framework Directive.
- **Confidence**: high
- **Action**: ✅ Referenced in `docs/domain/overview.md` and `docs/domain/metrics-taxonomy.md`
