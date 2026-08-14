"""Job Alerts feature tests (iteration 5).

Coverage:
- Strong-match nurse gets alert with match_score > 75 upon job publish.
- Weak-match nurse gets NO alert.
- Draft job creates no alerts; PATCH transition to live creates alerts.
- Re-PATCH already-live job does not duplicate alerts.
- RLS: GET /api/alerts scoped to caller; hospital gets []; unauth -> 401.
- POST /api/alerts (generic resource) rejected as 404.
- POST /api/alerts/mark-read isolates to caller.
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from dotenv import dotenv_values


def _base() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
    return url.rstrip("/")


BASE = _base()


def _register(account_type: str):
    email = f"TEST_{uuid.uuid4().hex}@example.com"
    password = "StrongPass123!"
    r = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": password, "account_type": account_type}, timeout=15)
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"email": email, "token": body["token"], "user": body["user"]}


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


STRONG_PROFILE = {
    "full_name": "Strong Match Nurse",
    "qualification": "BSc Nursing",
    "experience_years": 5,
    "departments": ["ICU"],
    "city": "Mumbai",
    "preferred_location": "Mumbai",
    "preferred_shift": "Day",
    "expected_salary": 40000,
}

WEAK_PROFILE = {
    "full_name": "Weak Match Nurse",
    "qualification": "GNM",
    "experience_years": 0,
    "departments": ["Pediatrics"],
    "city": "Chennai",
    "preferred_location": "Chennai",
    "preferred_shift": "Night",
    "expected_salary": 90000,
}

LIVE_JOB = {
    "title": "ICU Nurse", "department": "ICU", "location": "Mumbai",
    "salary_min": 35000, "salary_max": 50000, "shift": "Day",
    "experience_required": 2, "qualification_required": "BSc Nursing",
    "openings": 3, "hospital_name": "Alert Hospital",
    "published": True, "approved": True, "status": "active",
}


@pytest.fixture(scope="module")
def hospital():
    return _register("hospital")


@pytest.fixture(scope="module")
def strong_nurse():
    n = _register("nurse")
    r = requests.post(f"{BASE}/api/nurse_profile", json=STRONG_PROFILE, headers=_h(n["token"]), timeout=15)
    assert r.status_code == 200, r.text
    return n


@pytest.fixture(scope="module")
def weak_nurse():
    n = _register("nurse")
    r = requests.post(f"{BASE}/api/nurse_profile", json=WEAK_PROFILE, headers=_h(n["token"]), timeout=15)
    assert r.status_code == 200, r.text
    return n


def _alerts_for(token: str):
    r = requests.get(f"{BASE}/api/alerts", headers=_h(token), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_publish_matching_job_alerts_strong_nurse(hospital, strong_nurse, weak_nurse):
    payload = dict(LIVE_JOB)
    r = requests.post(f"{BASE}/api/job", json=payload, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200, r.text
    job = r.json()

    strong_alerts = [a for a in _alerts_for(strong_nurse["token"]) if a["job_id"] == job["id"]]
    assert len(strong_alerts) == 1, f"Expected exactly one alert for strong nurse, got {strong_alerts}"
    a = strong_alerts[0]
    assert a["match_score"] > 75
    assert a["job_title"] == "ICU Nurse"
    assert a["hospital_name"] == "Alert Hospital"
    assert a["read"] is False
    assert "created_at" in a

    weak_alerts = [a for a in _alerts_for(weak_nurse["token"]) if a["job_id"] == job["id"]]
    assert weak_alerts == [], f"Weak nurse should not receive alert, got {weak_alerts}"


def test_draft_job_creates_no_alert_then_transition_does(hospital, strong_nurse):
    draft = dict(LIVE_JOB)
    draft.update({"title": "Draft ICU", "published": False, "approved": False, "status": "draft"})
    r = requests.post(f"{BASE}/api/job", json=draft, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200
    job = r.json()

    before = [a for a in _alerts_for(strong_nurse["token"]) if a["job_id"] == job["id"]]
    assert before == [], "Draft job should not generate alerts"

    # Transition to live
    r = requests.patch(f"{BASE}/api/job/{job['id']}", json={"published": True, "approved": True, "status": "active"}, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200

    after = [a for a in _alerts_for(strong_nurse["token"]) if a["job_id"] == job["id"]]
    assert len(after) == 1, f"Transition to live must create one alert, got {after}"

    # Re-PATCH the already-live job -> no duplicate alert
    r = requests.patch(f"{BASE}/api/job/{job['id']}", json={"salary_max": 55000}, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200
    after2 = [a for a in _alerts_for(strong_nurse["token"]) if a["job_id"] == job["id"]]
    assert len(after2) == 1, f"Re-patch of live job must not duplicate alert, got {after2}"


def test_alerts_rls_hospital_and_unauth(hospital):
    r = requests.get(f"{BASE}/api/alerts", headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200
    assert r.json() == []

    r = requests.get(f"{BASE}/api/alerts", timeout=15)
    assert r.status_code == 401


def test_alerts_rls_nurse_isolation(strong_nurse):
    other = _register("nurse")
    r = requests.get(f"{BASE}/api/alerts", headers=_h(other["token"]), timeout=15)
    assert r.status_code == 200
    assert r.json() == [], "New nurse without matches must see no alerts"

    strong_ids = {a["id"] for a in _alerts_for(strong_nurse["token"])}
    assert len(strong_ids) >= 1, "Strong nurse should have at least one alert from prior tests"


def test_post_alerts_generic_route_rejected(strong_nurse):
    r = requests.post(f"{BASE}/api/alerts", json={"foo": "bar"}, headers=_h(strong_nurse["token"]), timeout=15)
    # generic resource route validates against ALLOWED_RESOURCES -> 404
    # (specific /alerts/mark-read is a different path)
    assert r.status_code == 404


def test_mark_read_scoped_to_caller(strong_nurse):
    nurse_b = _register("nurse")
    # give nurse_b a matching profile so they have their own alerts
    requests.post(f"{BASE}/api/nurse_profile", json=STRONG_PROFILE, headers=_h(nurse_b["token"]), timeout=15)
    # publish a fresh job so nurse_b definitely gets an unread alert
    hospital = _register("hospital")
    fresh_job = dict(LIVE_JOB); fresh_job["title"] = "ICU Nurse Fresh"
    r = requests.post(f"{BASE}/api/job", json=fresh_job, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200

    # nurse_b marks read
    r = requests.post(f"{BASE}/api/alerts/mark-read", headers=_h(nurse_b["token"]), timeout=15)
    assert r.status_code == 200
    assert "updated" in r.json()
    b_updated = r.json()["updated"]
    assert b_updated >= 1

    # nurse_b's alerts are all read
    b_alerts = _alerts_for(nurse_b["token"])
    assert all(a["read"] is True for a in b_alerts)

    # strong nurse still has at least one unread alert (was not touched)
    a_alerts = _alerts_for(strong_nurse["token"])
    assert any(a["read"] is False for a in a_alerts), "Marking nurse B read must not affect nurse A"


def test_unauth_mark_read():
    r = requests.post(f"{BASE}/api/alerts/mark-read", timeout=15)
    assert r.status_code == 401
