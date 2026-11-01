# PERSON B: Data and ML Engineer

Branch: `feature/ml-data`
Your folders: `backend/data_gen/`, `backend/ml/`, `backend/core/predict.py`, `data/`, `models/`.
You do NOT touch: `backend/app/` (Person A), `backend/core/features.py`, `alerts.py`, `recommend.py`, `backend/adapters/` (Person D), `frontend/` (Person C and D).

You can start immediately. You do not need to wait for anyone. Your first deadline is the **sample CSV within 3 hours of Day 1**, because Person A's seed loader and Person D's adapters need it.

---

## How to use this file

1. Open the repo in Antigravity on your own branch.
2. For every new agent session, paste the **SHARED CONTEXT** block first, then the prompt you need.
3. Run each script and look at the output before moving on. Never commit a model you have not evaluated.
4. Read `docs/contracts.md` once it is on `develop` (Person A pushes it on Day 0). The feature names and the function signatures there override anything in this file if they differ.

## SHARED CONTEXT (paste at the start of every session)

```text
PROJECT: LandSentinel, a web app that predicts delay risk for land acquisition projects. Output per project: risk score 0-100, band (Low <30, Medium 30-60, High >60), delay probability, expected delay days, stage-wise probabilities (approval, compensation, possession, rr), top-3 SHAP drivers in plain language, recommended corrective actions. The prototype uses SYNTHETIC data with documented cause-and-effect rules; real systems are simulated by CSV files.

STACK: React (Vite) + FastAPI + Supabase on the app side. My part is pure Python 3.10+: pandas, numpy, faker, scikit-learn, XGBoost, SHAP, joblib.

MY FOLDERS ONLY: backend/data_gen/, backend/ml/, backend/core/predict.py, data/, models/. Follow docs/contracts.md exactly (function names, argument names, JSON keys, column names). Do not add heavy packages. Keep backend/requirements.txt updated.

MODEL FEATURES (exact names and order):
land_area_ha, families_affected, project_type, litigation_cases, stay_orders, ownership_disputes, compensation_pending_pct, approval_days_pending, docs_incomplete_pct, officer_response_days, encroached_area_pct, possession_pct, rr_progress_pct, current_stage, district_past_delay_rate

VALUE RULES: percent fields are 0-100; probabilities 0-1; risk_score integer 0-100; band Low <30, Medium 30-60, High >60. project_type in {highway, rail, irrigation, power, urban}. current_stage in {planning, sia, notification, award, compensation, possession, rr}.

Historical training CSV columns: project_id, planned_start, <15 features above>, is_delayed, delay_days, delayed_approval, delayed_compensation, delayed_possession.

predict_project(features: dict) -> {risk_score, band, delay_probability, expected_delay_days, stage_probabilities{approval,compensation,possession,rr}, drivers[3 x {feature,label,impact,direction,plain_text}], model_version}
what_if(features: dict, changes: dict) -> {current_score, new_score, change}
retrain(csv_path: str) -> {before, after, new_version, promoted}
```

---

## DAY 0 / DAY 1 MORNING

### B1. Environment and the data-generation rules (write them down first)

```text
[Paste SHARED CONTEXT]

Task: Create backend/data_gen/RULES.md that documents the cause-and-effect rules for the synthetic data BEFORE any code. Define for each of the 15 features: the distribution (e.g. litigation_cases ~ Poisson by project type, compensation_pending_pct between 0 and 90, approval_days_pending 0 to 300), plausible ranges by project_type, and correlations (rail and highway have more land area and more litigation; urban has more ownership disputes; district_past_delay_rate between 0.1 and 0.6 per district). Then define the delay probability formula as a logistic function: base rate about 0.30, plus positive weights for litigation_cases, stay_orders, ownership_disputes, compensation_pending_pct, approval_days_pending, docs_incomplete_pct, officer_response_days, encroached_area_pct, district_past_delay_rate, and negative weights for possession_pct and rr_progress_pct. Include: Gaussian noise on the logit, about 5 percent of rows with randomly flipped labels, and about 5 percent missing values in officer_response_days, docs_incomplete_pct and district_past_delay_rate. Define delay_days (0 if not delayed, else 20 to 400 growing with the same drivers), and the three stage labels delayed_approval, delayed_compensation, delayed_possession as separate logistic formulas that weight the relevant features more (approval: approval_days_pending, officer_response_days; compensation: compensation_pending_pct, ownership_disputes; possession: encroached_area_pct, stay_orders, litigation_cases, possession_pct). Keep the weights in one dict in a YAML file backend/data_gen/weights.yaml so they can be edited. Do not write generator code yet.
```

### B2. Historical project generator

```text
[Paste SHARED CONTEXT]

Task: Following backend/data_gen/RULES.md and weights.yaml, create backend/data_gen/generate_historical.py. CLI: python -m data_gen.generate_historical --n 2500 --seed 42 --out data/historical_projects.csv. Requirements:
1. project_id like HIS-0001, planned_start spread over 2016-01-01 to 2025-12-31 (needed for a time-based split).
2. Generate the 15 features, then compute the delay probability via the logistic formula, sample is_delayed, delay_days, and the three stage labels.
3. Add the noise, flipped labels and missing values described in RULES.md.
4. Print a summary: overall delay rate (target 30 to 40 percent), feature means, correlation of each feature with is_delayed, and the missing-value counts.
5. Deterministic with the seed.
Run it and show me the summary. Then check that no single feature correlates with is_delayed above 0.6 (otherwise the model will look too perfect) and adjust weights.yaml if needed.
```

### B3. Ongoing projects and related tables (SEND TO PERSON A AND D WITHIN 3 HOURS)

Do a quick version first (about 10 projects), push it, tell the team, then scale to 50.

```text
[Paste SHARED CONTEXT]

Task: Create backend/data_gen/generate_ongoing.py. CLI: python -m data_gen.generate_ongoing --n 50 --seed 7 --out data/ongoing. It writes six CSVs matching the table columns in docs/contracts.md section 2: projects.csv, parcels.csv, cases.csv, approvals.csv, compensation.csv, incidents.csv.
Rules:
1. 50 ongoing projects across 5 districts in one state (use real Indian district names such as Pune, Nashik, Nagpur, Aurangabad, Thane with realistic lat/lon within each district), mixed project types, status "active", created_by empty (filled by the seed loader later).
2. Each project has 5 to 40 parcels (survey_no like "112/3A", doc_complete mostly true, ownership_dispute sometimes true, no owner names), 0 to 12 cases spread over parcels (some with stay_order true), 3 to 5 approvals (some past planned_date and still pending), one compensation row (award_amount in rupees, disbursed_amount partly paid), and 0 to 4 incidents.
3. Make the data tell stories so the demo works: about 10 projects clearly high risk (many cases, large pending compensation), 20 medium, 20 low. Include one project named "Pune-Nashik Highway Phase 2" with risk drivers litigation, compensation pending and encroachment (this is the demo project), and one project with only 2 court cases that the demo will update to 9.
4. All IDs must be consistent across files (foreign keys valid).
5. Also write data/sample_tiny/ with just 5 projects for quick testing.
Print counts per file and per risk story.
```

After B3: `git add data/ && git commit -m "feat: sample ongoing data" && git push`, open a PR, and message Persons A and D.

---

## DAY 1 AFTERNOON

### B4. Baseline, XGBoost and a time-based split

```text
[Paste SHARED CONTEXT]

Task: Create backend/ml/train.py and backend/ml/evaluate.py.
1. Load data/historical_projects.csv. Time-based split: sort by planned_start, train on the first 70 percent, validate on the next 15 percent, test on the last 15 percent. Never split randomly.
2. Preprocessing in one reusable function ml.preprocess.prepare(df) used by both training and prediction: project_type and current_stage mapped to fixed category codes (define the category lists as constants shared with predict.py), numeric columns left as is (XGBoost handles missing values), logistic regression gets median imputation plus scaling inside a sklearn Pipeline.
3. Train: (a) LogisticRegression baseline, (b) XGBClassifier (n_estimators 300, max_depth 4, learning_rate 0.05, subsample 0.8, colsample_bytree 0.8, scale_pos_weight from the class ratio, eval on the validation set with early stopping).
4. evaluate.py computes on the test set: PR-AUC, ROC-AUC, recall and F1 at threshold 0.5, confusion matrix, Brier score and top-10 percent recall (what share of truly delayed projects fall in the 10 percent with the highest score). Print a comparison table baseline vs XGBoost.
5. Save models/baseline.joblib and models/xgb_raw.joblib and an interim models/metrics.json.
Run it and show me the table. The XGBoost should beat the baseline by a visible but not absurd margin; if PR-AUC is above 0.97, tell me so we can add more noise.
```

Push model v1 to `develop` at the end of Day 1.

---

## DAY 2

### B5. Calibration, duration regressor and stage models

```text
[Paste SHARED CONTEXT]

Task: Extend backend/ml/train.py:
1. Calibrate the XGBoost probability with CalibratedClassifierCV (method isotonic if the validation set has more than 1000 rows, otherwise sigmoid), fitted on the validation split with cv="prefit". Report Brier score before and after calibration, and save a reliability table (10 bins: mean predicted vs actual) into metrics.json.
2. Train an XGBRegressor for delay_days using only rows with is_delayed = 1, report MAE and RMSE on the test set, and use it as expected_delay_days (multiply by delay_probability or use the regressor output directly if delayed; document which choice you made and why).
3. Train three small XGBClassifier models for delayed_approval, delayed_compensation, delayed_possession, using the same features. For rr, stage probability = clip(1 - rr_progress_pct / 100 blended with delay_probability, 0, 1); document the formula.
4. Save as models/v1/: classifier_calibrated.joblib, regressor.joblib, stage_approval.joblib, stage_compensation.joblib, stage_possession.joblib, meta.json (version "v1", feature order, category lists, trained_at), and models/v1/metrics.json. Write models/ACTIVE_VERSION containing "v1".
5. Keep metrics.json keys exactly: pr_auc, roc_auc, recall, f1, brier, top10_recall, confusion_matrix, mae_days.
```

### B6. SHAP explainer with plain-language reasons

```text
[Paste SHARED CONTEXT]

Task: Create backend/ml/explain.py with:
1. A cached loader get_explainer(version) that builds shap.TreeExplainer on the raw XGBoost model inside the calibrated classifier (load once, keep in a module-level dict).
2. top_drivers(features: dict, version: str, k: int = 3) -> list[dict], returning for each driver: feature, label (human label from a LABELS dict, e.g. litigation_cases -> "Court cases"), impact (convert the SHAP value to probability points by dividing the log-odds contribution proportionally: impact_i = delta_p * shap_i / sum(abs(shap)) where delta_p = P(project) minus P(average project); keep the sign), direction ("increases_risk" if impact > 0 else "decreases_risk"), plain_text.
3. Only drivers that increase risk are returned unless fewer than 3 do.
4. plain_text from a template per feature using the actual value, for example "9 court cases, 2 with stay orders, are the biggest cause of delay risk." / "41% of the compensation is still unpaid." / "Approvals are pending for 120 days." / "8% of the land is encroached." / "22 days average officer response time." Write templates for all 15 features.
5. A unit test in tests-free manner: a __main__ block that loads sample features and prints the 3 drivers.
Time a call; it must run in under 200 ms after the first call.
```

### B7. `core/predict.py`: the function Person A is waiting for

This is on the critical path. Finish it by the middle of Day 2.

```text
[Paste SHARED CONTEXT]

Task: Create backend/core/predict.py with exactly these public functions:
1. predict_project(features: dict) -> dict. Steps: load the ACTIVE_VERSION models once (module-level cache, reload only when ACTIVE_VERSION changes); validate that all 15 feature keys exist (missing numeric values allowed as None; raise ValueError listing unknown or missing keys otherwise); build a one-row DataFrame via ml.preprocess.prepare; calibrated probability -> risk_score = round(prob * 100), band by thresholds; expected_delay_days from the regressor; stage_probabilities (approval, compensation, possession, rr); drivers = ml.explain.top_drivers(...). Return the dict in the exact shape in docs/contracts.md section 4 WITHOUT recommendations, plus model_version.
2. what_if(features: dict, changes: dict) -> dict. Copy features, apply only the allowed keys in changes (compensation_pending_pct, litigation_cases, docs_incomplete_pct, approval_days_pending; ignore others and clamp percents to 0-100), return {current_score, new_score, change}.
3. get_active_version() -> str.
No database access, no HTTP, no file writes in this module.
Add a __main__ demo that runs the worked example: 4-lane highway, 120 ha, 800 families, 9 cases with 2 stay orders, 41 percent compensation pending, 120 approval days pending, 8 percent encroached, officer response 22 days. Expect a High score. Then run what_if with compensation_pending_pct changed to 20 and confirm the score drops.
```

When B7 passes, push and message Person A: "predict_project and what_if are on develop, model v1 active."

### B8. Retrain pipeline

```text
[Paste SHARED CONTEXT]

Task: Create backend/ml/retrain.py with retrain(csv_path: str) -> dict.
1. Validate the CSV has the columns of the historical training CSV; raise a ValueError with the missing columns otherwise.
2. Load the current ACTIVE_VERSION metrics as "before" (read models/<v>/metrics.json).
3. Combine the new CSV with data/historical_projects.csv (dedupe on project_id), run the same time-based split and the full training pipeline from train.py into models/<new_version>/ where new_version is the next integer (v2, v3...).
4. Evaluate on the SAME held-out test period as before for a fair comparison and return "after".
5. Promote automatically (write ACTIVE_VERSION) only if the new PR-AUC is not more than 0.01 worse than the old one; otherwise leave the old active and return promoted false.
6. Return {"before": {...}, "after": {...}, "new_version": "v2", "promoted": true}.
Add a CLI: python -m ml.retrain --csv data/uploads/new.csv. Also create a small script data_gen/make_upload_sample.py that generates a CSV of 300 new historical rows with a slightly different seed for the demo.
```

---

## DAY 3

### B9. Stage-model and tuning improvements

```text
[Paste SHARED CONTEXT]

Task: Improve the models without changing any public function signatures or JSON keys. (1) Run a small randomized hyperparameter search (20 iterations, time-aware validation) for the XGBoost classifier using PR-AUC; keep the best parameters in models/v1/meta.json. (2) Compare against RandomForest and LightGBM only if lightgbm installs cleanly; produce a table in models/model_comparison.csv with PR-AUC, recall, F1, Brier, top-10 recall for Logistic Regression, Random Forest, XGBoost, calibrated XGBoost. (3) Check feature importance and confirm the top SHAP features are the ones the data rules say should matter; write a short docs paragraph in models/EXPLAINABILITY.md. (4) Retrain the final model as v1 and update metrics.json.
```

### B10. Slide material

```text
[Paste SHARED CONTEXT]

Task: Generate, from models/v1/metrics.json and models/model_comparison.csv, a one-page markdown file docs/metrics_slide.md containing: the comparison table, a plain-language sentence for each metric (what recall and top-10 percent recall mean for an officer), the calibration reliability table, and this exact honesty statement: "Metrics are measured on simulated data built with documented cause-and-effect rules. Real accuracy must be validated in a pilot with historical records from one district." Also save two PNGs in docs/img/: precision-recall curve and a reliability plot (matplotlib).
```

---

## DAY 4

### B11. Freeze

```text
[Paste SHARED CONTEXT]

Task: Final freeze. Verify: (1) python -m core.predict runs the worked example and returns High with 3 drivers; (2) models/ACTIVE_VERSION points to a folder that contains every required file; (3) predict_project handles None for officer_response_days, docs_incomplete_pct and district_past_delay_rate without crashing; (4) what_if with unchanged inputs returns change = 0; (5) calling predict_project 100 times takes under 5 seconds total; (6) retrain on data/uploads sample completes in under 3 minutes and returns before/after metrics. Fix any failure inside my folders only and list what passed.
```

Freeze the model on Day 4. No retraining after that except the live retrain demo, and keep the demo retrain from replacing the active model unless you want it to (it is safe because the metrics comparison decides).

---

## Dependencies for you (Person B)

| You need | From | If late |
|---|---|---|
| Feature names and function signatures | `docs/contracts.md` from Person A | They are copied in the SHARED CONTEXT; start anyway |
| Nothing else to start | n/a | You can start right now |

People waiting on you:

| Person | Needs | When |
|---|---|---|
| A | `data/ongoing/*.csv` and `data/sample_tiny/` | Within 3 hours of Day 1 start |
| A | `core/predict.py` with `predict_project` and `what_if` | Middle of Day 2 |
| A | `ml/retrain.py` | Day 3 |
| D | The same sample CSVs (for adapters), and drivers' `feature` names (for the recommendation rules) | Day 1 |
| C | A real prediction example JSON (run B7's demo and save to `docs/sample_prediction.json`) | Day 2 |
