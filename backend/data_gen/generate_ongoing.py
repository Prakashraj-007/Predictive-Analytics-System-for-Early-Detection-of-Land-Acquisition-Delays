import argparse
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_TYPES = ["highway", "rail", "irrigation", "power", "urban"]
CURRENT_STAGES = ["planning", "sia", "notification", "award", "compensation", "possession", "rr"]

# Major Tamil Nadu Growth Corridors & Districts with realistic center coordinates
DISTRICTS = {
    "Chennai": {"lat": 13.0827, "lon": 80.2707},
    "Kanchipuram": {"lat": 12.8342, "lon": 79.7036},
    "Tiruvallur": {"lat": 13.1432, "lon": 79.9074},
    "Coimbatore": {"lat": 11.0168, "lon": 76.9558},
    "Madurai": {"lat": 9.9252, "lon": 78.1198},
    "Salem": {"lat": 11.6643, "lon": 78.1460},
    "Tiruchirappalli": {"lat": 10.7905, "lon": 78.7047},
    "Tirunelveli": {"lat": 8.7139, "lon": 77.7567},
    "Erode": {"lat": 11.3410, "lon": 77.7172},
    "Thoothukudi": {"lat": 8.7642, "lon": 78.1348},
}

AGENCIES = [
    "Tamil Nadu Road Development Company (TNRDC)",
    "Tamil Nadu Industrial Development Corporation (TIDCO)",
    "Chennai Metro Rail Limited (CMRL)",
    "State Highways Department (TN)",
    "SIPCOT Industrial Parks",
    "Tamil Nadu Water Supply and Drainage Board (TWAD)",
    "TANGEDCO Power Transmission",
    "Chennai Metropolitan Development Authority (CMDA)",
]

def resolve_repo_root():
    return Path(__file__).resolve().parents[2]


def parse_args():
    parser = argparse.ArgumentParser(description="Generate ongoing project CSVs for LandSentinel (Tamil Nadu).")
    parser.add_argument("--n", type=int, default=60)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", type=str, default="data/ongoing")
    return parser.parse_args()


def pick_story_counts(n):
    high = max(1, round(n * 0.2))
    low = max(1, round(n * 0.4))
    medium = max(1, n - high - low)
    return {"high": high, "medium": medium, "low": low}


def project_name(project_type, district, idx):
    names = {
        "highway": [
            "Chennai Peripheral Ring Road (CPRR) Section 2",
            "Coimbatore Western Bypass Expressway",
            "Madurai AIIMS Outer Ring Connectivity",
            "Salem-Chengapalli 6-Lane Corridor",
            "Tiruchirappalli Semi-Ring Road Phase 1",
            "Thoothukudi Port Coastal Expressway",
        ],
        "rail": [
            "CMRL Phase 2 Metro Corridor Madhavaram to SIPCOT",
            "Coimbatore Metro Rail Feeder Spur",
            "Madurai-Tuticorin Doubling & Freight Rail",
            "Salem Logistics Dedicated Rail Sidings",
            "Chennai-Arakkonam Quadrupling Rail Section",
        ],
        "irrigation": [
            "Cauvery-South Vellar-Gundar River Linking Canal",
            "Athikadavu-Avinashi Groundwater Recharge Phase 2",
            "Tamirabarani-Karumeniyar-Nambiyar River Link",
            "Lower Bhavani Project Canal Modernisation",
            "Parambikulam-Aliyar Water Transfer Network",
        ],
        "power": [
            "Koodankulam-Tuticorin 765kV Green Energy Evacuation",
            "Sriperumbudur High-Voltage Substation Upgrade",
            "Ennore Thermal Replacement Transmission Grid",
            "Coimbatore Industrial Feeder Network Enhancement",
        ],
        "urban": [
            "Parandur Aero City Multimodal Infrastructure",
            "Madurai Smart Industrial Logistics Hub",
            "Hosur IT & Electronics Industrial Corridor",
            "Kanchipuram Heritage Urban Redevelopment",
            "Tiruchirappalli Integrated Bus Terminal & Logistics Zone",
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

    story_sequence[0] = "high"
    story_sequence[1] = "low"

    dist_keys = list(DISTRICTS.keys())

    for story in story_sequence:
        project_type = rng.choice(PROJECT_TYPES)
        district = dist_keys[idx % len(dist_keys)]

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
            district = "Kanchipuram"
            story = "high"
            land_area_ha = 145
            families_affected = 820
            rr_progress_pct = 24
            officer_response_days = 22
            litigation_count = 9
            compensation_disputes = 5
            stage = "possession"
            name = "Chennai Peripheral Ring Road (CPRR) Section 2"
            agency = "Tamil Nadu Road Development Company (TNRDC)"
        elif idx == 1:
            project_type = "power"
            district = "Coimbatore"
            story = "low"
            land_area_ha = 90
            families_affected = 280
            rr_progress_pct = 68
            officer_response_days = 12
            litigation_count = 1
            compensation_disputes = 1
            stage = "award"
            name = "Coimbatore Industrial Feeder Network Enhancement"
            agency = "TANGEDCO Power Transmission"
        else:
            name = project_name(project_type, district, idx)
            agency = rng.choice(AGENCIES)

        project_id = f"PRJ-{idx + 1:04d}"

        # Real Tamil Nadu centroid jittering
        lat = float(DISTRICTS[district]["lat"] + rng.normal(0.02, 0.08))
        lon = float(DISTRICTS[district]["lon"] + rng.normal(0.02, 0.08))

        planned_start = date_range(2019, 2025, rng)
        start_dt = pd.Timestamp(planned_start)
        duration_days = int(rng.integers(300, 1500))
        planned_end = (start_dt + pd.Timedelta(days=duration_days)).strftime("%Y-%m-%d")

        project_rows.append(
            {
                "project_id": project_id,
                "name": name,
                "type": project_type,
                "agency": agency,
                "state": "Tamil Nadu",
                "district": district,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "land_area_ha": land_area_ha,
                "families_affected": families_affected,
                "families_resettlement": int(families_affected * rng.uniform(0.35, 0.8)),
                "budget": int(land_area_ha * rng.uniform(550000, 1600000)),
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
    """
    Generates Tamil Nadu survey numbers and subdivisions.
    Survey Number (e.g. 120, 121, 122)
    Subdivision (e.g. 120/1, 120/2, 121/1A)
    """
    rows = []
    for _, project in project_rows.iterrows():
        parcel_count = int(rng.integers(12, 28))
        base_survey = int(rng.integers(101, 350))
        sub_counter = 1
        curr_survey = base_survey

        for pidx in range(1, parcel_count + 1):
            parcel_id = f"PAR-{project['project_id']}-{pidx:03d}"
            
            # Group into 2 to 4 subdivisions per survey number
            if sub_counter > rng.integers(2, 5):
                curr_survey += int(rng.integers(1, 4))
                sub_counter = 1
            
            subdiv_code = f"{curr_survey}/{sub_counter}" if pidx % 3 != 0 else f"{curr_survey}/{sub_counter}A"
            sub_counter += 1

            rows.append(
                {
                    "parcel_id": parcel_id,
                    "project_id": project["project_id"],
                    "survey_no": subdiv_code,  # Stores combined Tamil Nadu subdivision code (e.g. 120/1)
                    "area_ha": round(float(rng.uniform(1.2, 14.5)), 2),
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
    categories = [
        "High Court Stay Application",
        "Compensation Enhancement Appeal",
        "Title & Partition Dispute",
        "Boundary Demarcation Suit",
        "Tenant & Inam Right Claim",
        "Land Acquisition Challenge (Sec 15)",
    ]

    for _, parcel in parcels_df.iterrows():
        case_count = int(rng.integers(0, 10))
        if parcel["ownership_dispute"]:
            case_count = max(case_count, 1)

        for _ in range(case_count):
            case_id = f"CAS-{case_counter:05d}"
            category = rng.choice(categories)
            filing_date = date_range(2020, 2025, rng)
            is_pending = bool(rng.random() < 0.7)
            status = "pending" if is_pending else "disposed"
            stay_order = bool(is_pending and rng.random() < 0.35)
            hearings = int(rng.integers(1, 15))

            rows.append(
                {
                    "case_id": case_id,
                    "parcel_id": parcel["parcel_id"],
                    "category": category,
                    "filing_date": filing_date,
                    "status": status,
                    "stay_order": stay_order,
                    "hearings": hearings,
                }
            )
            case_counter += 1
    return pd.DataFrame(rows)


def generate_approvals(project_rows, rng):
    approval_types = [
        "Social Impact Assessment (SIA)",
        "Section 11 Preliminary Notification",
        "Rehabilitation & Resettlement Scheme Approval",
        "Environmental & CRZ Clearance",
        "Forest Conservation Stage-I Sanction",
        "Section 19 Declaration of Acquisition",
        "Section 23 Award Clearance",
    ]
    rows = []
    for _, project in project_rows.iterrows():
        for app_type in approval_types:
            planned_date = maybe_pending_date(rng)
            is_cleared = bool(rng.random() < 0.65)
            actual_date = maybe_pending_date(rng, days_late=int(rng.integers(15, 90))) if is_cleared else ""
            status = "cleared" if is_cleared else "pending"

            safe_name = app_type.lower().replace(" ", "_").replace("&", "and").replace("(", "").replace(")", "").replace("-", "_")
            rows.append(
                {
                    "approval_id": f"APP-{project['project_id']}-{safe_name[:28]}",
                    "project_id": project["project_id"],
                    "name": app_type,
                    "planned_date": planned_date,
                    "actual_date": actual_date,
                    "status": status,
                }
            )
    return pd.DataFrame(rows)


def generate_compensation(project_rows, rng):
    rows = []
    for _, project in project_rows.iterrows():
        total_award = int(project["budget"] * rng.uniform(0.65, 0.92))
        disbursed = int(total_award * rng.uniform(0.20, 0.88))
        disputes = int(rng.integers(0, 9))
        rows.append(
            {
                "project_id": project["project_id"],
                "award_amount": total_award,
                "disbursed_amount": disbursed,
                "disputes": disputes,
            }
        )
    return pd.DataFrame(rows)


def generate_incidents(project_rows, rng):
    rows = []
    inc_counter = 1
    for _, project in project_rows.iterrows():
        inc_count = int(rng.integers(0, 4))
        for _ in range(inc_count):
            incident_id = f"INC-{inc_counter:04d}"
            itype = rng.choice(["encroachment", "obstruction", "boundary_demarcation_protest"])
            idate = date_range(2023, 2026, rng)
            encroached_ha = round(float(rng.uniform(0.5, 6.5)), 2)
            rows.append(
                {
                    "incident_id": incident_id,
                    "project_id": project["project_id"],
                    "type": itype,
                    "incident_date": idate,
                    "encroached_area_ha": encroached_ha,
                }
            )
            inc_counter += 1
    return pd.DataFrame(rows)


def save_outputs(dfs, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, df in dfs.items():
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

    # Write tiny test set as subset
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

    quick_dir = (repo_root / "data" / "ongoing_quick").resolve()
    quick_projects = project_rows.head(15).copy()
    quick_project_ids = set(quick_projects["project_id"])
    quick_parcels = parcels[parcels["project_id"].isin(quick_project_ids)].copy()
    quick_cases = cases[cases["parcel_id"].isin(set(quick_parcels["parcel_id"]))].copy()
    quick_approvals = approvals[approvals["project_id"].isin(quick_project_ids)].copy()
    quick_comp = compensation[compensation["project_id"].isin(quick_project_ids)].copy()
    quick_incidents = incidents[incidents["project_id"].isin(quick_project_ids)].copy()
    save_outputs(
        {
            "projects": quick_projects,
            "parcels": quick_parcels,
            "cases": quick_cases,
            "approvals": quick_approvals,
            "compensation": quick_comp,
            "incidents": quick_incidents,
        },
        quick_dir,
    )

    print(f"Generated {len(project_rows)} projects (Tamil Nadu) to {out_dir}")
    print(f"Parcels: {len(parcels)}, Cases: {len(cases)}, Approvals: {len(approvals)}")


if __name__ == "__main__":
    main()
