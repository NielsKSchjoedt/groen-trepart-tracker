# Ekspertfeedback: Ole Gregor — pensioneret landinspektør

> Modtaget 17. marts 2026. Ole Gregor er pensioneret landinspektør, tidligere i Viborg Amt, og var en af de første til at dele geodata gratis og sætte kort på internettet i Danmark. Kontakt anbefalet af Nils Mulvad. Gæsteunderviser på DMJX.

---

## Nye datakilder og kontakter

### Danmarks Miljøportal — Nils Høgsted
- **Kontakt**: Nils Høgsted, sekretariatschef i Danmarks Miljøportal
- Ole beskriver ham som "interesseret i at data kommer ud og arbejde"
- Miljøportalen samler data fra en lang række myndigheder
- Der er API til de fleste data
- **Det er her de afgørende data ligger** (Oles ord)
- Historisk er der udfordringer: Miljøministeriet tildelte DMU databaseopgaver uden udbud, så det er svært at trække data ud (f.eks. arter), men der arbejdes på omstrukturering

### PULS — overløb fra offentlige forsyninger
- Data om kloakoverløb til vandmiljøet
- Ole bemærker: "for nogle kommuner er der en grim fornemmelse af at data ikke er de reelle"
- Relevant transparensvinkel: kvaliteten af overløbsdata varierer

### MiljøGIS fra Miljøministeriet og Ministeriet for Grøn Trepart
- Indeholder centrale data om mål (vandområdeplanerne + Natura 2000-planerne) og tilhørende basisanalyser
- Vurdering af tilstand og hvad der skal til for at nå målene
- Adgangen er "mere kaotisk" end Miljøportalen — ministerierne "kan ikke finde ud af at udstille dem via Miljøportalen"

### Fugle og Natur / DOF-databasen
- Relevant biodiversitetsdata
- **Advarsel**: De vil ofte have penge for adgang til data

---

## Metodiske nuancer og begrænsninger

### Udvaskning og forsinkelse
- Udvaskning hænger sammen med nedbør, afgrøder og *tidligere* udspredning af gødning og pesticider
- Effektvurdering er komplekst
- Der er en lang forsinkelse fra plan → realisering → målbar effekt ("mange, mange år")

### Referenceproblemet med Baltikum
- Danmark anvender Baltikum som reference for vandkvalitetsmål
- Ole mener det giver "kun begrænset mening" fordi:
  - Der er "rigtig mange mennesker fjernet igennem de sidste 80 år" (historisk kontekst)
  - Store landbrugsarealer er opgivet i Baltikum
  - Danmark har ikke forårsafstrømningen til "gennemskylning" af vandløbene
- Danmark burde muligvis have udpeget flere "modificerede områder"
- Vandløbsplanerne er "reelt præget af lystfiskerinteresser"

### Manglende data — biodiversitet i det åbne land
- **Ingen data for**: nedlæggelse af læhegn, færre markgrænser
- Disse er afgørende for biodiversiteten i det åbne land
- Viber, agerhøns er "stort set væk", det samme gælder smådyrene
- Et datahul der bør dokumenteres i Data og metode-sektionen

### Grundvandsdata under omlægning
- GEUS Jupiter-data er ved at blive omlagt i nyt system under Miljøportalen
- I dag er det svært at koble boringer med vandværker
- Vand blandes fra flere boringer → svært at vurdere nitrat/pesticider direkte
- Svært at trække aktuelle data ud
- **Anbefaling**: Spørg Miljøportalen om fremdrift med omlægningen

---

## Satellit-data og NDVI (opfølgning 17. marts)

### NDVI til ændringsdetektion
- Det er notorisk svært at lave klassifikation af naturtyper fra satellitdata
- Men det er forholdsvis let at lave kort over **ændringer** via indekset **NDVI** (Normalized Difference Vegetation Index, baseret på rød og infrarød)
- Kræver "kun" skyfri data fra nogenlunde samme tidspunkt på året
- **Relevant for natur og skove**: NDVI måler reelt mængden af biomasse — kan vise om skovrejsning faktisk etableres og om naturarealer ændrer sig
- **Usikkert for alger**: Mange alger er i det blå eller grønne spektrum, som NDVI ikke nødvendigvis fanger godt

**Konsekvens for projektet**: I stedet for at forsøge at klassificere naturtyper fra satellit (svært), kan vi bruge NDVI til at vise *ændringer over tid* — f.eks. "dette areal var landbrugsjord i 2020, nu er biomassen steget, hvilket indikerer skovrejsning/naturgenopretning." Det er en stærkere og mere ærlig brug af satellitdata.

### Biodiversitetsbegrebet — et formidlingsdilemma
Ole påpeger en fundamental faglig uenighed om, hvad "biodiversitet" egentlig betyder som mål:

- **Mange arter lokalt** (DMU-tilgangen, Molslaboratoriet) — biodiversitet = artsdiversitet på et givent område
- **Sjældne naturtyper globalt** — bevare variation på verdensplan, selvom det betyder færre arter lokalt. Eksempler:
  - **Klitheder** og **højmoser** er sjældne globalt men har lavt artsantal
  - **Molslaboratoriet** har fået flere arter ved at stoppe vedligeholdelse af dræn, men har samtidig ødelagt den sjældne naturtype "surt overdrev"

**Konsekvens for projektet**: Når vi viser biodiversitetsdata, skal vi være meget bevidste om, at "flere arter" ikke nødvendigvis = bedre. Det er et formidlingsvalg der kræver nuance. Dashboardet bør dokumentere denne spænding åbent i Data og metode-sektionen, snarere end at forsøge at reducere biodiversitet til ét enkelt tal.

---

## Anbefalinger fra Ole

### Fokusområder for næste trin
1. **Udledninger ved udløb af større vandløb** — kombination af Miljøportal og MiljøGIS
2. **Fjorde og lukkede farvande** — specifikt det sydfynske og Smålandsfarvandet
3. **Kontakt Nils Høgsted** (Miljøportalen) som indgang til data

### Generel vurdering
- "Et flot stykke formidlingsarbejde"
- "Reelt noget ministeriet burde have gjort, hvis de for alvor ønsker fremdrift"
- Åben for yderligere dialog — "du er velkommen til at ringe"
