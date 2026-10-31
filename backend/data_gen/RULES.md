# Synthetic data rules for LandSentinel

This file documents the cause-and-effect logic used to generate the historical and ongoing CSVs for the demo. The prototype is intentionally synthetic and designed to produce realistic delay patterns without requiring real land acquisition data.

## Feature definitions

The model consumes exactly these 15 features, in this order:

1. land_area_ha
2. families_affected
3. project_type
4. litigation_cases
5. stay_orders
6. ownership_disputes
7. compensation_pending_pct
8. approval_days_pending
9. docs_incomplete_pct
10. officer_response_days
11. encroached_area_pct
12. possession_pct
13. rr_progress_pct
14. current_stage
15. district_past_delay_rate

For every feature, the generator follows the distributions below:

- land_area_ha: 20 to 650 hectares. Highway and rail projects skew larger; urban projects are smaller but denser.
- families_affected: 60 to 3000 households. Larger projects affect more families.
- project_type: categorical in {highway, rail, irrigation, power, urban}. Highway and rail have more land acquisition disputes and larger parcels; urban has more ownership disputes and documentation churn.
- litigation_cases: mostly 0 to 18, with a Poisson-like distribution by project type. Higher for highway and rail projects.
- stay_orders: 0 to 6, positively related to litigation_cases.
- ownership_disputes: 0 to 10, more common in urban and irrigation projects.
- compensation_pending_pct: 0 to 90. Higher when there are more disputes and larger affected families.
- approval_days_pending: 0 to 300 days. Reflects slow administrative clearance.
- docs_incomplete_pct: 0 to 70. More common in projects with poor documentation and high displacement complexity.
- officer_response_days: 0 to 120 days. Missing in about 5% of rows.
- encroached_area_pct: 0 to 50. Grows with project delay and land disputes.
- possession_pct: 0 to 100. High percentage means progress is advanced; negative effect on delay risk.
- rr_progress_pct: 0 to 100. High progress lowers risk.
- current_stage: categorical in {planning, sia, notification, award, compensation, possession, rr}.
- district_past_delay_rate: 0.1 to 0.6 per district, with missing values roughly 5%.

## Delay probability logic

The target variable is generated from a logistic formula. The base rate is about 0.30 to 0.40 depending on project mix.

The logit includes positive weights for:

- litigation_cases
- stay_orders
- ownership_disputes
- compensation_pending_pct
- approval_days_pending
- docs_incomplete_pct
- officer_response_days
- encroached_area_pct
- district_past_delay_rate

It includes negative weights for:

- possession_pct
- rr_progress_pct

A Gaussian noise term is added to the logit, and about 5% of rows have their labels randomly flipped to avoid an unrealistically perfect signal. Missing values appear in officer_response_days, docs_incomplete_pct and district_past_delay_rate in about 5% of records.

## Delay days and stage labels

- delay_days = 0 if not delayed; otherwise 20 to 400 days increasing with the same driver variables.
- delayed_approval is generated from approval_days_pending and officer_response_days.
- delayed_compensation is generated from compensation_pending_pct and ownership_disputes.
- delayed_possession is generated from encroached_area_pct, stay_orders, litigation_cases and possession_pct.

The weights for all rules live in `backend/data_gen/weights.yaml` so they can be adjusted without rewriting the generator.

## Value rules

- Percent fields are 0 to 100.
- Probabilities are 0 to 1.
- risk_score is integer 0 to 100.
- band is Low (<30), Medium (30 to 60), High (>60).
- project_type values: highway, rail, irrigation, power, urban.
- current_stage values: planning, sia, notification, award, compensation, possession, rr.

## Demo story and project names

The demo dataset includes about 10 clearly high-risk projects, 20 medium-risk, and 20 low-risk examples. One project is named "Pune-Nashik Highway Phase 2" with risk drivers related to litigation, compensation pending and encroachment. Another project starts with only 2 court cases and is later updated to 9 cases for the what-if demo.
