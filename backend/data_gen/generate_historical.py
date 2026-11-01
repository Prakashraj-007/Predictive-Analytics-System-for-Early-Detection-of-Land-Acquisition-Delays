import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

FEATURES = [
    "land_area_ha",
    "families_affected",
    "project_type",
    "litigation_cases",
    "stay_orders",
    "ownership_disputes",
    "compensation_pending_pct",
    "approval_days_pending",
    "docs_incomplete_pct",
    "officer_response_days",
    "encroached_area_pct",
    "possession_pct",
    "rr_progress_pct",
    "current_stage",
    "district_past_delay_rate",
]

PROJECT_TYPES = ["highway", "rail", "irrigation", "power", "urban"]
CURRENT_STAGES = ["planning", "sia", "notification", "award", "compensation", "possession", "rr"]


def load_weights():
    weights_path = Path(__file__).with_name("weights.yaml")
    with open(weights_path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def logistic(x):
    return 1 / (1 + np.exp(-x))


def sample_project_type(rng):
    return rng.choice(PROJECT_TYPES, p=[0.28, 0.22, 0.2, 0.15, 0.15])


def project_type_bias(project_type, cfg):
    return cfg["weights"]["project_type_bias"].get(project_type, 0.0)


def stage_bias(stage, cfg):
    return cfg["weights"]["current_stage_bias"].get(stage, 0.0)


def generate_dataset(n: int, seed: int):
    cfg = load_weights()
    rng = np.random.default_rng(seed)
    rows = []

    for idx in range(1, n + 1):
        project_type = sample_project_type(rng)
        current_stage = rng.choice(CURRENT_STAGES, p=[0.12, 0.14, 0.12, 0.17, 0.18, 0.18, 0.09])

        land_area_ha = int(np.clip(rng.normal(220 if project_type in {"highway", "rail"} else 180, 80), 20, 650))
        families_affected = int(np.clip(rng.normal(850 if project_type in {"highway", "rail"} else 520, 400), 60, 3000))

        litigation_cases = int(np.clip(rng.poisson(5 + (2 if project_type in {"highway", "rail"} else 0) + (1 if project_type == "urban" else 0)), 0, 30))
        stay_orders = int(np.clip(rng.poisson(max(0.4, litigation_cases * 0.28)), 0, 12))
        ownership_disputes = int(np.clip(rng.poisson(2.0 + (1.3 if project_type == "urban" else 0.7)), 0, 18))

        compensation_pending_pct = float(np.clip(rng.normal(28 + ownership_disputes * 4 + litigation_cases * 1.5, 16), 0, 90))
        approval_days_pending = float(np.clip(rng.normal(45 + (60 if project_type in {"highway", "rail"} else 25), 35), 0, 300))
        docs_incomplete_pct = float(np.clip(rng.normal(18 + (12 if project_type == "urban" else 5), 15), 0, 70))
        officer_response_days = float(np.clip(rng.normal(20 + 0.7 * approval_days_pending, 18), 0, 120))
        encroached_area_pct = float(np.clip(rng.normal(6 + (12 if project_type in {"highway", "rail"} else 5) + 0.7 * litigation_cases, 8), 0, 50))
        possession_pct = float(np.clip(rng.normal(55 + (10 if current_stage in {"possession", "rr"} else 0), 20), 0, 100))
        rr_progress_pct = float(np.clip(rng.normal(40 + (20 if current_stage == "rr" else 0), 18), 0, 100))
        district_past_delay_rate = float(np.clip(rng.uniform(0.1, 0.6), 0.1, 0.6))

        if rng.random() < 0.05:
            officer_response_days = np.nan
        if rng.random() < 0.05:
            docs_incomplete_pct = np.nan
        if rng.random() < 0.05:
            district_past_delay_rate = np.nan

        logit = (
            cfg["base_rate"]
            + cfg["weights"]["litigation_cases"] * litigation_cases
            + cfg["weights"]["stay_orders"] * stay_orders
            + cfg["weights"]["ownership_disputes"] * ownership_disputes
            + cfg["weights"]["compensation_pending_pct"] * compensation_pending_pct
            + cfg["weights"]["approval_days_pending"] * approval_days_pending
            + cfg["weights"]["docs_incomplete_pct"] * (docs_incomplete_pct if not pd.isna(docs_incomplete_pct) else 0)
            + cfg["weights"]["officer_response_days"] * (officer_response_days if not pd.isna(officer_response_days) else 0)
            + cfg["weights"]["encroached_area_pct"] * encroached_area_pct
            + cfg["weights"]["district_past_delay_rate"] * (district_past_delay_rate if not pd.isna(district_past_delay_rate) else 0.25)
            + cfg["weights"]["land_area_ha"] * land_area_ha / 10
            + cfg["weights"]["families_affected"] * families_affected / 100
            + project_type_bias(project_type, cfg)
            + stage_bias(current_stage, cfg)
            - cfg["weights"]["possession_pct"] * possession_pct
            - cfg["weights"]["rr_progress_pct"] * rr_progress_pct
        )

        logit += rng.normal(0, cfg["noise_sd"])
        probability = float(logistic(logit / 4.0))

        if rng.random() < 0.05:
            is_delayed = 1 - int(rng.integers(0, 2))
        else:
            is_delayed = int(rng.random() < probability)

        if is_delayed:
            delay_days = int(np.clip(rng.normal(100 + 0.8 * compensation_pending_pct + 1.4 * litigation_cases + 1.2 * approval_days_pending / 10, 55), 20, 400))
        else:
            delay_days = 0

        approval_prob = logistic(
            cfg["stage_weights"]["approval"]["approval_days_pending"] * approval_days_pending
            + cfg["stage_weights"]["approval"]["officer_response_days"] * (officer_response_days if not pd.isna(officer_response_days) else 25)
        )
        compensation_prob = logistic(
            cfg["stage_weights"]["compensation"]["compensation_pending_pct"] * compensation_pending_pct
            + cfg["stage_weights"]["compensation"]["ownership_disputes"] * ownership_disputes
        )
        possession_prob = logistic(
            cfg["stage_weights"]["possession"]["encroached_area_pct"] * encroached_area_pct
            + cfg["stage_weights"]["possession"]["stay_orders"] * stay_orders
            + cfg["stage_weights"]["possession"]["litigation_cases"] * litigation_cases
            + cfg["stage_weights"]["possession"]["possession_pct"] * (-possession_pct)
        )

        delayed_approval = int(rng.random() < approval_prob)
        delayed_compensation = int(rng.random() < compensation_prob)
        delayed_possession = int(rng.random() < possession_prob)

        rows.append(
            {
                "project_id": f"HIS-{idx:04d}",
                "planned_start": pd.Timestamp("2016-01-01") + pd.Timedelta(days=int(rng.integers(0, 365 * 10))),
                "land_area_ha": land_area_ha,
                "families_affected": families_affected,
                "project_type": project_type,
                "litigation_cases": litigation_cases,
                "stay_orders": stay_orders,
                "ownership_disputes": ownership_disputes,
                "compensation_pending_pct": compensation_pending_pct,
                "approval_days_pending": approval_days_pending,
                "docs_incomplete_pct": docs_incomplete_pct,
                "officer_response_days": officer_response_days,
                "encroached_area_pct": encroached_area_pct,
                "possession_pct": possession_pct,
                "rr_progress_pct": rr_progress_pct,
                "current_stage": current_stage,
                "district_past_delay_rate": district_past_delay_rate,
                "is_delayed": is_delayed,
                "delay_days": delay_days,
                "delayed_approval": delayed_approval,
                "delayed_compensation": delayed_compensation,
                "delayed_possession": delayed_possession,
            }
        )

    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame):
    means = df[FEATURES].mean(numeric_only=True)
    delay_rate = df["is_delayed"].mean()
    correlated = {}
    for feature in FEATURES:
        if feature in df.select_dtypes(include=["number"]).columns:
            corr = df[feature].astype(float).corr(df["is_delayed"].astype(float))
            correlated[feature] = corr
        else:
            correlated[feature] = None
    missing_counts = df[FEATURES].isna().sum().to_dict()
    return {
        "delay_rate": float(delay_rate),
        "means": means.to_dict(),
        "corr_with_is_delayed": correlated,
        "missing_counts": missing_counts,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=2500)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=str, default="data/historical_projects.csv")
    args = parser.parse_args()

    df = generate_dataset(args.n, args.seed)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    summary = summarize(df)
    print(json.dumps({
        "rows": len(df),
        "delay_rate": round(summary["delay_rate"], 4),
        "feature_means": {k: round(float(v), 4) if isinstance(v, (int, float)) else v for k, v in summary["means"].items()},
        "corr_with_is_delayed": {k: round(float(v), 4) if v is not None else None for k, v in summary["corr_with_is_delayed"].items()},
        "missing_counts": {k: int(v) for k, v in summary["missing_counts"].items()},
    }, indent=2))


if __name__ == "__main__":
    main()
