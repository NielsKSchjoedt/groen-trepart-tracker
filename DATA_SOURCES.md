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
| Klimaregnskabet / Energistyrelsen | Kommunefordelt CO₂-regnskab (API klar) | CC0-lignende (PSI-loven) | Ja (kildeangivelse)  |
| TRANSFORM / KU+AU+SEGES      | Potentialekort: kvælstof, CO₂, natur (planlagt) | CC0-lignende       | Ja (kildeangivelse)  |
| Arealdata (Miljøportal)     | Biodiversitets- og omlægningskort, DCE+KU+ WFS | CC0-lignende (PSI) | Ja (kildeangivelse)  |
| FVM (geodata.fvm.dk)        | Markkort 2026: marker + Vand, natur & skov 2026 (WFS) | CC0-lignende (PSI) | Ja (kildeangivelse)  |
| SGAV redaktionelt (sgav.dk/groen-trepart) | Officielle forklaringer, FAQ, aftaler, faktaark, deadlines | Offentlig myndighedstekst | Ja (kildeangivelse) |
| Aftaletekster + Rammeaftale MGTP–KL (regeringen.dk, kl.dk) | Trepartsøkonomi: arealfond, jordfordeling, kommunal kapacitetsramme (461,8 mio.) | Offentlig myndighedstekst | Ja (kildeangivelse) |


---

## Detaljerede vilkår / Detailed Terms

### 0. SGAV redaktionelt indhold (sgav.dk/groen-trepart)

**Hvad vi henter**: Tekstindhold fra alle 31 redaktionelle undersider under Den Grønne Trepart (kvælstofregulering, arealomlægning, de 23 lokale treparter, MARS, omlægningsplaner, virkemidler, retentionskort, aftaler, faktaark, § 3, jordopkøb, FAQ) + seneste side af nyhedsarkivet. Gemt som markdown i `data/sgav-content/` med `index.json`.

**Crawl-metode**: `mcp__workspace__web_fetch` for statiske sider; nyhedsarkivet (`/alle-nyheder`) er JS-renderet og kræver browser-rendering. Snapshot: 31. maj 2026.

**Licens**: Offentligt tilgængelig myndighedstekst fra Styrelsen for Grøn Arealomlægning og Vandmiljø.

**Attribution**: "Kilde: Styrelsen for Grøn Arealomlægning og Vandmiljø (sgav.dk)"

**Bemærk**: Dette er den autoritative, officielle forklaring på selve de indsatser trackeren måler (deadlines, satser, kategorisering af oplande, trappemodel, hensigtserklæringer). Bør gen-crawles periodisk, da deadlines og satser opdateres løbende.

---

### 0b. Trepartsøkonomi — aftaletekster + Rammeaftale MGTP–KL

**Hvad vi henter**: Den autoritative finansieringsmodel for Den Grønne Trepart — to
adskilte pengestrømme: (A) projektfinansiering via tilskudsordninger (Danmarks
Grønne Arealfond ≥40 mia., samlet ramme ~43 mia., Novo 10 mia., jordfordeling ~740
mio.) og (B) kommunal administrativ kapacitet (461,8 mio. kr. 2025–2032, fordelt i
fire bloktilskudspuljer). Plus det dokumenterede drift-/plejehul (permanent drift
først *drøftet* efter 2030).

**Kilder**:
- Rammeaftale MGTP–KL (13.12.2024) — kommunal økonomi, tabel 1: [kl.dk](https://www.kl.dk/media/q4sl0qeo/rammeaftale-mellem-ministeriet-for-groen-trepart-og-kl-om-kommunernes-opgaver-i-omlaegningsindsatsen-i-medfoer-af-aftale-om-et-groent-danmark-og-aftale-om-implementering-af-et-groent-danmark.pdf)
- Aftale om et Grønt Danmark (24.6.2024): [regeringen.dk](https://regeringen.dk/media/ng3b13va/aftale-om-et-groent-danmark.pdf)
- Aftale om Implementering af et Grønt Danmark: [regeringen.dk](https://regeringen.dk/media/raehl3jj/aftale-om-implementering-af-et-groent-danmark.pdf)
- KL statusrapport (maj 2026): [kl.dk](https://www.kl.dk/media/00mhx3xi/status-paa-den-kommunale-implementering-af-arealomlaegningsindsatsen-i-groen-trepart.pdf)
- SGAV lavbundsprojekter (100 % EU-dækning): [sgavmst.dk](https://sgavmst.dk/tilskud/tilskud-til-vand-og-klimaprojekter/lavbundsprojekter)

**Licens**: Offentligt tilgængelig myndighedstekst / aftaletekst.

**Attribution**: "Kilde: Aftale om et Grønt Danmark / Rammeaftale MGTP–KL (egen kildegennemgang)"

**Bemærk**: Disse er primærkilder og bør foretrækkes over `mgtp.dk`-forsidelinks i
`data/finansiering/aftaler.json`. Fuld gennemgang i
[docs/data-sources/trepart-oekonomi-finansiering.md](docs/data-sources/trepart-oekonomi-finansiering.md);
implementeringsplan i [docs/design/oekonomi-sektion-plan.md](docs/design/oekonomi-sektion-plan.md).
Tallene er manuelt kuraterede (ikke daglig ETL) — gen-verificér periodisk.

---

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

### 11. Klimaregnskabet / Energistyrelsen — Energi- og CO₂-regnskabet

**Hvad vi henter**: Kommunefordelt drivhusgasudledning, energiforbrug og VE-produktion for alle 98 kommuner — den primære datakilde for CO₂-sporet og kommunevisningen.

**Kilde**: Energistyrelsen via klimaregnskabet.dk (tidl. SparEnergi/Ea Energianalyse).

**URL**: https://klimaregnskabet.dk

**API**: JSON API tilgængelig. Kræver gratis API-nøgle (registrering med navn og email, ingen login).

**API-dokumentation**: https://klimaregnskabet.dk/klimaregnskabet-api
- Datapunktsoversigt (Excel): API_datapunkt_oversigt_v4.1.3_0.xlsx (download fra API-siden)
- Metodenotat: "Metodenotat - Energi- og CO2-regnskabet v.4.1" (PDF)
- Kontakt for API-adgang: info@klimaregnskabet.dk

**Data tilgængelig**:
- **Nøgletal** pr. kommune (samlet CO₂-udledning, pr. capita, pr. areal)
- **Energiresultater** (forbrug, produktion, VE-andel)
- **Udledningsresultater** (CO₂e fordelt på sektorer)
- **Sektorer**: El og fjernvarme, transport, affald, landbrug, industriprocesser
- **Tidsperiode**: 2018–2023
- **Geografi**: Alle 98 kommuner + 5 regioner

**Licens**: Forventet CC0-lignende under PSI-loven. Tjek sparenergi.dk/retningslinjer-for-brug-af-indhold for eksakte vilkår.

**Attribution**: "Kilde: Energi- og CO₂-regnskabet, Energistyrelsen / klimaregnskabet.dk"

**Begrænsning**: Data er ca. 2 år forsinket (seneste tilgængelige: 2023). Opdateres årligt. ~80% af energidata leveres centralt, kommuner udfylder resten. Bruger GPC-standarden (Global Protocol for Community-Scale GHG Inventories).

**Status**: ✅ API klar til integration. Kræver registrering for API-nøgle.

**Kontekst**: Denne datakilde er den samme som bruges af CONCITO/Klimaalliancens monitoreringsystem for kommunernes klimahandling. Se [docs/data-sources/concito-kommunemonitoring.md](docs/data-sources/concito-kommunemonitoring.md) for detaljer.

---

### 12. Arealdata (Miljøportal) — biodiversitets- og omlægningskort

**Hvad vi henter**: WMS-fliser (målretning 30% og TRANSFORM: ny natur, CO₂, kvælstof) til hovedkortet; WFS-udtræk af DCE-forekomster og KU+ CMEC-polygoner (to prioritetsniveauer) til `data/arealdata-biodiversitet/`. Den daglige kørsel bruger DCE som hits-only (`FULL_DCE=0`). Den månedlige spatial-kørsel materialiserer fuldt DCE-udtræk (~83.000 flader) med `--full-dce` og bruger det til kommune-benchmark.

**Kilde / endpoint**: `https://arld-extgeo.miljoeportal.dk/geoserver/ows` (WFS) og WMS `…/wms` (se `src/lib/biodiv-map.ts`).

**Licens**: CC0-lignende (PSI-loven) over Miljøportalens vilkår.

**Attribution**: "Indeholder data fra Danmarks Miljøportal (miljoeportal.dk)"

**Fetch**: `etl/fetch_arealdata_biodiversitet.py`, log: `etl_log` med `source=arealdata-biodiversitet`. Månedlig spatial build: `.github/workflows/spatial-overlay.yml`.

---

### 12b. FVM Markkort — Marker 2026 + Vand, natur & skov 2026

**Hvad vi henter**: GeoJSON af projekter under Vand-, Natur- og skovrejsningsordningen, slimmet til `public/data/vand-natur-skov-projekter-2026.geojson` + resumé med kommune-fordeling (heuristik mod DAWA). Til Sprint 4 henter vi også `Marker:Marker_2026` per kommune-bbox til `data/markkort/marker-2026/<kommunekode>.geojson`, så marker aldrig skal holdes i RAM som nationalt datasæt.

**Kilde / endpoint**: `https://geodata.fvm.dk/geoserver/ows` — lag `GB_og_bioordninger:Vand_Natur_og_Skovprojekter_2026` og `Marker:Marker_2026`.

**Licens**: Offentlige data under FVM; jf. datakatalogs vilkår.

**Fetch**: `etl/fetch_markkort_natur_projekter.py`, log: `fvm-markkort-vns`. Sprint 4 marker-fetch: `etl/fetch_marker2026.py`, log: `markkort-marker-2026`. Kommune-benchmark bygges i `etl/build_kommune_benchmark.py`.

---

### 13. TRANSFORM — potentialekort for arealanvendelse

**Hvad vi planlægger at hente**: Fem potentialekort der viser, hvor i Danmark der er størst potentiale for klima- og miljøindsatser:
1. Kvælstofudvaskning fra marker (hvor lækker mest)
2. CO₂-reduktion fra lavbundsjorder
3. Drikkevandsbeskyttelse (kritiske områder)
4. Naturetablering (potentiale for ny natur)
5. Lav dyrkningsværdi (arealer egnet til omlægning)

**Kilde**: TRANSFORM-projektet (Københavns Universitet, Aarhus Universitet, SEGES Innovation). Finansieret af Novo Nordisk Fonden (37,7 mio. DKK). Projektperiode 2025–2027.

**URL**: Tilgængelig via Danmarks Miljøportals "Synergikort" og databutik.

**Licens**: Forventet CC0-lignende — offentligt tilgængelig via Miljøportalen. Skal bekræftes.

**Status**: WMS-temaer for TRANSFORM (og målretning) er **integreret som valgfri lag** på hovedkortet (Biodiversitet). Fuld vektor-ETL/aggregering pr. kommune er stadig fremadrettet.

**Relevans**: Direkte relevant for eksisterende dashboard — kan sammenholdes med MARS-projektdata: "her er potentialet for kvælstofreduktion — og her er hvad der faktisk er anlagt." Det er et stærkt analytisk narrativ.

---

## Non-profit og uafhængigt / Non-Profit & Independent

Grøn Trepart Tracker er et non-profit, filantropisk projekt. Det er ikke finansieret af nogen organisation, virksomhed eller myndighed, og der er ingen kommercielle interesser bag. Open source betyder, at al kode er åben — non-profit betyder, at der heller ikke er nogen, der tjener penge på det.

This is a non-profit, philanthropic project. It is not funded by any organisation, company, or government agency, and there are no commercial interests involved.

---

## Vores forpligtelse / Our Commitment

- Vi genindsamler al data dagligt via ETL-pipeline (`etl/`) og gemmer rå JSON/GeoJSON i `data/`.
- Vi ændrer aldrig kildedata — kun format (f.eks. GeoJSON → TopoJSON simplificering for websidevisning).
- Hver datahentning logges i `data/etl-log.json` med tidsstempel, endepunkter og antal poster.
- Al kode der henter og transformerer data er open source i dette repository.

