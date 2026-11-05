# Recommendation Rules Documentation

This document is generated from the static `RULES` list defined in
`backend/core/recommend.py`. It presents a concise overview of each rule
used by the recommendation engine.

| Driver (feature) | Action | Owner Role | Expected Effect |
|------------------|--------|------------|-----------------|
| compensation_pending_pct | Release pending funds and hold payment camps for landowners. | finance | Reduces payment delays and improves possession rates |
| litigation_cases | Escalate the cases to the legal cell, consider a special Lok Adalat and seek early hearings. | legal | Accelerates case resolution, lowering possession bottlenecks |
| stay_orders | Escalate the cases to the legal cell, consider a special Lok Adalat and seek early hearings. | legal | Same as litigation_cases |
| approval_days_pending | Escalate to the department head and set a deadline for the pending approval. | admin | Reduces bureaucratic lag |
| docs_incomplete_pct | Run a documentation drive and verify land records. | records | Ensures clean titles and smooth mutations |
| encroached_area_pct | Plan an eviction and clearance drive with the local administration. | security | Reclaims project land, preventing further delays |
| rr_progress_pct | Speed up resettlement site development and housing allotment. | rr | Improves community acceptance and speeds possession |
| ownership_disputes | Hold a joint hearing with the revenue officer and speed up mutation of disputed parcels. | revenue | Clears title issues, enabling award and possession |
| officer_response_days | Set a file‑movement time limit (for example 7 days) and track delays weekly. | officer | Improves administrative throughput |
| possession_pct | Hold a possession camp parcel by parcel with the village administration. | field | Directly raises possession percentage |
| district_past_delay_rate | Review the district's past delay causes and add a monthly review meeting. | pm | Learns from history, prevents repeat delays |
| land_area_ha | Split the project into phases to manage larger land scopes. | pm | Reduces coordination complexity |
| families_affected | Appoint a dedicated resettlement officer to handle large beneficiary numbers. | pm | Improves stakeholder engagement |
| project_type | Tailor project‑specific SOPs – e.g., highways need right‑of‑way clearances early. | pm | Ensures type‑appropriate risk mitigation |
| current_stage | Conduct a stage‑gate review to identify bottlenecks before moving forward. | pm | Pre‑emptively catches delays |

*Generated on 2026-10-31.*
