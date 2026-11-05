# LandSentinel Model Snapshot

## Model comparison

| model               |   pr_auc |   recall |       f1 |    brier |   top10_recall |
|:--------------------|---------:|---------:|---------:|---------:|---------------:|
| Logistic Regression | 0.37712  | 0.514493 | 0.434251 | 0.250778 |       0.368421 |
| Random Forest       | 0.379511 | 0.34058  | 0.361538 | 0.24667  |       0.394737 |
| XGBoost             | 0.369861 | 0.398551 | 0.390071 | 0.260307 |       0.315789 |
| Calibrated XGBoost  | 0.38525  | 0        | 0        | 0.233306 |       0.368421 |

## Key metric notes
- Recall: this is the share of truly delayed projects the model catches; for an officer, a higher recall means fewer late projects are missed by the alert list.
- Top-10 percent recall: this tells us how often the truly delayed projects appear in the 10% of highest-risk projects; for an officer, it means whether the riskiest queue is concentrating the real delays.
- PR-AUC: higher values show better ranking quality when the delay is rare; it matters because projects are not equally likely to be late.
- Brier score: lower is better; it shows how well the probability estimates match the real delay rate.

## Calibration reliability
| Bin | Low | High | Mean predicted | Mean actual | Count |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 0.0 | 0.1 | 0.000 | 0.000 | 0 |
| 1 | 0.1 | 0.2 | 0.000 | 0.000 | 0 |
| 2 | 0.2 | 0.3 | 0.293 | 0.452 | 31 |
| 3 | 0.3 | 0.4 | 0.342 | 0.347 | 271 |
| 4 | 0.4 | 0.5 | 0.429 | 0.411 | 73 |
| 5 | 0.5 | 0.6 | 0.000 | 0.000 | 0 |
| 6 | 0.6 | 0.7 | 0.000 | 0.000 | 0 |
| 7 | 0.7 | 0.8 | 0.000 | 0.000 | 0 |
| 8 | 0.8 | 0.9 | 0.000 | 0.000 | 0 |
| 9 | 0.9 | 1.0 | 0.000 | 0.000 | 0 |

"Metrics are measured on simulated data built with documented cause-and-effect rules. Real accuracy must be validated in a pilot with historical records from one district."
