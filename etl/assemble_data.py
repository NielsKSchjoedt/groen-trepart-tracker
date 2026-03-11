#!/usr/bin/env python3
"""
Assemble MARS and DAWA data from browser-extracted CSV/pipe-delimited files
into proper JSON data files for the tracker.

This script is used when the VM cannot directly fetch APIs (sandbox proxy)
and data was extracted via browser JavaScript in pipe-delimited format.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MARS_DIR = REPO_ROOT / "data" / "mars"
DAWA_DIR = REPO_ROOT / "data" / "dawa"

FETCH_TIMESTAMP = datetime.now(timezone.utc).isoformat()

# ============================================================
# MARS Plans Data (37 kystvandgrupper)
# Extracted from /api/status/plans
# Format: name|nGoal|nAchieved|established|approved|assessed|sketch
# ============================================================
PLANS_CSV = """Anholt|0|0|0|0|0|0
Århus Bugt og Begtrup Vig|2.641|1.0761069575399347|1|5|6|24
Århus Bugt syd, Samsø og Nordlige Bælthav|660.053|320.794943428001|5|40|38|477
Det sydfynske Øhav|192.869|34.00550455998287|0|9|7|462
Djursland Øst|94.911|89.42818578077075|1|7|9|44
Ebeltoft Vig|0.001|1.0041396099271829|0|0|1|0
Fakse Bugt|112.029|4.980898784183544|1|5|5|58
Femerbælt|390.242|149.70812543167597|0|15|14|105
Grønsund|123.639|43.455333216565855|0|8|4|43
Guldborgsund|0|0.07032681547000383|0|4|3|26
Hevring Bugt|304.653|278.3787786105519|5|33|46|153
Hjelm Bugt|30.538|14.734228732436424|0|4|2|14
Jammerland Bugt og Musholm Bugt|446.665|154.4910639154589|6|15|10|122
Kalundborg Fjord|7.634|0.6197838899419388|0|0|1|3
Kattegat, Aalborg Bugt|212.156|24.204556628138523|2|7|15|176
Kattegat, Læsø|0|0|0|0|2|0
Kattegat, Nordsjælland|984.61|110.03866591898932|6|12|32|340
Køge Bugt|0|50.85680033223888|0|4|6|100
Langelandssund|115.02|15.05644325508821|1|5|11|278
Lillebælt, Bredningen|426.159|94.27272644494178|1|18|23|219
Lillebælt, Snævringen|403.548|49.19688512493646|2|8|25|104
Lillebælt, syd|217.429|23.057778249939272|5|6|30|487
Nibe Bredning og Langerak|2868.116|1112.8423353035666|7|122|138|701
Nordlige Kattegat, Ålbæk Bugt|0|0.08524739417423388|0|1|7|13
Nordlige Lillebælt|271.113|150.68533465020266|3|15|33|156
Nordlige Øresund|0|0.009600255676510927|2|0|6|60
Østersøen, Bornholm|0|0|0|0|3|0
Østersøen, Christiansø|0|0|0|0|0|0
Sejerø Bugt|10.222|0.7717965112268153|0|1|4|30
Skagerrak|0|5.097928885781499|0|5|7|24
Smålandsfarvandet, åbne del|171.273|33.986799484017986|1|18|17|129
Smålandsfarvandet, syd|0|8.654390384056379|0|4|5|25
Stege Bugt|69.998|3.5594433426251877|1|3|2|37
Storebælt, NV|77.721|5.083947299542546|1|2|2|91
Storebælt, SV|12.759|7.228779211320056|3|1|3|73
Vesterhavet, nord|2142.85|645.9669203135061|13|36|98|229
Vesterhavet, syd|2420.633|0|17|49|101|457"""

# ============================================================
# MARS VOS Data (23 vandopland / main catchments)
# Extracted from /api/status/vos
# Format: name|nReduction|extHa|affHa|established|approved|assessed|sketch
# ============================================================
VOS_CSV = """Nordlige Kattegat, Skagerrak|5.716952042281097|0|0|1|10|19|78
Vadehavet|348.76886197172746|0|0|13|44|83|372
Lillebælt/Jylland|223.29166644137024|0|0|10|23|90|866
Lillebælt/Fyn|93.92203917593416|0|0|1|24|24|321
Odense Fjord|225.11633838343596|0|0|1|26|13|363
Storebælt|26.787679151241036|0|0|4|6|11|308
Det Sydfynske Øhav|34.58694557267291|0|0|1|10|10|586
Limfjorden|1112.8413830700488|0|0|7|122|138|701
Mariager Fjord|23.67176858775036|0|0|1|3|10|136
Nissum Fjord|389.2783120137599|0|0|2|15|33|87
Randers Fjord|276.90398202782336|0|0|5|31|42|148
Djursland|91.90633226234249|0|0|1|10|13|49
Århus Bugt|2.2062078596300756|0|13.667855660624372|1|5|7|48
Ringkøbing Fjord|256.6853240605765|0|0|11|21|70|145
Horsens Fjord|94.54930395853545|0|0|4|14|24|91
Kalundborg|142.54888806465678|0|0|3|11|9|92
Isefjord og Roskilde Fjord|89.84194650670514|0|0|5|12|28|320
Øresund|20.198067105594088|0|0|5|0|8|77
Køge Bugt|50.857250662336654|986.7016611732066|0|0|4|6|100
Smålandsfarvandet|99.55495144400604|0|0|4|38|30|241
Østersøen|0|0|0|0|0|3|0
Nordlige Kattegat, Kattegat|134.34023177952605|0|0|8|19|52|528
Vestlige Kattegat|89.20403519145416|0|0|0|14|10|446"""

# ============================================================
# MARS Project Summary
# From /api/status/projects aggregation
# ============================================================
PROJECTS_SUMMARY = {
    "totalCount": 1164,
    "byStatus": {
        "6": 450,   # Forundersøgelsestilsagn
        "10": 634,  # Etableringstilsagn
        "15": 80    # Anlagt (completed)
    },
    "totalNitrogenReductionT": 3833.777,
    "totalExtractionEffortHa": 82235.695,
    "totalAfforestationEffortHa": 2375.556
}

# ============================================================
# MARS Master Data
# ============================================================
NATIONAL_GOALS = {
    "nitrogenReductionGoalT": 12776,
    "extractionEffortGoalHa": 140000,
    "afforestationEffortGoalHa": 250000
}

PROJECT_STATES = {
    "1": "Kladde",
    "2": "Forundersøgelse • Ansøgt",
    "3": "Forundersøgelse • Opgivet",
    "5": "Forundersøgelse • Afslag",
    "6": "Forundersøgelsestilsagn",
    "9": "Etablering • Ansøgt",
    "10": "Etableringstilsagn",
    "11": "Udbetaling/anlæggelse • Anmodet",
    "15": "Anlagt",
    "16": "Etablering • Opgivet",
    "17": "Etablering • Afslag",
    "20": "Forundersøgelsestilsagn • Ændringsanmodning",
    "21": "Etableringstilsagn • Ændringsanmodning",
    "50": "Høring • Forundersøgelse",
    "51": "Høring • Forundersøgelse ændring",
    "52": "Høring • Etablering",
    "53": "Høring • Udbetaling",
    "54": "Høring • Ændringsanmodning"
}

SUBSIDY_SCHEMES_CSV = """06e8192e-7fcf-46c6-854c-7441e0adbe4b|Permanent ekstensivering||2|true|0.3|
0c0fb584-18d3-4bd2-9a87-d113eccc6537|Øvrig udtagning||1|true||
13ccc329-af28-4f1a-b389-930aa94bef26|SGAV Klima-Lavbund||1|true||60
25301a9d-2e61-4305-911b-d437ccd1918c|Minivådområder||2|true||
5551b8e5-cc17-4e86-89a0-6e763f5594f0|NST Skovrejsning||1|true||
5c8902bd-4804-483c-9d58-94784002b83e|Restaurering af ådale||1|true||
82f3f7fe-bedd-484e-89d4-a689b02b1bf2|Skovrejsning||2|true|1|
9df33a22-2ec7-47fb-b5ad-5c45e2a06979|Lavbundsprojekter||1|true||60
a1f3e207-4a9c-433d-a58a-dca8e12feabf|Kvælstofvådområder||1|true||
c12af4e6-eb14-4565-a151-c07445830b32|NST Kvælstofvådområder||1|true||
cba92156-2729-4a13-843a-e264cc3c8a25|KLA-Lavbund||1|true|1|0
cd5e848f-f6db-4c0d-b312-e5fa11a54965|KLA-Kvælstofvådområder||1|true|1|
d94c569c-a7f2-4c24-92e0-dd8a539ebe92|NST Klima-Lavbund||1|true||60
dcea4652-70cf-4572-b645-2cee2193e2fa|NST Øvrige statslige projekter||1|true||
e1ed6ffa-f5ab-469f-90b3-6f62f55e8dbd|NST Lavbundsprojekter||1|true||60
f3393a6f-6b93-4e11-a27e-fc78e40e2dab|Klima-Lavbund||2|true|1|60
fcd5e5a3-8b94-49ee-b5fc-b9c4ebd519e3|MVO2024||1|true||"""


def parse_plans():
    plans = []
    for line in PLANS_CSV.strip().split('\n'):
        parts = line.split('|')
        plans.append({
            "name": parts[0],
            "nitrogenReductionGoalT": float(parts[1]),
            "totalNitrogenReductionT": float(parts[2]),
            "countEstablishedProjects": int(parts[3]),
            "countApprovedProjects": int(parts[4]),
            "countAssessedProjects": int(parts[5]),
            "countSketchProjects": int(parts[6]),
        })
    return plans


def parse_vos():
    catchments = []
    for line in VOS_CSV.strip().split('\n'):
        parts = line.split('|')
        catchments.append({
            "name": parts[0],
            "totalNitrogenReductionT": float(parts[1]),
            "totalExtractionEffortHa": float(parts[2]),
            "totalAfforestationEffortHa": float(parts[3]),
            "countEstablishedProjects": int(parts[4]),
            "countApprovedProjects": int(parts[5]),
            "countAssessedProjects": int(parts[6]),
            "countSketchProjects": int(parts[7]),
        })
    return catchments


def parse_subsidy_schemes():
    schemes = []
    for line in SUBSIDY_SCHEMES_CSV.strip().split('\n'):
        parts = line.split('|')
        schemes.append({
            "id": parts[0],
            "name": parts[1],
            "org": parts[2] or None,
            "flowNr": int(parts[3]) if parts[3] else None,
            "active": parts[4] == "true",
            "minAreaHa": float(parts[5]) if parts[5] else None,
            "requiredCarbonOverlapPercentage": int(parts[6]) if parts[6] else None,
        })
    return schemes


def main():
    MARS_DIR.mkdir(parents=True, exist_ok=True)
    DAWA_DIR.mkdir(parents=True, exist_ok=True)

    # --- MARS Plans ---
    plans = parse_plans()
    plans_data = {
        "fetchedAt": FETCH_TIMESTAMP,
        "source": "mars.sgav.dk/api/status/plans",
        "count": len(plans),
        "plans": plans,
    }
    with open(MARS_DIR / "plans.json", "w", encoding="utf-8") as f:
        json.dump(plans_data, f, ensure_ascii=False, indent=2)

    # --- MARS VOS ---
    vos = parse_vos()
    vos_data = {
        "fetchedAt": FETCH_TIMESTAMP,
        "source": "mars.sgav.dk/api/status/vos",
        "count": len(vos),
        "catchments": vos,
    }
    with open(MARS_DIR / "vos.json", "w", encoding="utf-8") as f:
        json.dump(vos_data, f, ensure_ascii=False, indent=2)

    # --- MARS Projects Summary ---
    projects_data = {
        "fetchedAt": FETCH_TIMESTAMP,
        "source": "mars.sgav.dk/api/status/projects",
        "summary": PROJECTS_SUMMARY,
        "stateNames": PROJECT_STATES,
    }
    with open(MARS_DIR / "projects.json", "w", encoding="utf-8") as f:
        json.dump(projects_data, f, ensure_ascii=False, indent=2)

    # --- MARS Master Data ---
    master_data = {
        "fetchedAt": FETCH_TIMESTAMP,
        "source": "mars.sgav.dk/api/master-data",
        "nationalGoals": NATIONAL_GOALS,
        "projectStates": PROJECT_STATES,
        "subsidySchemes": parse_subsidy_schemes(),
    }
    with open(MARS_DIR / "master-data.json", "w", encoding="utf-8") as f:
        json.dump(master_data, f, ensure_ascii=False, indent=2)

    # --- Summary ---
    total_n_goal = sum(p["nitrogenReductionGoalT"] for p in plans)
    total_n_achieved = sum(p["totalNitrogenReductionT"] for p in plans)
    progress_pct = round(total_n_achieved / total_n_goal * 100, 1) if total_n_goal > 0 else 0

    summary = {
        "fetchedAt": FETCH_TIMESTAMP,
        "nationalGoals": NATIONAL_GOALS,
        "nitrogenProgress": {
            "goalT": round(total_n_goal, 1),
            "achievedT": round(total_n_achieved, 1),
            "progressPct": progress_pct,
        },
        "projects": {
            "total": PROJECTS_SUMMARY["totalCount"],
            "established": PROJECTS_SUMMARY["byStatus"]["15"],
            "approvedOrAssessing": PROJECTS_SUMMARY["byStatus"]["10"],
            "preliminaryStudy": PROJECTS_SUMMARY["byStatus"]["6"],
        },
        "plans": {"count": len(plans)},
        "catchments": {"count": len(vos)},
    }
    with open(MARS_DIR / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Print results
    print(f"Data assembled at {FETCH_TIMESTAMP}")
    print(f"\nFiles written to {MARS_DIR}/:")
    for f in sorted(MARS_DIR.glob("*.json")):
        print(f"  {f.name}: {f.stat().st_size:,} bytes")

    print(f"\n{'=' * 60}")
    print(f"HEADLINE: Kvælstofreduktion")
    print(f"  Mål:      {total_n_goal:,.1f} T")
    print(f"  Opnået:   {total_n_achieved:,.1f} T")
    print(f"  Fremgang: {progress_pct}%")
    print(f"\nProjekter: {PROJECTS_SUMMARY['totalCount']} total")
    print(f"  Anlagt (færdige):        {PROJECTS_SUMMARY['byStatus']['15']}")
    print(f"  Etableringstilsagn:      {PROJECTS_SUMMARY['byStatus']['10']}")
    print(f"  Forundersøgelsestilsagn: {PROJECTS_SUMMARY['byStatus']['6']}")
    print(f"\nPlaner: {len(plans)} kystvandgrupper")
    print(f"Vandoplande: {len(vos)} hovedoplande")


if __name__ == "__main__":
    main()
