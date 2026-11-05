"""
tests/test_alerts.py
=====================
Pytest suite for backend/core/alerts.py

The spec requires at least 10 cases covering:
* first prediction high/low
* exactly 15 point jump, 14 point jump
* falling score
* crossing threshold
* both conditions together
* no alert when flat or falling even if above threshold
* dedupe_key correctness
"""

import sys
from pathlib import Path
from datetime import date

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.core.alerts import evaluate_alert, dedupe_key

PROJECT_ID = "PRJ-001"
THRESHOLD = 60

class TestAlertEngine:
    def test_first_prediction_above_threshold_triggers_high(self):
        alert = evaluate_alert(PROJECT_ID, new_score=75, previous_score=None, threshold=THRESHOLD)
        assert alert is not None
        assert alert["severity"] == "High"
        assert "above the 60" in alert["reason"]
        assert alert["dedupe_key"] == f"{PROJECT_ID}:risk_score"

    def test_first_prediction_below_threshold_no_alert(self):
        alert = evaluate_alert(PROJECT_ID, new_score=55, previous_score=None, threshold=THRESHOLD)
        assert alert is None

    def test_score_jump_exact_15_above_threshold(self):
        alert = evaluate_alert(PROJECT_ID, new_score=80, previous_score=65, threshold=THRESHOLD)
        # delta = 15, above threshold as well → combined high severity
        assert alert is not None
        assert alert["severity"] == "High"
        assert "rose by 15" in alert["reason"]
        assert "above the 60" in alert["reason"]

    def test_score_jump_exact_15_below_threshold(self):
        alert = evaluate_alert(PROJECT_ID, new_score=55, previous_score=40, threshold=THRESHOLD)
        # delta = 15 but not above threshold → Medium severity
        assert alert is not None
        assert alert["severity"] == "Medium"
        assert "rose by 15" in alert["reason"]
        assert "above the" not in alert["reason"]

    def test_score_jump_less_than_15_no_alert(self):
        alert = evaluate_alert(PROJECT_ID, new_score=70, previous_score=58, threshold=THRESHOLD)
        # delta = 12 (<15) – even though above threshold, only threshold rule fires
        # since previous_score not None, threshold rule should NOT fire (spec: no alert when flat/falling, but above threshold only for first prediction)
        # Therefore no alert expected.
        assert alert is None

    def test_falling_score_no_alert_even_above_threshold(self):
        alert = evaluate_alert(PROJECT_ID, new_score=70, previous_score=80, threshold=THRESHOLD)
        # score dropped, should not alert
        assert alert is None

    def test_crossing_threshold_without_jump(self):
        # previous below threshold, new just above, but not first prediction – should not alert per spec (only first prediction triggers threshold alert)
        alert = evaluate_alert(PROJECT_ID, new_score=62, previous_score=58, threshold=THRESHOLD)
        assert alert is None

    def test_both_conditions_combined(self):
        alert = evaluate_alert(PROJECT_ID, new_score=85, previous_score=65, threshold=THRESHOLD)
        # delta 20 >=15 and above threshold => combined high severity with two reasons
        assert alert is not None
        assert alert["severity"] == "High"
        assert "; " in alert["reason"]
        parts = alert["reason"].split("; ")
        assert any("above the" in p for p in parts)
        assert any("rose by" in p for p in parts)

    def test_dedupe_key_format(self):
        key = dedupe_key("ABC123", "risk_score")
        assert key == "ABC123:risk_score"

    def test_no_alert_when_no_conditions_met(self):
        alert = evaluate_alert(PROJECT_ID, new_score=50, previous_score=52, threshold=THRESHOLD)
        assert alert is None

    def test_multiple_calls_idempotent(self):
        # Ensure consistent output for same inputs
        a1 = evaluate_alert(PROJECT_ID, 75, None, threshold=THRESHOLD)
        a2 = evaluate_alert(PROJECT_ID, 75, None, threshold=THRESHOLD)
        assert a1 == a2
