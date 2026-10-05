"""Shared nature-pipeline constants for ETL (must match src/lib/nature-projects.ts)."""

from __future__ import annotations

NATURE_PIPELINE_MEASURES = frozenset({"Lavbundsprojekter", "Skovrejsning"})
NATURE_EXCLUDED_MEASURES = frozenset({
    "Kvælstofvådområder",
    "Minivådområder",
    "Ekstensivering",
    "Fosforvådområder og ådale",
    "Øvrige",
    "Forundersøgelse VLP",
})
NATURE_OVERLAP_THRESHOLD_HA = 0.1
UROERT_SKOV_TYPE = "uroert_skov"
UROERT_SKOV_TYPE_ID = "434633e0-4241-4f38-b451-f2b45b70ebd4"

# MARS fieldDatasetConfigurations: crop codes that are NOT farmland.
MARS_EXCLUDED_AFGKODER = frozenset({
    "271", "311", "316", "317", "318", "319", "321", "322", "326",
    "565", "566", "567", "575", "576", "577", "578", "580", "581",
    "585", "586", "587", "589", "590", "900",
})


def is_nature_pipeline_measure(name: str | None) -> bool:
    return (name or "") in NATURE_PIPELINE_MEASURES
