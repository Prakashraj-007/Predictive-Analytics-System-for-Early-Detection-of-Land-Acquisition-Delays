from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import matplotlib
import pandas as pd
from matplotlib import pyplot as plt
from sklearn.metrics import average_precision_score, precision_recall_curve

matplotlib.use("Agg")

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from ml.preprocess import FEATURE_COLUMNS, prepare

MODELS_DIR = ROOT / "models"
DOCS_DIR = ROOT / "docs"
IMG_DIR = DOCS_DIR / "img"


def main() -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)

    comparison = pd.read_csv(MODELS_DIR / "model_comparison.csv")
    df = pd.read_csv(ROOT / "data" / "historical_projects.csv")
    X = prepare(df[FEATURE_COLUMNS].copy())
    y = df["is_delayed"].astype(int)

    model = joblib.load(MODELS_DIR / "xgb_raw.joblib")
    probs = model.predict_proba(X)[:, 1]
    precision, recall, _ = precision_recall_curve(y, probs)

    fig, ax = plt.subplots(figsize=(6, 4))
    ap = average_precision_score(y, probs)
    ax.plot(recall, precision, color="tab:blue", label=f"PR curve (AP={ap:.3f})")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall Curve")
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(IMG_DIR / "precision_recall_curve.png", dpi=180)
    plt.close(fig)

    reliability = json.loads((MODELS_DIR / "v1" / "reliability_table.json").read_text(encoding="utf-8"))
    valid_rows = [row for row in reliability if row["count"] > 0]
    xs = [row["mean_predicted"] for row in valid_rows]
    ys = [row["mean_actual"] for row in valid_rows]

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Perfect calibration")
    ax.plot(xs, ys, marker="o", color="tab:orange", label="Observed vs predicted")
    ax.set_xlabel("Mean predicted probability")
    ax.set_ylabel("Observed rate")
    ax.set_title("Calibration Reliability Plot")
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(IMG_DIR / "reliability_plot.png", dpi=180)
    plt.close(fig)

    slide_lines = [
        "# LandSentinel Model Snapshot",
        "",
        "## Model comparison",
        "",
        comparison.to_markdown(index=False),
        "",
        "## Key metric notes",
        "- Recall: this is the share of truly delayed projects the model catches; for an officer, a higher recall means fewer late projects are missed by the alert list.",
        "- Top-10 percent recall: this tells us how often the truly delayed projects appear in the 10% of highest-risk projects; for an officer, it means whether the riskiest queue is concentrating the real delays.",
        "- PR-AUC: higher values show better ranking quality when the delay is rare; it matters because projects are not equally likely to be late.",
        "- Brier score: lower is better; it shows how well the probability estimates match the real delay rate.",
        "",
        "## Calibration reliability",
        "| Bin | Low | High | Mean predicted | Mean actual | Count |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in reliability:
        slide_lines.append(
            f"| {row['bin']} | {row['low']:.1f} | {row['high']:.1f} | {row['mean_predicted']:.3f} | {row['mean_actual']:.3f} | {row['count']} |"
        )
    slide_lines.extend([
        "",
        '"Metrics are measured on simulated data built with documented cause-and-effect rules. Real accuracy must be validated in a pilot with historical records from one district."',
    ])

    (DOCS_DIR / "metrics_slide.md").write_text("\n".join(slide_lines) + "\n", encoding="utf-8")
    print("Created docs/metrics_slide.md and docs/img PNG files")


if __name__ == "__main__":
    main()
