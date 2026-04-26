# Ekspertinput: geodata og miljødata

> Sammenfatning af fagligt input om geodata, miljødata og metodiske begrænsninger. Personnavne, henvisningskæder og kontaktoplysninger er udeladt, fordi repository-dokumentation skal være personneutral.

---

## Nye datakilder og organisatoriske indgange

### Danmarks Miljøportal
- Miljøportalen samler data fra en lang række myndigheder
- Der er API til de fleste data
- Relevans: centrale miljødata for vand, arter, arealer og overvågning ligger ofte her
- Historisk er der udfordringer med adgang til nogle datasæt, men der arbejdes på omstrukturering

### PULS — overløb fra offentlige forsyninger
- Data om kloakoverløb til vandmiljøet
- Relevant transparensvinkel: kvaliteten af overløbsdata kan variere mellem kommuner

### MiljøGIS fra Miljøministeriet og Ministeriet for Grøn Trepart
- Indeholder centrale data om mål (vandområdeplanerne + Natura 2000-planerne) og tilhørende basisanalyser
- Vurdering af tilstand og hvad der skal til for at nå målene
- Adgangen er mindre samlet end Miljøportalen og kræver ofte konkret lag- og endpoint-afklaring

### Fugle og Natur / DOF-databasen
- Relevant biodiversitetsdata
- **Advarsel**: Adgang kan være betalingsbelagt

---

## Metodiske nuancer og begrænsninger

### Udvaskning og forsinkelse
- Udvaskning hænger sammen med nedbør, afgrøder og *tidligere* udspredning af gødning og pesticider
- Effektvurdering er komplekst
- Der er en lang forsinkelse fra plan → realisering → målbar effekt

### Referenceproblemet med Baltikum
- Danmark anvender Baltikum som reference for vandkvalitetsmål
- Det kan være metodisk problematisk, fordi historisk arealanvendelse, befolkningstæthed og hydrologi adskiller sig markant
- Danmark burde muligvis have udpeget flere "modificerede områder"
- Vandløbsplanerne kan være præget af bestemte brugerinteresser, hvilket bør håndteres åbent i metodeformidlingen

### Manglende data — biodiversitet i det åbne land
- **Ingen data for**: nedlæggelse af læhegn, færre markgrænser
- Disse er afgørende for biodiversiteten i det åbne land
- Et datahul der bør dokumenteres i Data og metode-sektionen

### Grundvandsdata under omlægning
- GEUS Jupiter-data er ved at blive omlagt i nyt system under Miljøportalen
- I dag er det svært at koble boringer med vandværker
- Vand blandes fra flere boringer → svært at vurdere nitrat/pesticider direkte
- Svært at trække aktuelle data ud
- **Anbefaling**: Afklar fremdrift med omlægningen via Miljøportalen

---

## Satellit-data og NDVI

### NDVI til ændringsdetektion
- Det er notorisk svært at lave klassifikation af naturtyper fra satellitdata
- Men det er forholdsvis let at lave kort over **ændringer** via indekset **NDVI** (Normalized Difference Vegetation Index, baseret på rød og infrarød)
- Kræver "kun" skyfri data fra nogenlunde samme tidspunkt på året
- **Relevant for natur og skove**: NDVI måler reelt mængden af biomasse — kan vise om skovrejsning faktisk etableres og om naturarealer ændrer sig
- **Usikkert for alger**: Mange alger er i det blå eller grønne spektrum, som NDVI ikke nødvendigvis fanger godt

**Konsekvens for projektet**: I stedet for at forsøge at klassificere naturtyper fra satellit (svært), kan vi bruge NDVI til at vise *ændringer over tid* — f.eks. "dette areal var landbrugsjord i 2020, nu er biomassen steget, hvilket indikerer skovrejsning/naturgenopretning." Det er en stærkere og mere ærlig brug af satellitdata.

### Biodiversitetsbegrebet — et formidlingsdilemma
Der er en fundamental faglig uenighed om, hvad "biodiversitet" egentlig betyder som mål:

- **Mange arter lokalt** (DMU-tilgangen, Molslaboratoriet) — biodiversitet = artsdiversitet på et givent område
- **Sjældne naturtyper globalt** — bevare variation på verdensplan, selvom det betyder færre arter lokalt. Eksempler:
  - **Klitheder** og **højmoser** er sjældne globalt men har lavt artsantal
  - **Molslaboratoriet** har fået flere arter ved at stoppe vedligeholdelse af dræn, men har samtidig ødelagt den sjældne naturtype "surt overdrev"

**Konsekvens for projektet**: Når vi viser biodiversitetsdata, skal vi være meget bevidste om, at "flere arter" ikke nødvendigvis = bedre. Det er et formidlingsvalg der kræver nuance. Dashboardet bør dokumentere denne spænding åbent i Data og metode-sektionen, snarere end at forsøge at reducere biodiversitet til ét enkelt tal.

---

## Anbefalinger

### Fokusområder for næste trin
1. **Udledninger ved udløb af større vandløb** — kombination af Miljøportal og MiljøGIS
2. **Fjorde og lukkede farvande** — specifikt det sydfynske og Smålandsfarvandet
3. **Danmarks Miljøportal** som organisatorisk indgang til dataafklaring
