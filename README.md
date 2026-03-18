# Den Grønne Trepart — Er vi på sporet?

Danmark har gjort noget ret fantastisk.

I juni 2024 satte regering, landbrug og miljøorganisationer sig sammen og blev enige om den største landskabsforandring i Danmark i over 100 år: *Aftale om et Grønt Danmark*. 140.000 hektar kulstofrig lavbundsjord skal udtages inden 2030. 250.000 hektar ny skov inden 2045. 13.800 ton kvælstof mindre i vores vandmiljø hvert år. Bakket op af 43 milliarder kroner.

Det er et kæmpe løfte til naturen — og til hinanden.

Men store politiske aftaler har det med at drukne i kompleksitet. 23 lokale trepartsudvalg, 98 kommuner, 37 kystvandgrupper, tusindvis af projekter spredt over MARS-platformen, MiljøGIS, DAWA og et utal af statslige systemer. Det er ikke fordi nogen gemmer noget — tværtimod. Danmark har en fantastisk tradition for åbne data og gennemsigtig forvaltning. Men selv med åbne API'er og offentlige registre er det svært at danne sig et overblik over, om vi faktisk er på sporet.

Det er det, denne tracker forsøger at løse.

Vi samler data fra de offentlige systemer ét sted — åbent, gennemsigtigt og tilgængeligt — så borgere, journalister og forskere kan følge med. Tænk SSI's COVID-dashboards, men for den grønne omstilling. Håbet er, at gennemsigtighed kan skabe den fremdrift og ansvarlighed, der skal til for at indfri vores fælles løfte om at give naturen i Danmark tilbage.

**Hjemmeside:** [treparttracker.dk](https://treparttracker.dk) (kommer snart)

## Baghistorien

I juni 2023 skrev jeg en mail til Danmarks Naturfredningsforening med en idé: hvad med en vandmiljø-tracker — en simpel single-page hjemmeside, der løbende holder regeringen op på sine egne mål? Progress bars, burndown-grafer, sort på hvidt. Jeg tilbød at bidrage med IT-udvikling.

Dengang blev det ved idéen. Hverdagen som iværksætter var fuld nok i forvejen, og et projekt som dette kræver tid til at grave sig ned i datakilderne, forstå det politiske landskab og bygge noget, der faktisk virker.

Så kom den grønne trepart — og pludselig var idéen mere relevant end nogensinde. Og så kom AI.

## Hvor AI, open source og natur mødes

Det her projekt er der, hvor tre ting jeg brænder for mødes.

**Natur - der er værd at passe på.** Danmark er et smukt land. Hvem end man er — om man vandrer i Mols Bjerge, fisker ved Gudenåen, eller bare nyder en stille morgen ved Limfjorden — så ved man det. Der er så meget skønhed i vores natur, og vi er nødt til at passe bedre på den. Den grønne trepart er et løfte om at gøre netop det. Dette projekt handler om at sikre, at løftet bliver holdt.

**AI - der gør det muligt.** AI er det mest betydningsfulde skift i hvordan software bliver bygget siden internettet. Vi bevæger os fra en fase, hvor AI hjælper med at skrive kode hurtigere, til en fase, hvor AI fundamentalt ændrer hvad det betyder at bygge ting. Den vigtigste kompetence er ikke prompting — det er *context engineering*: at strukturere problemer så AI kan løse dem godt. Det gør ikke ingeniører mindre vigtige, tværtimod — men rollen ændrer sig. Man bliver arkitekten, smagsdommeren, den der ved *hvad* der skal bygges og *hvorfor*. I 2023 havde jeg ikke tid og ressourcer til at bygge denne tracker. I 2026 har AI gjort det muligt for én person at gøre research i 17 offentlige datakilder, bygge en ETL-pipeline, designe et dashboard og skrive 1.600 linjer dokumentation — på en uge. Det er ikke fremtiden. Det er nu.  
  
**Open source - der giver os ejerskab.** Demokrati er gennemsigtighed — og open source er gennemsigtighed og tillid i sin fineste form. Vi har i Danmark en fantastisk tradition for åbne data og offentlig forvaltning. At myndighederne stiller data til rådighed via åbne API'er er langt fra en selvfølge — det er noget vi kan være stolte af, og noget der gør et projekt som dette muligt. Open source er ikke bare en måde at bygge software på — det er en måde at bygge samfund på. Tænk hvis centrale systemer som skat eller sundhed var åben kildekode, frit tilgængelige for alle at inspicere, finde fejl i og forbedre. Vi har set hvad der sker når det *ikke* fungerer — Amanda, Polsag, Sundhedsplatformen, Rejsekortet, EFI — og vi har set lande som Rumænien respondere på lignende fiaskoer ved at åbne op for open source-samarbejde med borgerne. Danmark kan gå foran her.

Disse tre ting — kærligheden til dansk natur, troen på open source som demokratisk værktøj, og AI's nye muligheder — det er det, der driver dette projekt.

## Non-profit og uafhængigt

Grøn Trepart Tracker er et non-profit, filantropisk projekt. Det er ikke finansieret af nogen organisation, virksomhed eller myndighed, og der er ingen kommercielle interesser bag. Open source betyder, at al kode er åben — non-profit betyder, at der heller ikke er nogen, der tjener penge på det. Projektet eksisterer udelukkende for at skabe transparens om den grønne omstilling i Danmark.

## Centrale mål


| Mål                                        | Omfang                              | Frist        |
| ------------------------------------------ | ----------------------------------- | ------------ |
| Lavbundsjord udtaget/genvædet              | 140.000 ha (inkl. bufferzoner)      | 2030         |
| Ny skov                                    | 250.000 ha                          | 2045         |
| Kvælstofreduktion (kollektive virkemidler) | 13.800 ton N/år                     | 2027+        |
| Vandløbsrestaurering                       | 7.500 km + 1.500 spærringer fjernet | VP3-perioden |
| Beskyttet natur                            | 20% af landarealet                  | 2030         |


## Kom i gang

### Forudsætninger

- [mise](https://mise.jdx.dev/) — værktøjsmanager til Python og Node
- [GDAL](https://gdal.org/) — valgfrit, til koordinatprojektion af kystvanddata

### Installation

```bash
git clone https://github.com/NielsKSchjoedt/groen-trepart-tracker.git
cd trepart-tracker
mise install            # installerer Python 3.12 + Node 22
mise run setup          # installerer topojson CLI-værktøjer globalt
```

Valgfrit, til kystvandkort:

```bash
brew install gdal       # macOS
# eller: apt install gdal-bin   # Ubuntu
```

### Kør lokalt

```bash
mise run dev            # serverer siden på http://localhost:8080
```

## Projektstruktur

```
src/                        React + TypeScript frontend
  components/                 Dashboard-komponenter (kort, grafer, paneler)
  lib/                        Data-loading, typer og hjælpefunktioner
  pages/                      Sider (Index.tsx er hoveddashboardet)
etl/                        Datapipeline
  fetch_mars.py               Hent projektfremdrift fra MARS REST API
  fetch_dawa.py               Hent kommunedata + GeoJSON-grænser
  fetch_dst.py                Hent statistik fra Danmarks Statistik
  fetch_miljoegis.py          Hent projektgeometrier fra MiljøGIS WFS
  fetch_vanda.py              Hent vandkvalitetsdata fra VanDa API
  fetch_geometries.py         Hent projektpolygoner fra MARS /api/geometries
  fetch_kf25.py               Hent KF25 klimadata (Excel) fra KEFM
  build_dashboard_data.py     Byg frontend-klar JSON fra rå MARS-data
  build_co2_data.py           Byg CO₂-udledningsdata fra KF25 CRF-tabeller
  fetch_all.sh                Kør alle fetchere
  prepare_map_data.sh         Konvertér GeoJSON → TopoJSON til kortet
data/                       Hentet data (committet til git for gennemsigtighed)
  mars/                       MARS API-svar (projekter, planer, oplande)
  dawa/                       Kommunedata + grænser
  kf25/                       KF25 klimadata (Excel-filer fra KEFM)
  geo/                        Processerede kortfiler (TopoJSON)
  dashboard-data.json         Samlet datafil til frontend
public/data/                Statiske datafiler serveret til browseren
docs/                       Dokumentation
  domain/                     Hvad aftalen handler om
  data-sources/               Hvor data kommer fra
  architecture/               Hvordan vi bygger det
```

## Opgaver

Alle opgaver er defineret i `mise.toml` og køres med `mise run <opgave>`:


| Opgave        | Beskrivelse                                          |
| ------------- | ---------------------------------------------------- |
| `setup`            | Installér npm-afhængigheder (topojson CLI-værktøjer)         |
| `fetch-data`       | Hent seneste data fra alle API'er + byg dashboard-data.json  |
| `build-dashboard`  | Byg dashboard-data.json fra rå MARS-data (uden fetch)        |
| `prepare-map`      | Konvertér GeoJSON → TopoJSON til frontend-kort               |
| `changelog`        | Regenerér CHANGELOG.md og synkronisér versionsnummer fra `src/lib/changelog.json` |
| `dev`              | Start Vite dev-server på http://localhost:8080               |

**Ændringslog:** Rediger kun `src/lib/changelog.json` og kør `mise run changelog` — `CHANGELOG.md` og versionsnummeret i footeren opdateres automatisk.


## Datapipeline

Data hentes dagligt af en GitHub Actions workflow (`.github/workflows/fetch-data.yml`, kører kl. 06:00 UTC) og committes til repoen. Alle Python-fetchere bruger kun standardbiblioteket — ingen pip-afhængigheder.

1. **Hent** — Python-scripts trækker fra offentlige API'er (MARS, DAWA, MiljøGIS, Danmarks Statistik, KEFM)
2. **Gem** — Rå JSON/Excel-svar lægges i `data/` og committes til git
3. **Saml** — `build_dashboard_data.py` kombinerer MARS-data til én frontend-klar fil; `build_co2_data.py` bygger CO₂-udledningsdata fra KF25
4. **Kortdata** — `prepare_map_data.sh` konverterer 114 MB kommune-GeoJSON til ~300 KB TopoJSON
5. **Geometrier** — `fetch_geometries.py` henter projektpolygoner fra MARS API (inkrementelt, ~6.500 geometrier)

## Datakilder


| Kilde                                            | Autentificering | Hvad den leverer                           |
| ------------------------------------------------ | --------------- | ------------------------------------------ |
| [MARS REST API](https://mars.sgav.dk)            | Ingen           | Projektfremdrift, kvælstofmål, oplandsdata |
| [DAWA API](https://api.dataforsyningen.dk)       | Ingen           | Kommunegrænser + metadata                  |
| [MiljøGIS WFS](https://miljoegis.mim.dk)         | Ingen           | Projektgeometrier, kystvandgrænser         |
| [Danmarks Statistik](https://statistikbanken.dk) | Ingen           | Befolkning, arealanvendelse                |
| [VanDa API](https://miljoeportal.dk)             | OAuth2          | Vandkvalitetsovervågning (fremtidig)       |
| [KF25 (KEFM)](https://www.kefm.dk/klima/klimastatus-og-fremskrivning/klimastatus-og-fremskrivning-2025) | Ingen | CO₂-udledninger, LULUCF, landbrug (1990–2050) |


Se `docs/data-sources/` for detaljeret dokumentation af hver kilde.

## Bidrag

Det her er et åbent projekt, og alle bidrag er velkomne — store som små. Du behøver ikke være udvikler for at hjælpe.

- **Kode** — forbedre datapipeline, tilføje nye datakilder, bygge frontend-features
- **Domæneviden** — kender du det politiske landskab, vandplanerne eller de lokale trepartsudvalg? Din viden er guld værd
- **Data** — hjælp med at finde nye åbne datakilder eller opdage fejl i vores metrikker
- **Design** — vi vil gerne lave noget folk *vil* dele — idéer til visualiseringer og brugeroplevelse er meget velkomne
- **Spred ordet** — jo flere øjne på fremdriften, jo bedre

### Tekniske noter for udviklere

- Python-fetchere bruger kun stdlib (`urllib`, `json`, `csv`) — undtagen `build_co2_data.py` som kræver `openpyxl` til Excel-parsing
- Geografisk data bruger EPSG:25832 (dansk UTM) internt, reprojiceret til EPSG:4326 (WGS84) til web
- Data committes til git for fuld gennemsigtighed og historisk sporing
- Frontend er bygget med React + TypeScript + Vite (Tailwind CSS, react-leaflet)

### Indsend ændringer

1. Fork repoen og opret en branch fra `main`
2. Lav dine ændringer
3. Kør `mise run fetch-data` for at verificere at fetchere stadig virker
4. Åbn en pull request med en klar beskrivelse af hvad der er ændret og hvorfor

## Licens

MIT