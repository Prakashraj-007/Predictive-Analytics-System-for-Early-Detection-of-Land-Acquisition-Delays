"""
backend/core/alerts.py
=====================
Alert engine for LandSentinel.

The module provides a pure function ``evaluate_alert`` that decides whether an
alert should be raised based on a new risk score, an optional previous score, and
a configurable threshold.  The function returns a dictionary containing the
alert details or ``None`` when no alert is required.

Specification (from the MD spec):
* If ``new_score`` is greater than ``threshold`` → raise a **High** severity
  alert with reason:
  ``"Risk score {new_score} is above the {threshold} High-risk threshold"``.
* If ``previous_score`` is not ``None`` and the increase ``new_score -
  previous_score`` is **>= 15** → raise an alert with reason:
  ``"Risk score rose by {delta} points, from {previous_score} to {new_score}"``.
  Severity is **High** when ``new_score`` also exceeds ``threshold`` otherwise
  **Medium**.
* When both conditions are true, combine the two reasons with a ``; ``
  separator and set severity to **High**.
* Do **not** raise an alert when the score is flat or dropping, even if the
  score is still above the threshold – the first prediction (``previous_score``
  ``None``) is the only case where an above‑threshold score creates an alert.
* ``dedupe_key(project_id, reason_type)`` creates a stable string key that can be
  used by downstream services to de‑duplicate open alerts.

All functions are pure (no I/O) and type‑annotated for clarity.
"""

from __future__ import annotations

from typing import Optional, Dict

# ---------------------------------------------------------------------------
# Helper for de‑duplication keys
# ---------------------------------------------------------------------------

def dedupe_key(project_id: str, reason_type: str) -> str:
    """Return a deterministic key for alert de‑duplication.

    Parameters
    ----------
    project_id: str
        Identifier of the project the alert relates to.
    reason_type: str
        A short identifier describing the alert category (e.g. ``"risk_score"``).
    """
    return f"{project_id}:{reason_type}"

# ---------------------------------------------------------------------------
# Core alert evaluation
# ---------------------------------------------------------------------------

def evaluate_alert(
    *args,
    new_score: Optional[float] = None,
    previous_score: Optional[float] = None,
    threshold: float = 60,
    project_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Return an alert dict or ``None`` based on the scoring rules.

    Supports both signatures:
    - ``evaluate_alert(new_score, previous_score=None, threshold=60)`` (Contract/Person A)
    - ``evaluate_alert(project_id, new_score, previous_score=None, threshold=60)`` (Extended)

    The returned dictionary contains:
    * ``reason`` – human‑readable explanation (may combine two reasons).
    * ``severity`` – ``"High"`` or ``"Medium"``.
    * ``dedupe_key``, ``project_id``, ``new_score``, ``previous_score`` (when project_id is provided).
    """
    pos = list(args)
    if pos:
        if isinstance(pos[0], str):
            project_id = pos.pop(0)
        elif new_score is None:
            new_score = pos.pop(0)
    if pos and new_score is None:
        new_score = pos.pop(0)
    if pos and previous_score is None:
        previous_score = pos.pop(0)
    if pos:
        threshold = pos.pop(0)

    if new_score is None:
        raise ValueError("new_score is required")

    reasons: list[str] = []
    severity: Optional[str] = None

    # Condition 1 – first prediction above threshold only triggers an alert.
    if previous_score is None and new_score > threshold:
        reasons.append(
            f"Risk score {new_score} is above the {threshold} High-risk threshold"
        )
        severity = "High"

    # Condition 2 – significant rise (>=15) compared to previous_score.
    if previous_score is not None:
        delta = new_score - previous_score
        if delta >= 15:
            reasons.append(
                f"Risk score rose by {delta} points, from {previous_score} to {new_score}"
            )
            # If the new score also exceeds the threshold, add that as a second reason.
            if new_score > threshold:
                reasons.append(
                    f"Risk score {new_score} is above the {threshold} High-risk threshold"
                )
                severity = "High"
            else:
                severity = "Medium"
        # If delta is negative or zero we do *not* raise an alert (flat/falling case).
        # No further action needed.

    # If we have gathered any reasons we produce an alert dict.
    if reasons:
        combined_reason = "; ".join(reasons)
        res: Dict[str, Any] = {
            "reason": combined_reason,
            "severity": severity or "Medium",
        }
        if project_id is not None:
            res["project_id"] = project_id
            res["dedupe_key"] = dedupe_key(project_id, "risk_score")
            res["new_score"] = new_score
            res["previous_score"] = previous_score
        return res

    # No alert conditions met
    return None

# ---------------------------------------------------------------------------
# End of module
# ---------------------------------------------------------------------------
