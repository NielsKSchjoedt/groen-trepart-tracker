# Datakilder og licenser / Data Sources & Licenses

Denne side dokumenterer alle datakilder, deres licenser, og de attributionskrav vi overholder.

This page documents all data sources, their licenses, and the attribution requirements we follow.

---

## Oversigt / Overview


| Kilde                        | Data                                      | Licens                   | Attribution påkrævet |
| ---------------------------- | ----------------------------------------- | ------------------------ | -------------------- |
| MARS / Danmarks Miljøportal  | Kvælstofreduktion, projekter, vandoplande | CC0-lignende (PSI-loven) | Ja (kildeangivelse)  |
| DAWA / Klimadatastyrelsen    | Kommunegrænser, adresser                  | CC0                      | Anbefalet            |
| Danmarks Statistik           | Arealanvendelse, skovstatistik, tilskud   | CC BY 4.0                | **Ja (påkrævet)**    |
| MiljøGIS / Naturstyrelsen    | VP3-vandoplande, kystvande (WFS)          | CC0-lignende (PSI-loven) | Ja (kildeangivelse)  |
| MiljøGIS / Miljøstyrelsen    | Vådområder, kvælstofretention             | CC0-lignende (PSI-loven) | Ja (kildeangivelse)  |
| MiljøGIS / Naturstyrelsen    | Natura 2000-områder (terrestrisk/marin)   | CC0-lignende (PSI-loven) | Ja (kildeangivelse)  |
| MiljøGIS / Naturstyrelsen    | §3-beskyttet natur (heder, moser m.fl.)   | CC0-lignende (PSI-loven) | Ja (kildeangivelse)  |
| MiljøGIS / Naturstyrelsen    | Fredskov + digitalt skovkort 2022         | CC0-lignende (PSI-loven) | Ja (kildeangivelse)  |
| VanDa / Danmarks Miljøportal | Vandovervågningsstationer                 | Uafklaret — se note      | —                    |
| Klimaskovfonden (WFS)        | Frivillige skovrejsnings- og lavbundsprojekter | CC0-lignende        | Ja (kildeangivelse)  |
| Naturstyrelsen Skov (WFS)    | Statslige skovrejsningsprojekter          | CC0-lignende (PSI-loven) | Ja (kildeangivelse)  |
| SparEnergi / Ea Energianalyse| Kommunefordelt CO₂-regnskab (planlagt)    | CC0-lignende             | Ja (kildeangivelse)  |


---

## Detaljerede vilkår / Detailed Terms

### 1. MARS (mars.sgav.dk) — Danmarks Miljøportal

**Hvad vi henter**: Projektdata, kvælstofreduktionsmål, vandoplandsaggregater, kystvandgruppeplaner.

**Licens**: Data stilles til rådighed under vilkår svarende til CC0/CC-BY, i henhold til PSI-loven (Lov om videreanvendelse af den offentlige sektors informationer).

**Attribution**: "Indeholder data fra Danmarks Miljøportal (miljoeportal.dk)"

**Vilkår**: [miljoeportal.dk/dataansvar/vilkaar-for-brug](https://miljoeportal.dk/dataansvar/vilkaar-for-brug/)

**Begrænsninger**: Data må ikke bruges på en måde, der antyder at Danmarks Miljøportal anbefaler eller støtter brugeren eller brugerens produkter.

---

### 2. DAWA (api.dataforsyningen.dk) — Klimadatastyrelsen

**Hvad vi henter**: Kommune- og regionsdata, kommunegrænser (GeoJSON).

**Licens**: CC0 (Public Domain Dedication) — ingen ophavsretlige begrænsninger.

**Attribution**: "Indeholder data fra Klimadatastyrelsen (dataforsyningen.dk)" — anbefalet men ikke juridisk påkrævet under CC0.

**Vilkår**: [dawadocs.dataforsyningen.dk](https://dawadocs.dataforsyningen.dk/dok/om)

---

### 3. Danmarks Statistik (api.statbank.dk)

**Hvad vi henter**: ARE207 (arealanvendelse), SKOV1 (skovstatistik), FOND19 (fonde), TILSKUD2 (tilskudsordninger).

**Licens**: **CC BY 4.0** (Creative Commons Attribution 4.0 International)

**Attribution** (PÅKRÆVET):

> Kilde: Danmarks Statistik, [tabelnavn]. [https://statistikbanken.dk/[tabel-ID]](https://statistikbanken.dk/[tabel-ID])

**Vilkår**: [dst.dk/da/presse/kildeangivelse](https://www.dst.dk/da/presse/kildeangivelse)

**Note**: CC BY 4.0 kræver kildeangivelse ved enhver brug. Vores afledte data (CSV-filer i `data/dst/`) inkluderer denne reference.

---

### 4. MiljøGIS WFS (wfs2-miljoegis.mim.dk)

**Hvad vi henter**: VP3 2025 vandoplande (23 hovedoplande), kystvandoplande (108 delopland), vandprojektlag.

**Licens**: CC0-lignende vilkår under PSI-loven.

**Attribution**: "Indeholder geodata fra Naturstyrelsen / Miljøstyrelsen (miljoegis.mim.dk)"

**Vilkår**: [naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata](https://naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata)

---

### 5. Natura 2000 beskyttede områder (wfs2-miljoegis.mim.dk/natur)

**Hvad vi henter**: Natura 2000-områdernes afgrænsninger (`natur:natura_2000_omraader`, ~250 features) med arealangivelser.

**Licens**: CC0-lignende vilkår under PSI-loven.

**Attribution**: "Indeholder geodata fra Naturstyrelsen (miljoegis.mim.dk)"

**Vilkår**: [naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata](https://naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata)

**Begrænsninger**: Natura 2000-data inkluderer både marine og terrestriske områder. Vi skelner vha. navnebaseret heuristik — præcis opdeling kræver spatiel overlay med kystlinje. Marine områder (Kattegat, Skagerrak, Vadehavet m.fl.) er meget store og ville ellers oppuste det terrestriske areal.

---

### 6. §3-beskyttede naturtyper (wfs2-miljoegis.mim.dk/natur)

**Hvad vi henter**: Alle §3-beskyttede naturarealer (`natur:ais_par3`, ~186.000 features) — heder, moser, enge, strandenge, overdrev, søer.

**Licens**: CC0-lignende vilkår under PSI-loven.

**Attribution**: "Indeholder data om §3-beskyttet natur fra Naturstyrelsen/Miljøstyrelsen (miljoegis.mim.dk)"

**Vilkår**: [naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata](https://naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata)

**Begrænsninger**: §3-arealer overlapper betydeligt med Natura 2000. Simpel addition overvurderer det samlede beskyttede areal. Overlap-fradrag beregnes i `build_dashboard_data.py` med et konservativt estimat (30% overlap-antagelse), da præcis spatial union kræver GIS-værktøj.

---

### 7. Skovdata — fredskov og skovkort (wfs2-miljoegis.mim.dk)

**Hvad vi henter**: To lag:
- `np3basis2020:np3b2020_fredskov` (~60.000 features) — matrikler med fredskovspligt (juridisk baseline).
- `skovdrift:digitalt_skovkort_2022` (~62.000 features) — digitalt skovkort der viser aktuel skovdækning.

**Licens**: CC0-lignende vilkår under PSI-loven.

**Attribution**: "Indeholder geodata fra Naturstyrelsen (miljoegis.mim.dk)"

**Vilkår**: [naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata](https://naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata)

**Begrænsninger**: Fredskov repræsenterer den juridiske baseline. Det nationale skovrejsningsmål (250.000 ha ny skov inden 2045) bør måles som nyt skovareal udover denne baseline. Skovkortet har kun geometrier uden arealattributter.

---

### 8. VanDa (vanddata.dk)

**Hvad vi henter**: Vandovervågningsstationer (lokationer og metadata).

**Licens**: ⚠️ **Ikke eksplicit publiceret**. VanDa hører under Danmarks Miljøportal og formodes at følge samme vilkår, men dette er ikke bekræftet.

**Status**: Vi har kun hentet stationslister (lokationer og navne) som er offentligt tilgængelige. Inden eventuel udvidelse med måledata bør vilkår bekræftes med Danmarks Miljøportal ([miljoeportal@miljoeportal.dk](mailto:miljoeportal@miljoeportal.dk)).

---

## Dansk lovgivning / Danish Legal Framework

Al data i dette projekt stammer fra danske offentlige myndigheder og er underlagt:

- **PSI-loven** (Lov om videreanvendelse af den offentlige sektors informationer) — tillader videreanvendelse af offentlige data til både kommercielle og ikke-kommercielle formål.
- **Digitaliseringsstyrelsens anbefaling**: Offentlige data bør som udgangspunkt stilles til rådighed under CC0-licens.
- Kilde: [digst.dk/data/videreanvendelse-af-offentlige-data](https://digst.dk/data/videreanvendelse-af-offentlige-data/licens-og-brugsvilkaar-for-offentlige-data/)

---

### 9. Klimaskovfonden (test.admin.gc2.io)

**Hvad vi henter**: Frivillige skovrejsnings- og lavbundsprojekter (~213 features, ~2.314 ha) med polygon-geometrier.

**Licens**: CC0-lignende — offentligt WFS-endpoint.

**Attribution**: "Indeholder data fra Klimaskovfonden (klimaskovfonden.dk)"

**Detaljer**: Se [docs/data-sources/data-provenance.md](docs/data-sources/data-provenance.md)

---

### 10. Naturstyrelsen — Statslig skovrejsning (wfs2-miljoegis.mim.dk/skovdrift)

**Hvad vi henter**: Naturstyrelsens arealoversigt matchet mod kendte skovrejsningsprojekter (~30 projekter, ~4.100 ha).

**Licens**: CC0-lignende vilkår under PSI-loven.

**Attribution**: "Indeholder geodata fra Naturstyrelsen (miljoegis.mim.dk)"

**Vilkår**: [naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata](https://naturstyrelsen.dk/om-naturstyrelsen/brugervilkaar-for-geodata)

---

### 11. SparEnergi — Energi- og CO₂-regnskabet (planlagt datakilde)

**Hvad vi planlægger at hente**: Kommunefordelt drivhusgasudledning, energiforbrug og VE-produktion — den primære datakilde for kommunevisningen.

**Kilde**: Ea Energianalyse for Energistyrelsen.

**URL**: https://sparenergi.dk/forbruger/vaerktoejer/energi-og-co2-regnskabet

**Licens**: Forventet CC0-lignende under PSI-loven — skal bekræftes.

**Status**: ⚠️ Endnu ikke integreret i ETL. Planlagt som del af kommune-feature (se [KOMMUNE-FEATURE-SPEC.md](KOMMUNE-FEATURE-SPEC.md)).

**Begrænsning**: Data er ca. 2 år forsinket (seneste tilgængelige: 2022).

**Kontekst**: Denne datakilde er den samme som bruges af CONCITO/Klimaalliancens monitoreringsystem for kommunernes klimahandling. Se [docs/data-sources/concito-kommunemonitoring.md](docs/data-sources/concito-kommunemonitoring.md) for detaljer om Concitos 16 omstillingsindikatorer og potentielle samarbejde.

---

## Vores forpligtelse / Our Commitment

- Vi genindsamler al data dagligt via ETL-pipeline (`etl/`) og gemmer rå JSON/GeoJSON i `data/`.
- Vi ændrer aldrig kildedata — kun format (f.eks. GeoJSON → TopoJSON simplificering for websidevisning).
- Hver datahentning logges i `data/etl-log.json` med tidsstempel, endepunkter og antal poster.
- Al kode der henter og transformerer data er open source i dette repository.

