---
name: learning-loop
description: Capture domain insights, corrections, and new knowledge during work on the Den Grønne Trepart tracker, and consolidate them into the project's knowledge base. Trigger this skill whenever working on this project and a new insight emerges — a correction about Danish environmental policy, a data source discovery, a governance clarification, a technical finding about MARS/MiljøGIS/DAWA, or any realization that updates the project's understanding. Also trigger on explicit `/learn` commands, requests to "consolidate learnings", or "what have we learned?"
---

# Domain Learning Loop — Den Grønne Trepart

This skill captures and consolidates knowledge as the project evolves. The trepart-tracker has a structured knowledge base in `docs/` — this skill keeps it alive and accurate.

## Why this matters

This project synthesizes Danish environmental policy, data infrastructure, and governance structures that are poorly documented, rapidly evolving, and full of subtle distinctions (like VP3 vs. the Green Tripartite). Knowledge gets discovered in conversations but lost between sessions. This skill ensures discoveries survive.

## The two-tier system

### Tier 1: `docs/Learnings.md` (working scratchpad)

New insights land here first. Each entry is timestamped, categorized, and confidence-rated. This file is append-friendly and meant to be messy — it's a capture buffer.

**Format per entry:**
```
### [YYYY-MM-DD] [CATEGORY] — One-line summary
- **Detail**: The actual insight, with enough context to understand it later
- **Context**: What triggered this (conversation, data investigation, source reading)
- **Confidence**: low / medium / high
- **Action**: What docs should be updated, or "none yet"
```

**Categories** (aligned with the existing `docs/` structure):
- `DOMAIN` — Political agreements, targets, governance, institutional roles
- `DATA-SOURCE` — MARS, MiljøGIS, DAWA, DST, VanDa, Miljøportal findings
- `ARCHITECTURE` — Technical decisions, ETL pipeline, data model
- `GEOGRAPHIC` — Catchments, coastal waters, municipalities, naming conventions
- `METRICS` — What to measure, how to interpret, data quality caveats
- `META` — Project process, tooling, ways of working

### Tier 2: The existing `docs/` knowledge base

Mature, high-confidence learnings get consolidated into the appropriate doc:

| Category | Target doc(s) |
|----------|--------------|
| DOMAIN | `docs/domain/overview.md`, `docs/domain/governance.md` |
| DATA-SOURCE | `docs/data-sources/*.md` |
| ARCHITECTURE | `docs/architecture/decisions.md` (as ADRs) |
| GEOGRAPHIC | `docs/domain/geographic-model.md` |
| METRICS | `docs/domain/metrics-taxonomy.md` |
| META | `CLAUDE.md` (project instructions) |

## Capturing learnings

### Explicit capture: `/learn`

When the user types `/learn` followed by an insight:

1. Acknowledge briefly
2. Append to `docs/Learnings.md` with date, category, and detail
3. If it contradicts or refines something in the existing docs, note that in the entry

### Auto-capture

Watch for these signals during normal work:

- User corrects an assumption about Danish policy or governance
- A data source behaves differently than documented
- An API endpoint is discovered or found to be broken
- A naming mismatch or geographic boundary clarification surfaces
- The user explains a distinction the docs don't capture (like VP3 vs. Trepart)
- A technical decision is made that should be an ADR

When detected:
1. Capture the insight
2. Briefly confirm: "Noted: [one-line summary]. Logged to Learnings.md."
3. Append to `docs/Learnings.md`

Don't over-capture. Not every interaction is a learning. Focus on things that would cause a mistake if forgotten.

## Consolidating learnings

When asked to "consolidate learnings" or "clean up learnings":

1. Read all entries in `docs/Learnings.md`
2. Group by category
3. For each group:
   - Merge duplicates (keep the most complete version)
   - Identify high-confidence entries confirmed multiple times
   - Check whether the target doc already covers this — if so, note it and remove the entry
4. For high-confidence learnings not yet in docs:
   - Draft the update to the target doc
   - Show the user what will change
   - Apply after confirmation
5. Remove consolidated entries from `Learnings.md`
6. Report: what was merged, what was promoted to docs, what remains

## Referencing learnings

At the start of substantive tasks on this project, scan `docs/Learnings.md` for relevant recent entries. Apply what's relevant without listing what you found — unless the user asks.

## Bootstrapping

If `docs/Learnings.md` doesn't exist yet, create it with this header:

```markdown
# Learnings — Den Grønne Trepart Tracker

Working scratchpad for domain insights, data source discoveries, and corrections.
Entries here are reviewed periodically and consolidated into the structured docs in `docs/`.

See `.skills/learning-loop/SKILL.md` for the process.

---

```
