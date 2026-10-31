import argparse
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_TYPES = ["highway", "rail", "irrigation", "power", "urban"]
CURRENT_STAGES = ["planning", "sia", "notification", "award", "compensation", "possession", "rr"]
DISTRICTS = {
    "Pune": {"lat": 18.5204, "lon": 73.8567},
    "Nashik": {"lat": 20.5942, "lon": 73.9362},
    "Nagpur": {"lat": 21.1458, "lon": 79.0882},
    "Aurangabad": {"lat": 19.8762, "lon": 75.3433},
    "Thane": {"lat": 19.2183, "lon": 72.9781},
}


def resolve_repo_root():
    return Path(__file__).resolve().parents[2]


def parse_args():
    parser = argparse.ArgumentParser(description="Generate ongoing project CSVs for LandSentinel.")
    parser.add_argument("--n", type=int, default=50)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", type=str, default="data/ongoing")
    return parser.parse_args()


def pick_story_counts(n):
    if n == 50:
        return {"high": 10, "medium": 20, "low": 20}
    high = max(1, round(n * 0.2))
    low = max(1, round(n * 0.4))
    medium = max(1, n - high - low)
    return {"high": high, "medium": medium, "low": low}


def project_name(project_type, district, idx):
    names = {
        "highway": [
            "Pune-Nashik Highway Phase 2",
            "Nagpur-Mumbai Highway Expansion",
            "Thane Bypass Road Corridor",
            "Aurangabad Highway Upgradation",
        ],
        "rail": [
            "Nashik Rail Freight Corridor",
            "Pune Metro Rail Extension",
            "Nagpur Rail Link Project",
        ],
        "irrigation": [
            "Aurangabad Lift Irrigation Phase 3",
            "Nashik Canal Modernisation",
            "Nagpur Water Distribution Project",
        ],
        "power": [
            "Thane Substation Upgrade",
            "Pune Power Transmission Expansion",
            "Nagpur Solar Evacuation Project",
        ],
        "urban": [
            "Pune Urban Redevelopment Zone",
            "Nagpur Smart City Mixed Use",
            "Thane Riverfront Redevelopment",
        ],
    }
    pool = names.get(project_type, [f"{district} {project_type.title()} Project"])
    if idx < len(pool):
        return pool[idx]
    return f"{district} {project_type.title()} Project {idx + 1}"


def date_range(start_year, end_year, rng):
    start = pd.Timestamp(f"{start_year}-01-01")
    end = pd.Timestamp(f"{end_year}-12-31")
    days = (end - start).days
    offset = int(rng.integers(0, max(1, days + 1)))
    return (start + pd.Timedelta(days=offset)).strftime("%Y-%m-%d")


def maybe_pending_date(rng, days_late=0):
    base = pd.Timestamp("2024-01-01") + pd.Timedelta(days=int(rng.integers(0, 500)))
    if days_late > 0:
        base += pd.Timedelta(days=days_late)
    return base.strftime("%Y-%m-%d")


def make_projects(n, seed):
    rng = np.random.default_rng(seed)
    counts = pick_story_counts(n)
    project_rows = []
    project_meta = []
    idx = 0

    story_sequence = ["high"] * counts["high"] + ["medium"] * counts["medium"] + ["low"] * counts["low"]
    rng.shuffle(story_sequence)
    if len(story_sequence) < n:
        story_sequence += ["medium"] * (n - len(story_sequence))
    if len(story_sequence) > n:
        story_sequence = story_sequence[:n]

    if n >= 50:
        story_sequence[0] = "high"
        story_sequence[1] = "low"
        story_counts = {"high": 10, "medium": 20, "low": 20}
        story_sequence = ["high"] * story_counts["high"] + ["medium"] * story_counts["medium"] + ["low"] * story_counts["low"]
        rng.shuffle(story_sequence)
        story_sequence[0] = "high"
        story_sequence[1] = "low"

    for story in story_sequence:
        project_type = rng.choice(PROJECT_TYPES)
        district = list(DISTRICTS.keys())[idx % 5]

        if story == "high":
            land_area_ha = int(rng.integers(180, 500))
            families_affected = int(rng.integers(900, 2200))
            rr_progress_pct = int(rng.integers(10, 35))
            officer_response_days = int(rng.integers(25, 60))
            litigation_count = int(rng.integers(6, 14))
            compensation_disputes = int(rng.integers(4, 12))
            stage = rng.choice(["compensation", "possession", "rr"])
        elif story == "medium":
            land_area_ha = int(rng.integers(120, 260))
            families_affected = int(rng.integers(450, 900))
            rr_progress_pct = int(rng.integers(30, 65))
            officer_response_days = int(rng.integers(15, 35))
            litigation_count = int(rng.integers(2, 7))
            compensation_disputes = int(rng.integers(2, 6))
            stage = rng.choice(["award", "compensation", "possession", "rr"])
        else:
            land_area_ha = int(rng.integers(60, 180))
            families_affected = int(rng.integers(180, 500))
            rr_progress_pct = int(rng.integers(55, 85))
            officer_response_days = int(rng.integers(5, 20))
            litigation_count = int(rng.integers(0, 3))
            compensation_disputes = int(rng.integers(0, 2))
            stage = rng.choice(["planning", "sia", "notification", "award"])

        if idx == 0:
            project_type = "highway"
            district = "Pune"
            story = "high"
            land_area_ha = 120
            families_affected = 800
            rr_progress_pct = 24
            officer_response_days = 22
            litigation_count = 9
            compensation_disputes = 5
            stage = "possession"
            name = "Pune-Nashik Highway Phase 2"
        elif idx == 1:
            project_type = "power"
            district = "Aurangabad"
            story = "low"
            land_area_ha = 90
            families_affected = 280
            rr_progress_pct = 68
            officer_response_days = 12
            litigation_count = 2
            compensation_disputes = 1
            stage = "award"
            name = "Aurangabad Power Distribution Upgrade"
        else:
            name = project_name(project_type, district, idx)

        project_id = f"PRJ-{idx + 1:04d}"
        planned_start = date_range(2019, 2025, rng)
        planned_end = (pd.Timestamp(planned_start) + pd.Timedelta(days=int(rng.integers(180, 1100)))).strftime("%Y-%m-%d")
        lat = float(DISTRICTS[district]["lat"] + rng.normal(0.15, 0.22))
        lon = float(DISTRICTS[district]["lon"] + rng.normal(0.1, 0.2))
        agency = {
            "highway": "National Highways Authority of India",
            "rail": "Indian Railways",
            "irrigation": "State Irrigation Department",
            "power": "State Power Transmission Utility",
            "urban": "Urban Development Authority",
        }.get(project_type, "State Infrastructure Authority")

        project_rows.append(
            {
                "project_id": project_id,
                "name": name,
                "type": project_type,
                "agency": agency,
                "state": "Maharashtra",
                "district": district,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "land_area_ha": land_area_ha,
                "families_affected": families_affected,
                "families_resettlement": int(families_affected * rng.uniform(0.35, 0.8)),
                "budget": int(land_area_ha * rng.uniform(450000, 1400000)),
                "planned_start": planned_start,
                "planned_end": planned_end,
                "current_stage": stage,
                "status": "active",
                "rr_progress_pct": rr_progress_pct,
                "officer_response_days": officer_response_days,
                "created_by": "",
                "created_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )
        project_meta.append(
            {
                "project_id": project_id,
                "risk_story": story,
                "district": district,
                "project_type": project_type,
                "litigation_count": litigation_count,
                "compensation_disputes": compensation_disputes,
            }
        )
        idx += 1

    return pd.DataFrame(project_rows), pd.DataFrame(project_meta)


def generate_parcels(project_rows, rng):
    rows = []
    for _, project in project_rows.iterrows():
        parcel_count = int(rng.integers(5, 41))
        for pidx in range(1, parcel_count + 1):
            parcel_id = f"PAR-{project['project_id']}-{pidx:03d}"
            rows.append(
                {
                    "parcel_id": parcel_id,
                    "project_id": project["project_id"],
                    "survey_no": f"{int(rng.integers(100, 500))}/{chr(65 + (pidx % 6))}",
                    "area_ha": round(float(rng.uniform(2.0, 18.0)), 2),
                    "land_type": rng.choice(["private", "government", "forest"]),
                    "compensation_status": rng.choice(["pending", "partial", "paid"]),
                    "possession_status": rng.choice(["pending", "handed_over"]),
                    "doc_complete": bool(rng.random() < 0.82),
                    "ownership_dispute": bool(rng.random() < 0.18),
                }
            )
    return pd.DataFrame(rows)


def generate_cases(parcels_df, rng):
    rows = []
    case_counter = 1
    for _, parcel in parcels_df.iterrows():
        case_count = int(rng.integers(0, 13))
        if parcel["ownership_dispute"]:
            case_count = max(case_count, 1)
        for _ in range(case_count):
            case_id = f"CAS-{case_counter:05d}"
            rows.append(
                {
                    "case_id": case_id,
                    "parcel_id": parcel["parcel_id"],
                    "category": rng.choice(["title dispute", "encroachment", "compensation", "stay", "land acquisition"]),
                    "filing_date": date_range(2020, 2025, rng),
                    "status": rng.choice(["pending", "disposed"]),
                    "stay_order": bool(rng.random() < 0.35),
                    "hearings": int(rng.integers(1, 12)),
                }
            )
            case_counter += 1
    return pd.DataFrame(rows)


def generate_approvals(project_rows, rng):
    rows = []
    approval_names = [
        "survey_clearance",
        "social_impact_assessment",
        "title_verification",
        "award_approval",
        "compensation_approval",
        "possession_clearance",
    ]
    for _, project in project_rows.iterrows():
        approval_count = int(rng.integers(3, 6))
        chosen = rng.choice(approval_names, size=approval_count, replace=False)
        for name in chosen:
            planned_date = maybe_pending_date(rng, 0)
            status = rng.choice(["pending", "cleared"])
            actual_date = None if status == "pending" else maybe_pending_date(rng, int(rng.integers(0, 200)))
            rows.append(
                {
                    "approval_id": f"APP-{project['project_id']}-{name}",
                    "project_id": project["project_id"],
                    "name": name,
                    "planned_date": planned_date,
                    "actual_date": actual_date,
                    "status": status,
                }
            )
    return pd.DataFrame(rows)


def generate_compensation(project_rows, rng):
    rows = []
    for _, project in project_rows.iterrows():
        award_amount = int(project["land_area_ha"] * rng.uniform(1200000, 2600000))
        disbursed_amount = int(award_amount * rng.uniform(0.35, 0.9))
        rows.append(
            {
                "project_id": project["project_id"],
                "award_amount": award_amount,
                "disbursed_amount": disbursed_amount,
                "disputes": int(rng.integers(0, 10)),
            }
        )
    return pd.DataFrame(rows)


def generate_incidents(project_rows, rng):
    rows = []
    incident_counter = 1
    for _, project in project_rows.iterrows():
        incident_count = int(rng.integers(0, 5))
        # make the demo story more obvious for the first high-risk project
        if project["project_id"] == "PRJ-0001":
            incident_count = 3
        for _ in range(incident_count):
            rows.append(
                {
                    "incident_id": f"INC-{incident_counter:05d}",
                    "project_id": project["project_id"],
                    "type": rng.choice(["encroachment", "obstruction"]),
                    "incident_date": date_range(2022, 2025, rng),
                    "encroached_area_ha": round(float(rng.uniform(1.5, 18.0)), 2),
                }
            )
            incident_counter += 1
    return pd.DataFrame(rows)


def save_outputs(df_dict, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, df in df_dict.items():
        if df is not None and not df.empty:
            df.to_csv(out_dir / f"{name}.csv", index=False)


def main():
    args = parse_args()
    repo_root = resolve_repo_root()
    out_dir = (repo_root / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)

    rng = np.random.default_rng(args.seed)
    project_rows, project_meta = make_projects(args.n, args.seed)
    parcels = generate_parcels(project_rows, rng)
    cases = generate_cases(parcels, rng)
    approvals = generate_approvals(project_rows, rng)
    compensation = generate_compensation(project_rows, rng)
    incidents = generate_incidents(project_rows, rng)

    save_outputs(
        {
            "projects": project_rows,
            "parcels": parcels,
            "cases": cases,
            "approvals": approvals,
            "compensation": compensation,
            "incidents": incidents,
        },
        out_dir,
    )

    # Write tiny test set as a subset of the main set.
    tiny_count = min(5, len(project_rows))
    tiny_projects = project_rows.head(tiny_count).copy()
    tiny_project_ids = set(tiny_projects["project_id"])
    tiny_parcels = parcels[parcels["project_id"].isin(tiny_project_ids)].copy()
    tiny_cases = cases[cases["parcel_id"].isin(set(tiny_parcels["parcel_id"]))].copy()
    tiny_approvals = approvals[approvals["project_id"].isin(tiny_project_ids)].copy()
    tiny_comp = compensation[compensation["project_id"].isin(tiny_project_ids)].copy()
    tiny_incidents = incidents[incidents["project_id"].isin(tiny_project_ids)].copy()

    sample_dir = (repo_root / "data" / "sample_tiny").resolve()
    save_outputs(
        {
            "projects": tiny_projects,
            "parcels": tiny_parcels,
            "cases": tiny_cases,
            "approvals": tiny_approvals,
            "compensation": tiny_comp,
            "incidents": tiny_incidents,
        },
        sample_dir,
    )

    story_counts = project_meta["risk_story"].value_counts().to_dict()
    if "high" not in story_counts:
        story_counts["high"] = 0
    if "medium" not in story_counts:
        story_counts["medium"] = 0
    if "low" not in story_counts:
        story_counts["low"] = 0

    print(f"Generated {len(project_rows)} projects to {out_dir}")
    print(f"File counts: projects={len(project_rows)}, parcels={len(parcels)}, cases={len(cases)}, approvals={len(approvals)}, compensation={len(compensation)}, incidents={len(incidents)}")
    print(f"Risk story counts: {story_counts}")
    print(f"Saved tiny sample set to {sample_dir}")


if __name__ == "__main__":
    main()
