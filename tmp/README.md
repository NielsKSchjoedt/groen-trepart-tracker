# tmp/ — midlertidige dev-ressourcer

Denne mappe er til **midlertidige filer brugt under udvikling**: assets, skærmbilleder, eksempel-data, walkthroughs, scratch-noter og lignende, som agenter eller udviklere har brug for i en periode, men som ikke skal i source control eller udstilles på sitet.

**Indholdet er gitignored** (kun denne README er tracket, så mappen findes ved en frisk clone).

## Hvad hører til her
- Skærmbilleder og billed-assets brugt midlertidigt under implementering.
- Eksempel-/scratch-data, prøve-output, debug-dumps.
- Arbejds-walkthroughs og audit-noter af midlertidig karakter (fx `AUDIT-WALKTHROUGH.md`).
- Alt, en agent skal bruge "et stykke tid", men ikke for evigt.

## Hvad hører IKKE til her
- **Blivende dokumentation / metode** → `docs/`.
- **Kuraterede offentlige artikler** → `content/videnscenter/`.
- **Rå crawls af eksterne sider** → `.cursor/memory-bank/crawled-content/` (agent-baggrund, gitignored).
- **Struktureret data fra API'er** → `data/` (ETL-output).

Se "Content Placement Policy" i `.skills/etl-data-sources/SKILL.md` for den fulde oversigt.
