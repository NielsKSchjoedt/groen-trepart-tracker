# Ændringslog

> **Auto-genereret** fra [`src/lib/changelog.json`](src/lib/changelog.json). Rediger ikke denne fil direkte.
> Tilføj nye versioner i `src/lib/changelog.json` og kør `mise run changelog`.

Her dokumenterer vi alle væsentlige ændringer til dette website og de data det viser.

**Gennemsigtighedsprincip:** Fejlrettelser og korrektioner dokumenteres med mindst samme prominens som nye funktioner. Hvis vi opdager en fejl i et tal, en beregning eller en visning, beskriver vi klart hvad der var forkert og hvad der er rettet. Det er ikke pinligt at have fejl — det er uigennemsigtigt ikke at sige det højt.

**Sproget her er skrevet til alle** — journalister, borgere og interesserede. Tekniske detaljer fremgår som sekundære noter i parentes.

---

## Ikke frigivet endnu

Kommende ændringer noteres her løbende.

---

## v0.9.2 — 17. marts 2026

**Forklaring tilføjet på kommunekortet: CO₂-data dækker kun frem til 2023**

### Forbedring
- Når CO₂ er valgt på kommunekortet, vises nu en gul informationsboks over kortet. Den forklarer at tallene dækker frem til 2023, at nyere tal kan være undervejs, og linker til Concito / Klimaalliancens dybere kommunale klimamonitorering med 16 omstillingsindikatorer pr. kommune.
---

## v0.9.1 — 17. marts 2026

**CO₂-siden er ryddet op: kort og tabel skjult, link til kommunekort gjort tydeligt**

### Forbedring
- Når CO₂-søjlen er valgt, vises kortet og vandoplande-tabellen ikke længere — de viste begge kun en besked om at data ikke er tilgængeligt på det niveau. Siden er nu renere og fokuseret på det der faktisk er relevant: de nationale KF25-tal.
- Linket til kommunekortet med CO₂-data pr. kommune er nu en tydelig knap nederst i CO₂-sektionen i stedet for en lille tekst gemt væk i en overskrift.
---

## v0.9.0 — 17. marts 2026

**To fejl i automatisk dataopdatering rettet: §3-natur og CO₂ opdaterede aldrig**

### Fejlrettelse
- Tallene for beskyttet natur pr. kommune (§3-arealer) opdaterede aldrig — de viste de tal der lå fra første kørsel og ændrede sig ikke. Fejlen skyldtes at beregningen af §3-arealer pr. kommune blev permanent sprunget over, hvis filen allerede fandtes. Rettet: den geografiske fordeling genberegnes nu ugentligt. (Teknisk: betingelse i fetch_section3.py ændret fra "spring over hvis fil eksisterer" til "spring over hvis fil er under 7 dage gammel".)
- CO₂-fremskrivningen fra KF25 opdaterede aldrig automatisk, selv når Energistyrelsen udgiver nye tal. Scripterne til at hente KF25-kildefilerne og bygge CO₂-data manglede i den daglige workflow. Rettet. (Teknisk: fetch_kf25.py og build_co2_data.py tilføjet til GitHub Actions.)

### Forbedring
- Den daglige automatiske datahentning kørte kun en delmængde af alle datakilder — projektgeometrier (kortpolygoner), Natura 2000, §3-natur, Klimaskovfonden, fredskov og Naturstyrelsen-skov manglede alle. Nu kører alle 12 datakilder automatisk hver morgen. Projektgeometrier hentes kun for nye projekter, så kørslen forbliver hurtig. (Teknisk: fetch_geometries.py, fetch_natura2000.py, fetch_klimaskovfonden.py, fetch_naturstyrelsen_skov.py, fetch_section3.py og fetch_fredskov.py tilføjet til GitHub Actions workflow.)
---

## v0.8.0 — 17. marts 2026

**Ny ETL-sundhedsindikator: se om den daglige datahentning lykkedes**

### Fejlrettelse
- Den daglige automatiske datahentning (GitHub Actions) fejlede ved hvert kørsel med en push-fejl — data blev hentet korrekt, men ændringerne kunne ikke gemmes fordi branch protection-reglerne kræver pull requests. Rettet: botten opretter nu automatisk en pull request og merger den selv. (Teknisk: GH013-fejl ved direkte push til main.)

### Ny funktion
- Siden "Data og metode" viser nu en 30-dages historik over den automatiske datahentning. En række farvede felter — grøn, gul eller rød — afslører med et blik om alle datakilder blev hentet korrekt den pågældende dag. Hold musen over et felt for at se, hvilke kilder der lykkedes og hvilke der evt. fejlede.

### Forbedring
- Den daglige kørsel tog op til 38 minutter på grund af gentagen geokodning af ~6.500 projekter via DAWA's API. Nu caches resultatet mellem kørsler, så kun nye projekter geokodes. Typisk kørselstid reduceret til få minutter.
---

## v0.7.0 — 17. marts 2026

**CO₂-data pr. kommune: for første gang kan du se, hvor meget din kommune udleder**

### Ny funktion
- CO₂-udledning er nu tilgængelig for alle 98 kommuner med faktiske tal — ikke estimater. Kortet farvelægger nu kommunerne efter total CO₂e-udledning (2023), og klik på en kommune viser sektorfordeling (energi, transport, landbrug, affald, industri) samt udviklingen fra 2018 til 2023. (Kilde: Energi- og CO₂-regnskabet, Energistyrelsen / klimaregnskabet.dk)
- National CO₂-oversigt er udvidet med en liste over de kommuner, der udleder mest og mindst — med direkte link til kommunekortet.

### Dataopdatering
- 588 datakald til Klimaregnskabets API hentede data for alle 98 kommuner for årene 2018–2023. Alle kald gennemført uden fejl. Tallene er verificeret mod kildedata for Aalborg og Kalundborg: nøjagtig overensstemmelse (0 afvigelse).
---

## v0.6.0 — 17. marts 2026

**Ekspertfeedback indarbejdet — bedre beskrivelse af datakildernes begrænsninger**

### Forbedring
- Vi har talt med fagfolk hos Miljøstyrelsen og Danmarks Miljøportal og opdateret vores dokumentation. Den beskriver nu mere præcist, hvad tallene dækker — og hvad de ikke dækker.
---

## v0.5.0 — 16. marts 2026

**Ny "Data og metode"-side lanceret. Sitet er nu offentligt.**

### Ny funktion
- En ny side forklarer for hvert tal på dashboardet: præcist hvor data kommer fra, hvordan det behandles, og hvilke forbehold der gælder. Alt er open source — alle kan verificere hvert beregning. ([link](https://github.com/NielsKSchjoedt/groen-trepart-tracker/pull/29))
- En ny illustration viser, hvordan data rejser fra officielle registre til det tal du ser på skærmen.

### Fjernet
- Sitet var beskyttet med et kodeord mens det blev bygget. Kodeordet er nu fjernet — alle kan tilgå sitet frit.
---

## v0.4.0 — 15. marts 2026

**Nyt kommunekort: se fremgangen i din kommune**

### Ny funktion
- Interaktivt kort over alle 98 kommuner, farvekodet efter fremgang på de valgte mål. Klik på en kommune for at se detaljer. ([link](https://github.com/NielsKSchjoedt/groen-trepart-tracker/pull/28))

### Forbedring
- Projektfasernes navne og farver var ikke konsistente på tværs af siden. Nu er "godkendt", "forundersøgelse" og de øvrige faser altid vist ens, uanset hvor man ser dem.
---

## v0.3.0 — 14. marts 2026

**Bedre navigation og kortinteraktion. CO₂-data tilføjet.**

### Ny funktion
- Fast navigationsbar øverst på siden, som følger med når du scroller. Giver hurtig adgang til alle søjler.
- Dato for seneste datahentning vises nu tydeligt — du kan altid se hvornår tallene sidst er opdateret.
- Fremgangsmålerne har fået et farvesignal der viser om et mål er "på sporet", "forsinket" eller "ukendt".
- CO₂-data er nu tilgængeligt i datatabellen med forklaringstekst.

### Forbedring
- Kortet på forsiden er nu nemmere at bruge på mobiltelefon: detaljer vises i et panel der glider op fra bunden af skærmen.

### Dataopdatering
- Daglig automatisk datahentning er kørt.
---

## v0.2.0 — 12. marts 2026

**Første rigtige data hentet. Automatisk daglig opdatering sat op.**

### Ny funktion
- Tallene opdateres nu automatisk hver morgen kl. 06:00 fra de officielle registre (MARS-systemet, MiljøGIS og kommunedata).
- Sitet publiceres automatisk til internettet ved hver opdatering via Cloudflare Pages.

### Dataopdatering
- Første rigtige datahentning gennemført: 1.164 projekter, 37 kystvandsgruppe-planer, 23 vandoplande og data for alle 98 kommuner.
---

## v0.1.0 — 11. marts 2026

**Første version af dashboardet lanceret**

### Fejlrettelse
- Tal og etiketter på fremgangsmålerne overlappede hinanden og var svære at læse. Rettet i flere omgange. (Teknisk: SVG viewBox og label-position justeret.)
- Fremgangsmålernes bue blev klippet af ved kanten og så ufuldstændig ud. Rettet ved at give buen mere plads. (Teknisk: viewBox padding øget.)
- Kortet kunne ikke vises pga. en inkompatibilitet med kortbiblioteket. Løst ved at skifte til en enklere kortintegration. (Teknisk: migreret fra react-leaflet til plain Leaflet.)
- Kortet crashede ved opstart pga. en intern kollision i sidens kode. Rettet.

### Ny funktion
- Dashboard med 5 fremgangsmålere for de centrale mål i aftalen: kvælstof, skov, lavbundsjord, vandløb og beskyttet natur. Nedtælling til 2030-deadline.
- Interaktivt kort over Danmark med kommunegrænser.
- Visualisering af projektpipeline — fra skitse til gennemført projekt.
- Fremskrivning mod 2030-målet baseret på det faktiske tempo, med interaktivt scenarieværktøj.
---

## v0.0.0 — 1. januar 2025

Projektskabelon oprettet. Ingen funktionel release.
