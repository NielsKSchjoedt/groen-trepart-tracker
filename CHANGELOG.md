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

## v1.0.3 — 15. juni 2026

**Ny sektion «Proces & fremdrift» på kommunesider**

### Ny funktion
- Kommunesider har fået en ny sektion «Proces & fremdrift» der viser hvor langt kommunens MARS-projekter er i faserne — sammenlignet med naboer i samme lokale trepart og med landsgennemsnittet. Sektionen viser fasefordeling i hektar, momentum de seneste 6 måneder (både antal projekter og hektar), median tid i forundersøgelse, seneste milepæle og en nabosammenligning med dropdown. En forbeholds-boks forklarer at tilsagn gives af SGAV — ikke kommunen — og at projektantal og hektar kan pege hver sin vej.

### Forbedring
- På kommuneoversigten vises delmålene som farvede prikker direkte på kortet, når du endnu ikke har valgt et indsatsområde. Når du vælger, skifter visningen til den kompakte menu med fasefilter og kortindstillinger.
- Teksten under «Kort sagt» på forsiden er opdelt i korte afsnit og punktliste, så den er nemmere at skimme. Vandmiljø nævnes nu på samme overordnede niveau som de øvrige effekter — uden det konkrete antal kystvande i god tilstand.
- I nabosammenligningen under «Proces & fremdrift» vises grænsenaboer (fælles kommunegrænse) først i dropdownen — ikke trepart-naboer fra samme vandoplandsplan. Horsens og Samsø kan dele trepart med Odense uden at være grænsenaboer; de ligger nu under «Øvrige kommuner». Gennemsnitsbjælken hedder «Trepart-naboer gns.» for at skille de to begreber ad.
- «Den fulde liste» har fået den samme filterrække som ranglisten (område, Mod målet / Ift. ansvar / Absolut og Projektfaser) — så du kan ændre visning uden at scrolle tilbage til toppen.
- Knapper og vælgere i kontrolrækker (rangliste, kort, projekter og projektliste) har fået samme størrelse og valgt-stil — grøn markering på segmenter og ens trigger-knapper til dropdowns som Projektfaser og Kortvisning.
- Kortkontrollerne på kommuneoversigten og enkelt-kommunesider bruger nu den kompakte menu på alle skærmstørrelser: indsatsområde-dropdown, Projektfaser og Kortvisning — i stedet for mange rækker med pill-knapper og tilvalg-toggles.
---

## v1.0.2 — 14. juni 2026

**Versionsnummer og «ny version»-meddelelse øverst på siden**

### Fejlrettelse
- Kortvisning-knappen på kommune-kortet viste en lille prik som aktiv-indikator. Den viser nu et tydeligt tal (som Projektfaser) — fx «1» når et tilvalg som Klimaskovfonden er slået til.
- Faseprofilen «Hvor langt er kommunen i faserne?» viste 0 % i alle bjælker for kommuner der kun har skitseprojekter (fx Vallensbæk). Nu står der i stedet tydeligt at al indsats endnu ligger i skitsefase — med hektar — indtil projekter kommer i de formelle faser.
- Sektionsmenuen øverst på mobil (Målene, Projekter, Geografi …) gav vandret overflow på små skærme. Den kan nu scrolles inde i baren uden at siden bliver bredere.
- Filtre-knappen på kommunelisten viste ingen tæller, når kun «anlagt» var valgt — selv om det er standard, er det stadig ét aktivt fasevalg. Knappen viser nu altid antallet af valgte faser (fx «1»).
- I fremskrivningen sprang eksterne kilder (Klimaskovfonden, Naturstyrelsen m.fl.) tilbage til «tændt», når man slukkede dem alle — det var en fejl i link-kodningen. Slukket-tilstand holdes nu, og forskellen mellem tændt og slukket er tydeligere visuelt. Tomme fremskrivnings-links ser også pænere ud i adresselinjen (`?frem=ingen#fremskrivning` i stedet for `?frem=#fremskrivning`).
- Hintet «Vælg et delmål for at dykke ned i detaljerne» kunne ikke lukkes med X-knappen på forsiden. Rettet — lukning gemmes som ved andre hints.
- På kommunesider forsvandt metrik-, fase- og kildetoggles, når man åbnede kortet i fuld skærm. Filtrene følger nu med ind i fuldskærmsvisningen — samme adfærd som på det nationale kort.
- På enkeltkommunesider forsvandt «Alle kommuner»-linket, når man scrollede ned ad siden. Det ligger nu også i den sticky navigationsbjælke, så du altid kan gå tilbage til kommunelisten.

### Ny funktion
- Når du scroller gennem siden, opdateres adresselinjen automatisk med sektionens anker (fx #oekonomi), så du kan dele præcis hvor du er. De grønne kapiteloverskrifter og sektionslinks i navigationsbjælken viser et lille link-ikon, når du holder musen over — klik for at kopiere linket til sektionen.
- Øverst på siden vises nu et diskret versionsnummer (link til ændringsloggen) og — ved nye udgivelser — en lille «Ny version»-meddelelse med overskrift, dato og link til at læse mere. Meddelelsen kan lukkes og vises ikke igen, før næste version.
- Enkeltkommunesider har nu samme kapitelnavigation som oversigten: Status, Kort og Projekter med ankerlinks, sticky sektionsbjælke og delbare #status / #kort / #projekter-URL'er.
- Kommunekortenes Lag-knap viser nu de samme baggrundskort som på det nationale kort (kystvande, markudledning, biodiversitets-WMS, §3 m.fl.). MARS-projekter følger fasefilteret; Klimaskovfonden og Naturstyrelsen tændes via tilvalg-knapperne — ikke i Lag-panelet, så du ikke møder det samme valg to steder. Valget gemmes i linket (`overlag=`).

### Forbedring
- Sitemap (sitemap.xml) dækker nu alle offentlige sider automatisk — inkl. forsiden, alle 98 kommuner og videnscenter-artikler — med seneste opdateringsdato. Tidligere manglede forsiden, og kommune-URL'er skulle vedligeholdes manuelt.
- Feedback-knappen nederst til venstre har fået tydeligere tekst: «Fejl, feedback eller ønsker» — ikke kun fejlrapportering.
- Nøgletal-kortet for beskyttet natur viser nu opdeling som de øvrige mål: §3, Natura 2000, DCE 30 %-potentiale og MARS-projekters overlap med naturpotentiale — med overskrift som «1.499 ha beskyttet (65 ha naturpotentiale)» når begge dele findes.
- Nøgletal-kort for kvælstof, lavbund og skov viser nu «0 ton N anlagt (318 ton N i proces)» — tydelig skelnen mellem det der er fysisk anlagt og det der stadig er i pipeline. Skov tæller KSF/NST med under anlagt.
- MARS-fasefordelingen under nøgletal vises nu inde i hvert mål-kort (kvælstof, lavbund, skov) — i stedet for én fælles liste nederst.
- Kortene kan nu zoomes et niveau tættere ind — både det nationale kort, kommunekortet og projektkortene — så enkeltprojekter og små kommuner er nemmere at se i detaljer.
- Vandmiljø-kortet under Effekt siger nu kort, at det er hovedeffekten af kvælstofindsatsen — og badge «Hovedeffekt af kvælstof» i stedet for «Ikke målsat».
- Mål-kortene på forsiden viser nu «tid gået» (med ur) og «anlagt» (med spade) ved de to bjælker — tydeligere end bare «tid».
- Ranglistekortene vender nu med en lille 3D-flip-animation, når du trykker «Hvordan virker det?» — og tilbage igen med «Rangliste».
- På enkelt-kommunesiden er det tydeligere hvad der er mål (Lavbund, Skov, Kvælstof) og hvad der er status: målet står i gråt, status vises med pil op / midt / ned i stedet for farvet baggrund.
- På kommunekort og nationalt kort ligger fasefilter nu på samme linje som grundkort og «Vis som». Supplerende kilder (Klimaskovfonden, Naturstyrelsen) er skiftet til enkle af/på-kontakter — samme type som kortlagene i Lag-panelet.
- «Sådan virker tallene» er flyttet ud af fasefilteret. Hver ranglistekort (lavbund, skov, kvælstof, natur, CO₂) har nu et vend-knap i hjørnet — tryk for at se hvordan netop den liste beregnes, og «Rangliste» for at vende tilbage.
- Fasefilteret på kort (nationalt kort, kommunekort og enkelt-kommune) er nu samlet i en kompakt «Fasefilter»-knap med tæller — samme mønster som på ranglisten. Supplerende kilder (Klimaskovfonden, Naturstyrelsen) står for sig i en egen boks.
- MARS-projekter på kortet forbliver som prikker længere, når du zoomer ind. Hvert projekt skifter først til den rigtige form, når formen på skærmen er mindst lige så stor som prikken — så små projekter undgår at blive til næsten-usynlige firkanter for tidligt.
- På en enkelt kommuneside kan du nu skifte kortvisning direkte på siden — samme metrik, faser, supplerende kilder og kortkontroller (grundkort, absolut/ift. ansvar) som på oversigten over alle kommuner. Du behøver ikke gå tilbage til listen for at ændre visningen.
- Fasefilteret (anlagt, godkendt, forundersøgelse) findes nu også direkte i kontrolbjælken over ranglisterne — ikke kun ved kortet. Valget gælder rangliste, kort og den fulde kommuneliste på én gang.
- På kommuneoversigten og enkeltkommunesider skifter siden ikke længere baggrundsfarve, når du vælger et kort-mål — det var kun kortet, der ændrede sig. Delmål-linkene (Kvælstof, Lavbund m.fl.) er fjernet fra den sticky topbjælke på kommunesider; brug National/Kommuner-skifteren for at gå tilbage til landsoversigten.
- Filterbjælken over ranglisten (område, fase, levering) hænger kun fast under scroll på mobil — på desktop scroller den med siden som resten af indholdet.
- Kommune-siderne har fået flere springpunkter i navigationsbjælken. Oversigten over alle kommuner starter med en kort «Oversigt»-sektion og har derefter Ranglister, Kort og Den fulde liste. På enkeltkommunesider er det lange «Projekter»-afsnit opdelt i Nøgletal, Faseprofil, Natur & opland, CO₂ og Projekter — så du kan hoppe direkte til det, du leder efter.
---

## v1.0.1 — 14. juni 2026

**Delbare links genskaber hele visningen — sektion, kort, projekter og kommune-rangliste**

### Ny funktion
- Du kan nu kopiere et link, der genskaber præcis den visning du ser: hvilken sektion du er scrollet til, kortets lag og faser, fuld skærm, antal vs. areal, fremskrivningens stadievalg, kommune-ranglistens sortering — og åbne projekter (MARS, Klimaskovfonden, Naturstyrelsen). Brug «Kopiér link» i navigationsbjælken, på kortet, i fremskrivningen og på kommunesiderne. Eksisterende links med ?projekt=mars:… og ?lag=… virker stadig.
---

## v1.0.0 — 14. juni 2026

**Stor relancering (1.0): indsats adskilt fra effekt, ny vidensbank, kommune-rangliste med detaljesider og kort med projekterne i front**

### Fejlrettelse
- Femfase-pipelinen viste de samme projekttal for kvælstof, lavbund og skov, selv om delmålene ikke har de samme projekter. Rettet, så hvert delmål kun tæller projekter med positiv effekt for netop det delmål.
- Links til tilskudsordninger på projektdetaljerne kunne føre til sider, der ikke længere findes (404), fordi Landbrugsstyrelsens tilskudssider er flyttet til Styrelsen for Grøn Arealomlægning og Vandmiljø. Linkene peger nu de rigtige steder hen, og tomme pladsholder-links vises ikke længere.
- Det samme MARS-projekt kunne optræde to gange i kommunelisten, når det indgår i flere kystvandgruppeplaner — det gav dobbeltvisning og forhindrede fold-ud. Listen viser nu ét projekt pr. fysisk projekt, og fold-ud virker stabilt.

### Metodeændring
- «Tid gået siden aftalen» og alle fremskrivninger regner nu fra underskriftsdatoen 24. juni 2024 — ikke 1. januar 2024 — så det matcher sidens egen tekst om, hvornår aftalen blev indgået.
- Hovedtallet øverst er nu en arealvægtet indsats-procent (skov + lavbund anlagt) med lineær fremskrivning — ikke et gennemsnit på tværs af de fem delmål. De fem delmål findes stadig som scoreboard længere nede på siden.
- Ny metode for kommune-sammenligning: ansvar beregnes fra dokumenteret naturpotentiale (DCE 30 %), levering fra MARS uden skitser, og der er en tydelig disclaimer om, at det ikke er en officiel politisk fordeling. Metode og data er beskrevet under Data & metode.
- Kommune-hektar for MARS-projekter klippes nu til kommunegrænserne, hvor der findes geometri — tættere på MARS' egen metode. Projekter uden geometri tilskrives stadig via centroide.
- Skov-ranglisten og kommune-kortet tæller hele trepartens skovindsats — MARS, Klimaskovfonden og Naturstyrelsen — så indekset måler den fulde skovindsats og ikke kun MARS.
- CO₂ vises nu med samme «nu»-tal (53 %, estimat 2025) på både forsiden og CO₂-siden. Faktisk reduktion 2023 vises fortsat som historisk tal, og status vurderes ens de to steder.
- Status-tærsklerne i fremskrivningen er strammet, så «Tæt på målet» først bruges fra 80 % af målet og «Delvis dækning» fra 50 %. Tidligere kunne der stå «Tæt på målet» allerede ved 16–64 %, selv om langt det meste manglede.
- Data til dashboardet deles ved den daglige opdatering i en let oversigtsfil og en separat fil med projektdetaljer, så de vigtigste tal og kort kan vises hurtigere.
- Projekttragt og fremskrivning dækker nu forvaltningens fulde fem-fase-model (skitse → tilsagn → færdig forundersøgelse → etableringstilsagn → anlagt) med frafald undervejs — hvor v1 kun havde en grov tredeling. Det giver et mere præcist billede af, hvor projekterne reelt står i forløbet.

### Ny funktion
- Forsiden viser nu to ærlige hovedtal i stedet for ét sammenvejet gennemsnit: Indsats (hvad treparten faktisk anlægger — skovrejsning, lavbundsarealer og kvælstofvådområder) og Effekt (klima, vandmiljø og natur). De to blandes aldrig sammen, så CO₂ og beskyttet natur ikke længere trækker det samlede tal kunstigt op — og det bliver tydeligt, at selve anlægsarbejdet stadig er i en meget tidlig fase.
- Nyt flow-diagram på forsiden viser, hvordan hvert virkemiddel bidrager til klima, vandmiljø og natur — med forbindelseslinjer der lyser op, når du holder musen over et kort. Hvert virkemiddel og hver effekt kan klikkes for at dykke ned i tal, projekter og kort, og bærer Klimarådets risikovurdering.
- Hvor Klimarådets statusrapport siger noget væsentligt om et delmål, vises et lille mærke med rådets risikovurdering. Klik for at læse hele citatet, og følg linket til den officielle rapport.
- Nyt videnscenter med baggrundsartikler om Den Grønne Trepart: de fem mål, forskellen mellem virkemidler og effekt, kvælstof, lavbund, skov, natur, CO₂, sådan måler vi, og en ordbog. Find det i menuen og via linket i bunden af siden.
- Kommunesiden er bygget om. /kommuner viser en rangliste over alle 98 kommuner på de tre virkemidler (lavbund, skov og kvælstof), målt på hvad de leverer i forhold til deres ansvar — ikke rå hektar. Klik på en kommune for at åbne en fuld detaljeside med projekter, CO₂, naturbenchmark og oplandsinfo.
- Ny fremskrivning erstatter scenariebyggeren: vælg selv hvilke projektstadier du tror bliver til virkelighed, og se både det faktiske tempo (kurs) og pipelinens fulde potentiale (rækkevidde) i én graf over tid — med en tydelig advarsel om, hvor langt der er til målet. Klimaskovfondens og Naturstyrelsens skovprojekter kan tælles med.
- Alle kortvisninger — det nationale delmålskort og kommune-kortene — er bygget om til én samlet lagmodel med tre faste lag: MARS-projekterne i front (altid synlige som prikker zoomet ud og polygoner zoomet ind, default kun de anlagte, fase-knapper tilføjer flere), det farvede grundkort som valgfri baggrund, og alle øvrige WMS- og naturlag samlet under «Lag», slukket som standard. Det erstatter den tidligere ad hoc-blanding af lag.
- Klik på et MARS-projekt på kortet, i projekttragten eller i tabellen åbner det samme detaljekort — med fase, areal, effekt (kvælstof/lavbund/skov), tilskudsordning, datoer og et minikort over projektområdet. Detaljer kan deles via link (?projekt=mars:<id>).
- På beskyttet-natur-siden kan du lægge MARS-projektarealer, §3-beskyttet natur og Natura 2000 oven på hinanden på kortet og med det blotte øje se, hvor trepart-projekterne ligger på kortlagt natur. En note forklarer, at visuelt overlap er en stærk indikator for naturpotentiale — ikke en garanti for, at naturen reelt forbedres.
- Nye kommune-benchmark for natur: hvor stor en del af landets naturpotentiale der ligger i kommunen, hvor mange af kommunens marker der ligger på naturpotentiale, hvor stor en del af kommunens Natura 2000 der stadig er aktivt landbrug, og hvor stor en del af naturværdien der har beskyttelsesstatus.
- Biodiversitets- og omlægningskort kan slås til på Danmarkskortet: gennemsigtige lag fra Arealdata (WMS) og polygoner for Vand, natur & skov 2026 fra Fødevareministeriet.
- De geografiske kort kan nu åbnes i fuld skærm — med lagvælger, grundkort og signaturforklaring bevaret, så du kan udforske kortet uden at miste kontekst.
- Nyt økonomiafsnit «Er der penge nok til at nå målene?», som ikke fandtes før. Det skelner mellem projekttilskud (ca. 43 mia. kr.), kommunal planlægningskapacitet (461,8 mio. kr.) og det uafsatte hul til drift efter anlæg. På forsiden ses det samlede overblik over de to pengestrømme; på delmålssiderne ses økonomien for det valgte tema med realisering, satser og kilder.

### Forbedring
- Forsiden er bygget op som et sammenhængende forløb, hvor hvert afsnit svarer på ét spørgsmål: Når vi målet? → Hvordan måles det? → Forstå projekterne → Har vi råd? → Når vi det i tide? → Hvor sker det? En bjælke i toppen viser, hvilket afsnit du er i, mens du scroller.
- Alle projektvisninger (projekttragt, udvikling over tid og hvem der står bag) er samlet i ét afsnit med et fælles skift mellem antal projekter og areal/effekt. Som standard vises areal/effekt — hektar, eller ton N for kvælstof.
- Vandmiljø-kortet viser nu kystvandenes økologiske tilstand (VP3) — fx hvor mange af de 109 kystvande der har god tilstand — i stedet for kun at vise fremskridt mod kvælstof-målet. Delmåls-sektionen har fået overskriften «De fem delmål», og vandmiljø er markeret som en effekt af kvælstofindsatsen.
- Siden indlæser hurtigere, fordi de tunge projektlister hentes separat efter de vigtigste tal og kort er vist. Titler og beskrivelser er skrevet om, så det er tydeligere i Google, hvad siden handler om, og kommunesider viser kommunens navn i titlen.
- Klimaskovfondens skovprojekter vises i lys lilla, så de ikke forveksles med anlagte MARS-projekter, og Naturstyrelsen i mørkere violet — ens på kort, i projekttragten og i graferne.

### Dataopdatering
- KF26's høringsmateriale for lavbund og skov er lagt ind sammen med Klimarådets baggrundsnotat om trepartens arealmål: bl.a. 71.100 ha kulstofrig lavbund under udtagning (december 2025) og rådets risikovurdering — ca. 20.000 ha realiseret ved den nuværende afgift på 40 kr./ton mod ca. 70.000 ha ved rådets anbefalede 125 kr./ton.
- Finansieringstal og kilder er opdateret med de primære aftale-PDF'er og den kommunale ramme på 461,8 mio. kr. (2025–2032) fra rammeaftalen mellem Ministeriet for Grøn Trepart og KL. Novo Nordisk Fondens 10 mia. kr. vises som tværgående privat fond, ikke som et natur-delbudget.
- Markkort 2026 og biodiversitetslag fra Arealdata hentes nu i en separat månedlig spatial datakørsel, adskilt fra den daglige opdatering, så de tunge GIS-beregninger kører isoleret.
- Natura 2000 og §3-beskyttet natur tegnes nu fra lokale, forenklede polygoner i stedet for live WMS, så områderne er synlige ved nationalt zoom. Fuldopløsnings-data bruges stadig i overlap-beregningerne.
---

## v0.9.6 — 26. april 2026

**Baggrundens dyresilhuetter bruger nu mere danske naturmotiver**

### Forbedring
- Dyresilhuetterne i baggrunden bruger nu mere danske naturmotiver. Kanin/hare er fjernet, og den tidligere generiske sommerfugl er skiftet ud med en mørkegrøn, udfyldt citronsommerfugl-silhuet, som hører hjemme i Danmark.
---

## v0.9.5 — 23. marts 2026

**Delmålskort: tydeligere tal og farvekodet prognosetekst**

### Fejlrettelse
- På bred skærm blev delmålstitler og fodtekst ofte skåret af med prikker, fordi fem kolonner blev meget smalle. Sektionen må nu blive bredere på store skærme, titler brydes over flere linjer (uden ét-linjers afkortning), og tempo-prognosen vises fuldt fra tablet-størrelse og op. På Beskyttet natur forbliver den korte forklaring bevidst i højst to linjer med info-ikon til hele teksten.

### Forbedring
- De store procenttal på delmålskortene er gjort kraftigere (fed skrift). Tempo-linjen starter med "Ved dette tempo når vi:" (tydeliggør at det er et skøn ud fra nuværende hastighed), er sat med fed kursiv, og de projicerede tal og procenten er farvet med samme rød–gul–grøn som statusmærket på kortet.
- På delmålet Beskyttet natur står nu en kort forklaring på, hvorfor der ikke vises samme tempo-fremskrivning som på de øvrige kort (politiske udpegninger frem for MARS-projektfaser).
- De fem delmålskort har nu samme højde i hver række: fodlinjen (prognose eller natur-forklaring) har fast minimumshøjde, og natur-teksten vises i højst to linjer med fuld forklaring bag et lille info-ikon.
- Fodteksten på delmålskortene (tempo-prognose og natur-forklaring) er sat med fed kursiv, så den skiller sig tydeligt ud fra brødteksten ovenfor.
---

## v0.9.4 — 20. marts 2026

**Statuscirklerne på forsiden viser nu konkrete tal mod målet**

### Forbedring
- Under hver af de fem små statuscirkler ved forsiden står nu hvor langt Danmark er i fysiske tal — fx ton kvælstof, hektar lavbund eller skov, og procent ved CO₂ og beskyttet natur. Det matcher samme grundlag som delmålskortene (anlagt / faktisk fremdrift).
---

## v0.9.3 — 18. marts 2026

**UX-forbedringer: pegefinger-cursor på klikbare elementer og konsistent CO₂-navngivning**

### Forbedring
- Klikbare elementer viser nu pegefinger-cursor ved hover — delmålskortene, statuscirklerne, metrikpillerne, luk-knapper og andre interaktive elementer gav tidligere ingen visuel feedback. Rettet.
- Underteksten under overskriften siger nu "CO₂" i stedet for "klima", så den matcher de fem delmål som brugeren ser i brugergrænsefladen.
- Projektets non-profit og ikke-kommercielle karakter er nu tydeliggjort: i footeren og på siden Data og metode står det klart, at Grøn Trepart Tracker er uafhængigt, uden kommercielle interesser og uden finansiering fra organisationer eller myndigheder.
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
