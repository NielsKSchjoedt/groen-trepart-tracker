"""
MARS official WFS (https://mars.sgav.dk/geo/wfs) — fetch + mapping helpers (stdlib only).

MARS publishes an official, documented GeoServer WFS next to its (undocumented) REST
API. It is refreshed nightly (~01:00 UTC) and needs no key. We use it as the primary
source for:

  * the flat project list (`mars:projekter_samlet`, one row per project in a formal
    phase: forundersøgelsestilsagn / etableringstilsagn / anlagt), mapped into the
    REST `/api/status/projects` row shape so every downstream consumer is unchanged;
  * forest sub-polygons (`mars:projekter_tilskudsordning_skovrejsning`), which
    replace the REST `supplementaryGeometries` list;
  * project and sketch geometries (`mars:projekter_samlet`, `mars:skitseprojekter`)
    in a few bulk calls instead of one REST call per geometry.

Verified 2026-11-06 against REST on the same day: identical ids, names, effects,
areas, scheme/measure (by name), status (by state name) and geometries
(shapely `equals_exact`, 1e-6 m) for every project/sketch present in both.

What the WFS does not carry, and where it comes from instead:
  * geoLocationId, applicationTimestamp, includedEffectRewetting → the project's row
    in `/api/status/plans` (REST, fetched in the same run; whole-project fields).
  * rows changed after the nightly WFS refresh (new projects, status changes) → the
    REST `/api/status/projects` row (fetched lazily, only when needed), so the flat
    list never lags the live REST plans/municipality data used in the same build.
"""
from __future__ import annotations

import json
import urllib.parse
from datetime import datetime
from typing import Any, Iterable

from _wfs import http_get

MARS_WFS = "https://mars.sgav.dk/geo/wfs"
LAYER_PROJECTS = "mars:projekter_samlet"
LAYER_SKETCHES = "mars:skitseprojekter"
LAYER_FOREST = "mars:projekter_tilskudsordning_skovrejsning"
SRS_UTM32 = "EPSG:25832"

# Forest layer: the project outline itself; every other geometri_type is a sub-polygon
# (REST supplementaryGeometries).
FOREST_PROJECT_POLYGON = "Projektpolygon"

# The formal phases the flat project list contains (same as REST /status/projects).
FORMAL_STATES = (6, 10, 15)
PHASE_DATE_FIELD = {
    6: "forundersoegelsestilsagn_dato",
    10: "etableringstilsagn_dato",
    15: "anlaegelse_dato",
}


def wfs_url(type_name: str, srs: str = SRS_UTM32) -> str:
    q = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": type_name,
        "outputFormat": "application/json",
        "srsName": srs,
    }
    return MARS_WFS + "?" + urllib.parse.urlencode(q, safe=":")


def fetch_layer(type_name: str, *, timeout: float = 120) -> list[dict[str, Any]]:
    """GET one whole MARS WFS layer as GeoJSON features (EPSG:25832).

    The layers are small (≤ ~50 MB, ≤ ~5,000 features), so one request per layer is
    enough; GeoServer returns them all without paging.
    """
    raw = http_get(wfs_url(type_name), timeout=timeout)
    fc = json.loads(raw.decode("utf-8"))
    if fc.get("type") != "FeatureCollection":
        raise RuntimeError(f"Unexpected WFS response for {type_name}: {str(fc)[:200]}")
    feats = fc.get("features") or []
    matched = fc.get("numberMatched")
    if isinstance(matched, int) and matched != len(feats):
        raise RuntimeError(f"{type_name}: got {len(feats)} of {matched} features (paging needed)")
    return feats


# ---------------------------------------------------------------------------
# Lookups from REST master-data (names in the WFS → ids in the REST shape)
# ---------------------------------------------------------------------------

def _unique_name_map(items: Iterable[dict], name_key: str, id_key: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    dup: set[str] = set()
    for it in items:
        name = it.get(name_key)
        if not name:
            continue
        if name in out and out[name] != it.get(id_key):
            dup.add(name)
        out[name] = it.get(id_key)
    for name in dup:
        del out[name]
    return out


def build_lookups(master: dict) -> dict[str, dict[str, Any]]:
    """Name → id maps for states, subsidy schemes, measures and forest sub-polygon types.

    State names are not all unique in MARS (e.g. "Udbetaling • Anmodet" is both 31 and
    33); the flat list only uses the formal states 6/10/15, which are unique and win.
    """
    states = _unique_name_map(master.get("states") or [], "name", "stateNr")
    for s in master.get("states") or []:
        if s.get("stateNr") in FORMAL_STATES:
            states[s["name"]] = s["stateNr"]
    types: dict[str, str] = {}
    for scheme in master.get("subsidySchemes") or []:
        for t in scheme.get("supplementaryGeometryTypes") or []:
            if t.get("title") and t.get("id"):
                types.setdefault(t["title"], t["id"])
    return {
        "state": states,
        "scheme": _unique_name_map(master.get("subsidySchemes") or [], "name", "id"),
        "measure": _unique_name_map(master.get("mitigationMeasures") or [], "name", "id"),
        "supplType": types,
    }


# ---------------------------------------------------------------------------
# Mapping WFS rows → REST /status/projects row shape
# ---------------------------------------------------------------------------

def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _iso(value: str | None) -> str | None:
    """WFS dates are '...T11:32:46.407Z'; REST uses '+00:00'. Normalise to REST style."""
    dt = _parse_ts(value)
    return dt.isoformat() if dt else None


def supplementary_from_forest(
    rows: list[dict[str, Any]], lookups: dict[str, dict[str, Any]]
) -> list[dict[str, Any]] | None:
    """Forest-layer sub-polygons of one project → REST supplementaryGeometries list.

    REST additionally lists zero-area "Ekstra tilskudsareal" placeholders (no geometry);
    the WFS omits them. They carry no area, so every area sum is unchanged.
    """
    out = []
    for f in rows:
        p = f.get("properties") or {}
        gtype = p.get("geometri_type")
        if not gtype or gtype == FOREST_PROJECT_POLYGON:
            continue
        out.append({
            "name": p.get("geometri_navn") or gtype,
            "areaHa": p.get("areal_ha"),
            "supplementaryGeometryTypeId": lookups["supplType"].get(gtype),
            "geoLocationId": None,
        })
    return out or None


def wfs_project_row(
    props: dict[str, Any],
    lookups: dict[str, dict[str, Any]],
    plan_row: dict[str, Any] | None,
    forest_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """One `mars:projekter_samlet` feature's properties → REST project row (+ WFS extras).

    `plan_row` is the project's row in REST /status/plans (any plan; the fields taken
    from it are whole-project, not clipped).
    """
    plan_row = plan_row or {}
    status = lookups["state"].get(props.get("status"))
    phase_field = PHASE_DATE_FIELD.get(status)
    # lastStateChanged == the date of the current phase (verified 1,667/1,667; the WFS
    # rounds to milliseconds, so the live plan row's value is preferred when present).
    last_changed = _iso(props.get(phase_field)) if phase_field else None
    return {
        "projectId": props.get("mars_id"),
        "projectName": props.get("titel"),
        "projectStatus": status,
        "nitrogenReductionT": props.get("kvaelstofeffekt_t"),
        "extractionEffortHa": props.get("udtagningseffekt_ha"),
        "afforestationEffortHa": props.get("skovrejsningseffekt_ha"),
        "overlappingAreaHa": props.get("areal_ha"),
        "geoLocationId": plan_row.get("geoLocationId"),
        "subsidySchemeId": lookups["scheme"].get(props.get("tilskudsordning")),
        "mitigationMeasureId": lookups["measure"].get(props.get("virkemiddel")),
        "applicationTimestamp": plan_row.get("applicationTimestamp"),
        "lastStateChanged": plan_row.get("lastStateChanged") or last_changed,
        "includedEffectRewetting": plan_row.get("includedEffectRewetting", False),
        "supplementaryGeometries": supplementary_from_forest(forest_rows or [], lookups),
        # Official WFS-only fields (not in REST).
        "sagsId": props.get("sags_id") or None,
        "ansoeger": props.get("ansoeger") or None,
        "ansoegningsrundeAar": props.get("ansoegningsrunde_aar"),
        "forundersoegelsestilsagnDato": _iso(props.get("forundersoegelsestilsagn_dato")),
        "etableringstilsagnDato": _iso(props.get("etableringstilsagn_dato")),
        "anlaegelseDato": _iso(props.get("anlaegelse_dato")),
        "source": "wfs",
        "wfsUpdated": _iso(props.get("updated")),
    }


def plan_rows_by_project(plans: list[dict]) -> dict[str, dict]:
    """projectId → first plan-nested REST row (whole-project fields are equal across plans)."""
    out: dict[str, dict] = {}
    for plan in plans or []:
        for row in plan.get("projects") or []:
            pid = row.get("projectId")
            if pid and pid not in out:
                out[pid] = row
    return out


def unmapped_fields(row: dict[str, Any]) -> list[str]:
    """Required REST fields the mapping could not fill (unknown name / no plan row)."""
    return [
        k for k in ("projectStatus", "subsidySchemeId", "mitigationMeasureId", "geoLocationId")
        if row.get(k) in (None, "")
    ]


def stale_project_ids(wfs_rows: dict[str, dict], plan_rows: dict[str, dict]) -> set[str]:
    """Ids whose WFS row cannot be trusted for this run.

    * in the live REST plans but not in the nightly WFS snapshot (created since), or
      in the snapshot but no longer in plans (withdrawn since);
    * status differs from the live plans (changed since the snapshot);
    * a required field could not be mapped (e.g. a scheme renamed in master-data).
    """
    stale = set(plan_rows) ^ set(wfs_rows)
    for pid, row in wfs_rows.items():
        pr = plan_rows.get(pid)
        if pr is not None and pr.get("projectStatus") != row.get("projectStatus"):
            stale.add(pid)
        if unmapped_fields(row):
            stale.add(pid)
    return stale


def merge_with_rest_fallback(
    wfs_rows: dict[str, dict],
    stale: set[str],
    rest_rows: list[dict] | None,
) -> list[dict]:
    """Replace stale WFS rows with the live REST row; add REST-only projects.

    Without REST (fallback fetch failed) the WFS rows are kept as they are, and
    projects that exist only in REST are missing — the caller logs that.
    """
    rest_by_id = {r.get("projectId"): r for r in rest_rows or []}
    out: dict[str, dict] = {}
    for pid, row in wfs_rows.items():
        if pid in stale and rest_rows is not None:
            if pid not in rest_by_id:
                continue  # withdrawn since the snapshot
            out[pid] = {**rest_by_id[pid], "source": "rest-fallback"}
            # Keep the official phase history the REST row lacks.
            for k in ("sagsId", "ansoeger", "ansoegningsrundeAar", "forundersoegelsestilsagnDato",
                      "etableringstilsagnDato", "anlaegelseDato"):
                out[pid][k] = row.get(k)
        else:
            out[pid] = row
    if rest_rows is not None:
        for pid in stale:
            if pid not in out and pid in rest_by_id:
                out[pid] = {**rest_by_id[pid], "source": "rest-fallback"}
    return sorted(out.values(), key=lambda r: r.get("projectId") or "")


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _fmt(v: float) -> str:
    return repr(float(v))


def geojson_to_wkt(geom: dict[str, Any] | None) -> str | None:
    """GeoJSON Polygon/MultiPolygon → WKT MULTIPOLYGON (same layout as REST geometryWkt)."""
    if not geom:
        return None
    t = geom.get("type")
    coords = geom.get("coordinates") or []
    if t == "Polygon":
        polys = [coords]
    elif t == "MultiPolygon":
        polys = coords
    else:
        return None
    parts = []
    for poly in polys:
        rings = ["(" + ", ".join(f"{_fmt(c[0])} {_fmt(c[1])}" for c in ring) + ")" for ring in poly]
        parts.append("(" + ", ".join(rings) + ")")
    if not parts:
        return None
    return "MULTIPOLYGON (" + ", ".join(parts) + ")"
