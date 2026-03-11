# Contributing to Den Grønne Trepart Tracker

Tak fordi du vil bidrage! This project is open source and welcomes contributions.

## Pull request requirements

### Screenshots for frontend changes

Any pull request that affects the frontend — layout, styling, data display, map rendering, chart changes, copy/text updates, or anything else visible to users — **must include before and after screenshots**. No exceptions.

This applies to:
- Changes to `site/` files (HTML, CSS, JS)
- Changes to data files that alter what the dashboard displays (e.g., `dashboard-data.json`, TopoJSON files)
- Changes to ETL scripts that affect the shape or content of frontend data

If your change has no visual impact, state that explicitly in the PR description.

### Commit conventions

- Write commit messages in English
- Keep the first line under 72 characters
- Reference relevant issues with `#123` syntax

### Data and ETL

- Run `mise run all` before submitting to ensure the full pipeline works
- Don't commit intermediate/raw geodata files (these are in `.gitignore`)
- If you add a new data source, document it in `DATA_SOURCES.md` with licensing info

### Documentation

- Domain docs and user-facing content: Danish
- Code, comments, technical docs: English
- If you discover something new about the domain (policy, data sources, governance), add it to `docs/Learnings.md` — see `.skills/learning-loop/SKILL.md` for the format

## Development setup

```bash
# Install mise (task runner)
curl https://mise.run | sh

# Run the full pipeline
mise run all

# Individual tasks
mise run fetch-data      # Fetch all data sources
mise run prepare-map     # Build TopoJSON from raw geodata
mise run build-dashboard # Build dashboard JSON from MARS data
```

## License

By contributing, you agree that your contributions will be licensed under the same license as this project.
