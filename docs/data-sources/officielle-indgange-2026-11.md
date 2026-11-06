# Officielle indgange til trackerens data (undersøgt 6. november 2026)

Baggrund: Efter oplægget hos Forum for Datadistributører (5. nov. 2026) påpegede folk fra bl.a. Danmarks Miljøportal, at flere af de data, trackeren henter via uofficielle veje, findes som officielle tjenester. Denne note samler, hvad der faktisk findes, og om det kan erstatte de nuværende kilder.

Metode: Hele Miljøportalens datakatalog (1.511 datasæt) er hentet via `https://datakatalog.miljoeportal.dk/api/datasets?include=wfsSource,wmsSource,productionSystem,publisher` og gennemsøgt. Relevante WFS-lag er derefter kaldt direkte. Datavejviser er søgt manuelt. Afsnittet "Sammenligning" nederst er lavet ved at hente begge kilder samme dag og sammenligne dem projekt for projekt / vandområde for vandområde / kommune for kommune.

## 1. MARS har en officiel WFS (det vigtigste fund)

`https://mars.sgav.dk/geo/wfs` (GeoServer, ingen nøgle, opdateres hver nat ca. kl. 01). Registreret i Miljøportalens datakatalog med produktionssystem "MARS".

| Lag | Rækker 6/11 | Indhold |
|---|---|---|
| `mars:projekter_samlet` | 1.668 | mars_id (= REST `projectId`), titel, sags_id, areal_ha, tilskudsordning, **status** (klartekst), ansoeger, ansoegningsrunde_aar, **kvaelstofeffekt_t, udtagningseffekt_ha, skovrejsningseffekt_ha**, forundersoegelsestilsagn_dato, etableringstilsagn_dato, anlaegelse_dato, virkemiddel, bemaerkning + geometri |
| `mars:skitseprojekter` | 5.012 | som ovenfor + kystvandgrupperapport |
| `mars:naturpotentialer` | 258 | titel, areal_ha, kystvandgrupperrapport, oprettet_af |
| `mars:projekter_tilskudsordning_skovrejsning` | 1.185 rækker = **540 projekter** | den nationale skovrejsningsordning; én række pr. delpolygon (projektpolygon, tilskudsberettiget areal, lysåbne arealer, urørt skov …) |
| `mars:hensigtserklaeringer` | 278 | hensigtserklæringer (midlertidig ekstensivering m.fl.) |
| `mars:projekter_status_forundersoegelsestilsagn` | 732 | delmængde af projekter_samlet |

Det WFS'en **ikke** har, og som stadig kun ligger i REST-API'et:
- de 37 kystvandgruppeplaner med reduktionsmål og lavbundspotentiale (`/api/status/plans`)
- **fordelingen af hvert projekts/skitses effekt på de kystvandgrupper, det berører** (se sammenligning nedenfor)
- naturpotentialernes overlap med biodiversitet, beskyttet natur, §3 og Natura 2000 (bruges af trackeren)
- MARS' egen kommuneopgørelse (`/api/status/municipality`)
- historik (`projects-history`)

**Skovrejsning – ingen undertælling:** Laget har 1.185 rækker, men kun 540 projekter. Summen 6.250 ha tæller delpolygoner dobbelt; projektpolygonerne summer til 3.263 ha. Trackeren har allerede alle 332 projekter med etableringstilsagn eller anlagt (2.039 ha). De 208 projekter, trackeren ikke har, er alle "Etablering • Ansøgt" (201) eller "Høring • Etablering" (7), i alt 1.224 ha. REST-endpointet `/status/projects` medtager kun projekter fra forundersøgelsestilsagn og frem.

**Datavejviser:** Kun "MARS - National skovrejsning" og "MARS - Naturpotentialer" er videregivet til Datavejviser. "MARS - Projekter samlet" og "Skitseprojekter" findes i Miljøportalens katalog, men ikke i Datavejviser.

## 2. Kommunegrænser (erstatning for DAWA)

DAWA svarer nu 410. `etl/fetch_dawa.py` henter ikke længere, men genskaber det committede udtræk fra 11/9-2026 (99 kommuner inkl. Christiansø).

| Kilde | Lag | Adgang |
|---|---|---|
| Datafordeleren DAGI WFS | `dagi_v001:kommuneinddeling` (1:10.000 og 1:250.000) | Gratis API-nøgle (brugerkonto på datafordeler.dk), ellers HTTP 401 |
| Dataforsyningen DAGI | `DAGI_10MULTIGEOM_GMLSFP_DAF` | Gratis token. Bemærk: Dataforsyningen flytter platform 26.-30. nov. 2026 |
| Plandata (uden nøgle) | `geoserver.plandata.dk/geoserver/ows`, `pdk:theme_pdk_kommuneplan_oversigt_vedtaget_v` | Åben. Samme DAGI-geometri (arealer identiske med DAWA), men 98 kommuner (uden Christiansø), `komnr` som heltal, ingen region/bbox/visuelt center |

## 3. Kulstofkortet (erstatning for pixeltælling)

`https://wfs2-miljoegis.mim.dk/natur/ows`, lag `natur:kulstof2022` (1,70 mio. polygoner; `gridcode` 12 = 6-12 % tørv, 60 = >12 %) samt `natur:kulstof2022_3_6_pct` (1,67 mio., 3-6 %). Vektoriseret 10 m-raster i EPSG:25832.

## 4. Klimaskovfonden: den nuværende kilde ER den officielle

Miljøportalens katalog (og dermed Datavejviser) peger selv på `https://test.admin.gc2.io/ows/klimaskovfonden/public/`, lag `klimaskovfonden:public.klimaskovfondens_projekter`. Trackeren bruger altså allerede den registrerede kilde. Det er ikke et "uofficielt testdomæne", men et officielt endpoint med et uheldigt domænenavn. Metadata siger "opdateres ca. hvert halve år", men laget opdateres reelt oftere.

## 5. Kystvandenes tilstand: nyere officiel version findes

Trackeren bruger `vp3tilstand2021`. Den endelige genbesøgte plan (VP3G, BEK af december 2025) ligger på:
`https://wfs2-miljoegis.mim.dk/vp3_2endelig2025/ows`, lag `vp3_2endelig2025:vp3_2e2025_marin_samlet` (123 vandområder, heraf 109 kystvande, felt `til_oko_sm`).

Fordeling 6/11-2026: ringe 50, moderat 31, dårlig 24, potentiale 4, ikke relevant 14, **god 0**. Ifølge faktaarket er 6 af 109 i god tilstand, hvis nationalt specifikke stoffer ikke medregnes. Trackerens "5 af 109" stammer fra VP3 2021.

Også relevant: `vp3_2e2025_kystvand_opland_afg` (108 kystvandoplande med links til planerne) og indsatslag under `vp3endelig2022`.

## 6. Andre officielle lag, trackeren kunne bruge

| Lag | Endpoint | Rækker 6/11 | Brug |
|---|---|---|---|
| Lavbundsprojekter etableret / forundersøgelser | `geodata.fvm.dk/geoserver/ows`, `Vandprojekter:Lavbund_E_samlet`, `Lavbund_F_samlet` | 135 / 399 | Ældre ordninger (før MARS) |
| Kvælstofvådområder etableret | `Vandprojekter:Kvaelstof_E_samlet` (+ `Kvaelstof_F_samlet`) | 480 | Ældre ordninger |
| Privat skovrejsning ansøgt | `Skovtilsagn:Privat_skovrejsning_ansoegt_{år}` (+ `Biodiversitetsskov_2024/2025`) | – | Historisk privat skovrejsning |
| Urørt skov, tilsagn 2017-2025 | `wfs2-miljoegis.mim.dk/ows`, `skovtilskud:tilsagn{17..25}_st_uroert_skov_v` | fx 15 / 63 / 10 (2017/21/25) | Urørt skov (i dag kun 26 ha i MARS) |
| Permanent ekstensivering, miljøtilsagn | `Miljoe_og_oekologitilsagn:*` | – | Supplement til MARS' ekstensiveringstal |
| Klimalavbundsprojekter (Naturstyrelsen) | `gis.nst.dk/.../Demarkationskort_ekstern/MapServer/WFSServer`, `Klima_lavbund_Demarkation_offentlig` | – | NST's egne lavbundsprojekter |
| Lokale treparter (23 hovedoplande) | `vp3endelig2022:vp3e2022_hovedoplande` | 23 | Bruges allerede |

## 7. Stadig ingen officiel indgang

- **Naturstyrelsens statslige skovrejsning** (projektnavne, status, plantedato): intet lag i Miljøportalens katalog eller Datavejviser. Skrabning + navnematch er fortsat eneste vej.
- **MARS' planer, plan-fordelte effekter og kommuneopgørelse**: kun REST-API'et.
- **Klimarådet og KF26**: PDF og Excel, ingen datatjeneste.

## Sammenligning: kan de officielle kilder erstatte de nuværende?

| Nuværende kilde | Officiel afløser | Kan erstatte? | Samme tal? | Mister vi noget? | Hvad vinder vi? |
|---|---|---|---|---|---|
| MARS REST `/status/projects` (1.666 projekter) | `mars:projekter_samlet` | **Ja** | **Ja, identisk.** Kvælstof 6.428,7 t, udtagning 105.565,8 ha, skov og areal ens for alle fælles projekter; status mapper 1:1 (6→Forundersøgelsestilsagn, 10→Etableringstilsagn, 15→Anlagt). De eneste forskelle skyldes, at lokale data er to dage gamle (2 nye projekter, 3 nyanlagte, 1 justeret areal) | `includedEffectRewetting` (606 projekter), `supplementaryGeometries`, `geoLocationId`, `lastStateChanged`, `applicationTimestamp`. Tjek om de bruges før skift; `lastStateChanged` kan erstattes af fasedatoerne | Dato for hver fase (forundersøgelse, etablering, anlæg), sagsnummer, ansøger (fx kommune), bemærkning, og alle geometrier i ét kald i stedet for 9.205 enkeltkald til `/api/geometries/{id}` |
| MARS REST `/status/plans` (skitser og naturpotentialer indlejret pr. plan) | `mars:skitseprojekter`, `mars:naturpotentialer` | **Nej** | **Nej.** Samme 5.012 skitser, og arealer/udtagning/skov summer ens, men REST fordeler hver skitses kvælstofeffekt på de kystvandgrupper den berører (160 skitser optræder i flere planer). Summen af REST pr. plan er 12.228 t N mod 14.266 t som hele skitser i WFS | Plan-fordelingen af effekter (kernen i kystvandgruppe-fremdriften) og naturpotentialernes overlap med biodiversitet, beskyttet natur, §3 og Natura 2000 | Geometri for skitser og naturpotentialer. Kan bruges *ved siden af* REST til kort |
| MARS REST `/status/plans` (planer, mål) | – | Nej | – | – | – |
| (ingen) | `mars:projekter_tilskudsordning_skovrejsning` | Supplement | – | – | 208 ansøgte skovprojekter (1.224 ha), som i dag er usynlige. Kan vises som en ny "ansøgt"-fase for skov |
| Kulstofkort via WMS-pixeltælling (`build_kommune_ansvar.py`) | `natur:kulstof2022` (WFS) | **Ja, og bør** | **Nej – de nuværende tal er for høje.** Alle pixels med bare lidt farve tælles som fuld 0,25 ha: Lemvig 5.803 ha vs. 1.417 ha i WFS (4,1×), Tønder 30.008 vs. 9.637 (3,1×), Skive 11.807 vs. 4.164 (2,8×), Frederiksberg 58 vs. 3 (20×). Fejlen er ujævn og flytter derfor lavbundsansvar mellem kommuner i kommuneranglisten | Intet væsentligt | Præcise arealer pr. tørveklasse (>12 % kan vægtes for sig), 3-6 %-laget, eksakt klipning til kommuner/planer, overlap med projekter. Pris: ca. 760 MB GeoJSON for hele landet én gang; data er statiske fra 2022, så det kan caches |
| VP3 2021 kystvandstilstand (`fetch_coastal_status.py`, `fetch_water_body_geometries.py`) | `vp3_2endelig2025:vp3_2e2025_marin_samlet` | **Ja** (URL/lagnavn) | **Nej – virkeligheden har ændret sig.** Samme 109 kystvande og navne. 85 uændrede, 9 bedre, 15 værre. Alle 5 "gode" er nu "moderat". Overskriften går fra 5 til **0 af 109**. Uden nationalt specifikke stoffer (afledt som dårligste af fytoplankton, ålegræs, bundfauna, ilt, lys) bliver det præcis **6 af 109**, som i faktaarket. Kemisk god: 11 → 1 | `til_oko_ma` og `til_oko_af`, men de var "Ukendt" for alle 109 i 2021 | Link til vandplandata.dk pr. vandområde, link til undtagelser, mål og risiko for kemisk tilstand, "Ja/Nej" for forlænget frist, og 108 kystvandoplande med links til planerne |
| DAWA kommunegrænser (fastfrosset udtræk) | DAGI via Datafordeler (nøgle) eller Plandata (åben) | **Ja** | **Ja** for 98 kommuner (arealer identiske; samme DAGI-geometri). Christiansø mangler i Plandata | `region`, `bbox`, `visueltcenter` (kan afledes/beregnes) og Christiansø (Plandata) | Kilde der stadig opdateres; ingen afhængighed af en lukket tjeneste |
| Klimaskovfonden (`test.admin.gc2.io`) | Samme | Allerede officiel | – | – | Kun formuleringen skal rettes (Data & metode) |

## Status (6. november 2026)

Gennemført i samme ændring som denne note: kulstofberegningen bruger WFS (punkt 1), kystvandstilstand er VP3G (punkt 2), MARS-projekter og -geometrier hentes fra WFS med REST som reserve (punkt 3), kommunegrænser hentes fra DAGI (Datafordeler med nøgle, ellers Plandata) med DAWA-arkivet som reserve (punkt 5), og formuleringen om Klimaskovfonden er rettet (punkt 6). Tilbage: ansøgte skovprojekter i frontend (punkt 4) og visning af de nye fasedatoer pr. projekt.

## Forslag til prioritering

1. **Ret kulstofberegningen** i `build_kommune_ansvar.py` til WFS. Det er en fejl i de viste tal (kommunernes lavbundsansvar), ikke kun en kildeforbedring, og skal i ændringsloggen som fejlrettelse.
2. **Opdatér kystvandstilstand til VP3G** og vis "0 af 109 (6 uden nationalt specifikke stoffer)" med forklaring. Fjern makroalge-indikatoren. Metodeændring i ændringsloggen.
3. **Skift `/status/projects` + geometrier til `mars:projekter_samlet`**. Behold REST for planer, skitser og naturpotentialer. Brug fasedatoerne til tidslinjer.
4. **Vis ansøgte skovprojekter** fra `mars:projekter_tilskudsordning_skovrejsning` som tidlig fase.
5. **Kommunegrænser** fra Datafordeler-DAGI (gratis nøgle som GitHub-secret) eller Plandata uden nøgle + Christiansø fra arkivet.
6. Ret formuleringen om Klimaskovfonden (kilden er officiel) i Data & metode.
