# Theory of Change — mål, mekanisme og virkemiddel

This note makes explicit the conceptual frame the tracker rests on: how the Green Tripartite's instruments, targets, and environmental effects relate. It exists because the agreement deliberately mixes *means* and *ends* at the same level, and a tracker that does not keep them apart will measure the wrong thing. It complements [metrics-taxonomy.md](./metrics-taxonomy.md) (which slices metrics into four data layers) and [overview.md](./overview.md) (which lists the binding targets).

## The core insight

In the Green Tripartite, **some of the means are stated as goals.** That is not a misreading — it is how the agreement is built. The hectare targets are instruments elevated to target status. Only the nitrogen target is expressed directly as an environmental effect.

## Three layers

The implementation logic runs across three layers, not two:

1. **Outcomes (the *why*)** — the actual environmental effects the whole thing exists for: a cleaner water environment (less nitrogen → god økologisk tilstand, less iltsvind), a lower climate burden (CO₂-e), and more/richer nature and biodiversity.

2. **Mechanism (the *how*, broadly)** — `arealomlægning`: taking farmland out of production and converting it to nature. The agreement calls this the *hovedmotor*.

3. **Virkemidler (the *how*, concretely)** — the six instruments registered in MARS: `ekstensivering`, `kvælstofvådområder`, `lavbundsprojekter`, `minivådområder`, `skovrejsning`, and `øvrige` — plus the policy levers behind them (tilskudsordninger, the emission-based nitrogen regulation from 2027, MARS, hensigtserklæringer, jordopkøb).

## The targets mix two kinds of thing

The four national headline targets are *not* the same kind of quantity. Two are true effect-targets-adjacent; two are means-targets:

| Headline target | Quantity | Deadline | Kind | What it really measures |
|-----------------|----------|----------|------|--------------------------|
| Nitrogen reduction | 13,800 t N/yr (≈12,776 t via udtagning + markregulering; ≈500 t CAP, ≈540 t spildevand) | 2027+ | **Effect-target** | The environmental effect itself, in tonnes |
| Lowland withdrawal | 140,000 ha carbon-rich soil (incl. buffer) | 2030 | **Means-target** | Hectares — a proxy for CO₂/nature/water effect |
| Afforestation | 250,000 ha (100,000 urørt; 230k via tilskud, 20k Naturstyrelsen) | 2045 | **Means-target** | Hectares — a proxy for several effects |
| Protected nature | 20% of land area | 2030 | **Mixed** | Area protected — close to the nature goal itself |

So the nitrogen number is an *effect*; the hectare numbers are *means* dressed as goals.

## Why the agreement does this

Outcomes are slow, noisy, and hard to attribute. Actual CO₂ and in-water nitrogen move over years to decades, and you cannot cleanly say "this hectare delivered exactly that drop." Hectares can be counted *now* and attributed unambiguously. Setting the instrument as the target is classic **management by proxy**: steer by what is countable when the ultimate outcome is not directly steerable.

## It is many-to-many, not 1:1

One instrument hits several goals at once — which is the entire reason the platform is called **M**ultifunktionel **A**realRegistrering. There is no clean pairing of one virkemiddel to one goal:

| Virkemiddel | Climate (CO₂) | Water (N) | Nature/biodiv. | Other |
|-------------|:---:|:---:|:---:|---|
| Lavbundsprojekter | ●● | ● | ● | |
| Skovrejsning | ● | ● | ●● | drinking water |
| Kvælstofvådområder | | ●● | ● | |
| Minivådområder | | ●● | | also P (fosfor) |
| Ekstensivering (permanent) | ● | ● | ● | |
| Øvrige (fosforvådområder, ådal-restaurering, …) | | ● | ● | P, hydrology |

(● = contributes, ●● = primary purpose. Indicative, from the MARS `virkemidler` descriptions.)

A single hectare omlagt can therefore score on multiple goals simultaneously — which is a feature of the policy but a trap for naïve counting (don't double-count effect across goals from the same hectare).

## Implication for the tracker

Keep two tracks rigorously separate, and never let progress on one stand in for the other:

- **Means delivered** — hectares, project counts, kroner committed, projects by phase (skitse → forundersøgelse → etablering → anlagt). Countable now, attributable, near-term. This is where MARS is strong.
- **Outcomes achieved** — tonnes N, tonnes CO₂-e, biodiversity indicators. Lagged, noisy, hard to attribute. Mostly *not* directly observable yet.

A sharp caveat that motivates this split: even MARS's `kvælstofindsatsen` status does **not** measure water quality. It reports the *modelled nitrogen effect of projects* with tilsagn/anlagt — i.e. the expected effect of the means, not the measured state of the fjord. So across nearly all four targets, "fremdrift" is in practice booked as *means delivered*, not *effect observed*.

The risk this guards against: you can hit 250,000 ha of forest and still miss the intended effect if it is the wrong land, monoculture, or poorly placed relative to nitrogen retention. The tracker's distinct value is making the gap between "instrument delivered" and "effect achieved" visible, rather than letting the hectare proxy quietly stand in for the environmental result.

## Mapping to the metrics taxonomy

This frame and the [four data layers](./metrics-taxonomy.md) line up as:

- Layer 1 (Governance & Process) → upstream of the mechanism (is the machinery running?).
- Layer 2 (Pipeline & Implementation) → **means delivered** (ha, projects, modelled N-effect).
- Layer 3/4 (Environmental outcomes) → **outcomes achieved** — the lagged effect-tier, deliberately kept apart from Layer 2.

---

*Sources: MARS status pages at https://mars.sgav.dk/status/ (`nationaltindblik`, `virkemidler`, `kvaelstofindsatsen`, `lavbundsindsatsen`, `skovrejsningsindsatsen`); SGAV editorial pages under https://sgav.dk/groen-trepart. Raw crawls kept as agent background in `.cursor/memory-bank/crawled-content/` (not in source control). Crawled 31 May 2026.*
