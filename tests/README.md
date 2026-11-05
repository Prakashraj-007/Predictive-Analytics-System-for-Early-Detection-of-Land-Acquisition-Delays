# LandSentinel QA & Automated Test Suite

Comprehensive test suite covering data integration adapters, feature engineering, recommendation rules, alert thresholds, backend inference pipelines, and API contract shape compliance.

---

## Test Organization

| File | Purpose | Scope | Key Validations |
|---|---|---|---|
| `tests/test_adapters.py` | CSV data adapters | Person D (D1) | 5 adapters (court, land records, compensation, approvals, incidents), bundle fetching, missing file handling, NaN coercion. |
| `tests/test_features.py` | Feature builder pure function | Person D (D2) | Exact 15 features computation, percentage bounds [0, 100], date parsing, worked example, explainability mapping. |
| `tests/test_recommend.py` | Rule-based recommendation engine | Person D (D3) | Rule coverage across all 15 features, driver order preservation, increases-risk filtering, fallback action. |
| `tests/test_alerts.py` | Alert evaluation engine | Person D (D4) | Threshold crossing (>60), score surge (&ge;15 pts), suppression of falling scores, deduplication keys. |
| `tests/test_pipeline.py` | End-to-end backend inference | Person D (D10) | Headless integration pipeline: fetch &rarr; build_features &rarr; predict_project &rarr; recommend &rarr; evaluate_alert for 5 sample projects. |
| `tests/test_contract_shapes.py` | FastAPI contract shape verification | Person D (D10) | FastAPI `TestClient` in `STUB_MODE=true` validating all 20+ endpoints and top-level response schemas in `docs/contracts.md` Section 3. |

---

## Running the Tests

### Fast In-Memory Unit Suite
```bash
pytest tests/test_adapters.py tests/test_features.py tests/test_recommend.py tests/test_alerts.py -v
```

### End-to-End Pipeline Integration Suite
```bash
pytest tests/test_pipeline.py -v
```

### API Contract Shape Compliance Suite
```bash
pytest tests/test_contract_shapes.py -v
```

### Run Entire Test Suite
```bash
pytest
```

---

## Configuration & Environment Variables

- `DATA_DIR`: Directory containing raw input CSV files for adapters (default: `data/ongoing`).
- `STUB_MODE`: Set to `"true"` to execute contract shape tests against stub memory fixtures without connecting to live Supabase Postgres.
- `MODEL_DIR`: Path to serialized scikit-learn / XGBoost model artifacts (default: `models`).
