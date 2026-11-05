# LandSentinel Judge Q&A Cheat Sheet

**Purpose:** Rapid, authoritative answers to anticipated jury and technical judge questions.  
**Tone:** Candid, rigorous, governance-aware, and engineering-grounded.  

---

### Q1. Where is your real data?
**Answer:**  
Our demonstration and baseline training data is synthetically generated using a statistically calibrated data engine that models real-world covariance structures across land disputes, compensation rates, and milestone lapses under the RFCTLARR Act 2013. Public access to live state land acquisition records and pending court injunctions is legally restricted and lacks open sandbox APIs for hackathons. However, our system architecture is built with production-ready adapters that map directly to the exact relational schemas used by state revenue portals and the National Judicial Data Grid.

---

### Q2. How accurate is the model?
**Answer:**  
On our simulated validation dataset, our Calibrated XGBoost model achieves a PR-AUC of 0.385 and concentrates 36.8% of all true delays in the top 10% highest-risk queue, with a well-calibrated Brier score of 0.233. Because delay is an imbalanced event, we prioritize PR-AUC and Top-10% Recall over raw accuracy so district officers focus their scarce time on genuine bottlenecks. Real-world predictive accuracy must and will be rigorously calibrated in a live district pilot using 3 years of historical acquisition archives.

---

### Q3. How do you handle sensitive landowner and citizen data?
**Answer:**  
LandSentinel enforces privacy-by-design at the adapter ingestion boundary: citizen personal identifiable information (PII), such as landowner names, phone numbers, and Aadhaar identifiers, is completely stripped before data enters the database or feature pipeline. Only spatial parcel IDs, survey numbers, dispute categories, and area numbers are retained. This guarantees zero risk of citizen profiling or privacy violations while preserving full analytical utility for infrastructure planning.

---

### Q4. Why use machine learning instead of simple business rules?
**Answer:**  
Simple threshold rules work well for single-variable triggers (e.g. "alert if court cases > 5"), but infrastructure delays are caused by nonlinear, multi-factor interactions that rule engines miss. For instance, a project with 3 court cases may proceed smoothly if compensation is 90% disbursed, but stall completely if paired with an overdue forest clearance and an unresponsive nodal officer. XGBoost captures these high-order interactions and probability weights, while our TreeSHAP explainer and recommendation rules translate the mathematical findings back into transparent administrative actions.

---

### Q5. Will LandSentinel work in another state beyond Maharashtra?
**Answer:**  
Yes, because the legal foundation of our domain features—the Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act (RFCTLARR)—is a Central Act applicable across all Indian states. State-level variations primarily concern revenue terminology (e.g. *7/12 extracts* in Maharashtra vs. *RTC / Pahani* in Karnataka or *Khasra / Khatauni* in Uttar Pradesh) and local agency workflows. Expanding to another state requires only configuring a state-specific adapter without modifying the core feature engineering, XGBoost, or alert engines.

---

### Q6. What happens if input data is wrong or incomplete?
**Answer:**  
Our feature builder in `backend/core/features.py` contains explicit defensive guardrails for missing, dirty, and out-of-bounds data: numeric strings are coerced, nulls fallback to statutory medians or zeros, percentages are clipped to [0, 100], and documentation incompleteness itself is modeled as a primary risk feature (`docs_incomplete_pct`). When land records lack verification, the model flags data uncertainty as a risk multiplier rather than failing silently. Furthermore, every data ingestion error is logged to our statutory audit trail for administrative review.

---

### Q7. How would real integration with live government systems work?
**Answer:**  
Real integration relies on our pluggable adapter architecture (`backend/adapters/`), where file-based CSV loaders are swapped with secure REST or SOAP API connectors to eCourts CIS, state Bhulekh registries, MoEFCC Parivesh, and PFMS treasury gateways. The integration utilizes machine-to-machine mutual TLS (mTLS) with state API gateways and nightly batch synchronization for historical metrics alongside webhook triggers for court order updates. Because our adapter interface guarantees canonical output dicts, the downstream analytical pipelines require zero modifications during system rollout.

---

### Q8. Who is accountable if a model prediction is incorrect?
**Answer:**  
Accountability remains strictly with the human administrative officer: LandSentinel is an executive decision-support system, not an automated executive adjudicator. Predictions, risk bands, and recommendations are advisory tools designed to highlight priority files, and no statutory acquisition, award, or disbursement can be executed or denied by the algorithm. Every prediction, parameter update, and model retraining is permanently recorded in an immutable statutory audit log with user IDs, ensuring complete post-hoc accountability under administrative law.

