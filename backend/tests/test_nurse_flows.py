"""End-to-end API tests for the Nurse Dashboard flows (iteration 3).

Covers:
- Register/login as nurse and hospital.
- Hospital creates job -> nurse sees it via /api/public/jobs and /api/job/{id}.
- Nurse saves/applies; duplicate application returns 409.
- Nurse cannot change own application status (403).
- Hospital PATCH application -> shortlisted.
- Hospital creates interview; nurse can read.
- Nurse-to-nurse isolation on application/saved_job/interview/document
  and cross-read on nurse_profile is 403.
- Document upload / download metadata / delete.
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
    return {"email": email, "password": password, "token": body["token"], "user": body["user"]}


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def nurse_a():
    return _register("nurse")


@pytest.fixture(scope="module")
def nurse_b():
    return _register("nurse")


@pytest.fixture(scope="module")
def hospital():
    return _register("hospital")


@pytest.fixture(scope="module")
def hospital_2():
    return _register("hospital")


@pytest.fixture(scope="module")
def created_job(hospital):
    payload = {
        "title": "ICU Staff Nurse", "department": "ICU", "location": "Mumbai",
        "salary_min": 35000, "salary_max": 55000, "shift": "Day",
        "experience_required": 2, "qualification_required": "BSc Nursing",
        "openings": 3, "hospital_name": "Test City Hospital",
        "hospital_verified": True, "published": True, "approved": True,
        "status": "active", "accommodation": False,
    }
    r = requests.post(f"{BASE}/api/job", json=payload, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Auth ----------

def test_register_login_nurse(nurse_a):
    assert nurse_a["user"]["account_type"] == "nurse"
    assert nurse_a["user"]["is_admin"] is False


def test_status_endpoint_public():
    r = requests.get(f"{BASE}/api/status", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- Job discovery ----------

def test_public_jobs_lists_created_job(created_job):
    r = requests.get(f"{BASE}/api/public/jobs", timeout=15)
    assert r.status_code == 200
    ids = [j["id"] for j in r.json()]
    assert created_job["id"] in ids
    # hospital_id is redacted in public listing
    match = next(j for j in r.json() if j["id"] == created_job["id"])
    assert "hospital_id" not in match
    assert match["hospital_name"] == "Test City Hospital"


def test_nurse_can_read_active_job_by_id(nurse_a, created_job):
    r = requests.get(f"{BASE}/api/job/{created_job['id']}", headers=_h(nurse_a["token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["title"] == "ICU Staff Nurse"


# ---------- Save & Apply ----------

def test_nurse_saves_job(nurse_a, created_job):
    r = requests.post(f"{BASE}/api/saved_job", json={
        "job_id": created_job["id"], "job_title": created_job["title"],
        "hospital_name": created_job["hospital_name"],
    }, headers=_h(nurse_a["token"]), timeout=15)
    assert r.status_code == 200
    saved_id = r.json()["id"]
    # GET verifies persistence
    listed = requests.get(f"{BASE}/api/saved_job", headers=_h(nurse_a["token"]), timeout=15).json()
    assert any(s["id"] == saved_id and s["job_id"] == created_job["id"] for s in listed)


def test_nurse_applies_and_duplicate_blocked(nurse_a, created_job):
    payload = {
        "job_id": created_job["id"], "job_title": created_job["title"],
        "hospital_name": created_job["hospital_name"], "department": created_job["department"],
    }
    r = requests.post(f"{BASE}/api/application", json=payload, headers=_h(nurse_a["token"]), timeout=15)
    assert r.status_code == 200, r.text
    app = r.json()
    assert app["status"] == "submitted"
    # Duplicate must return 409 with correct detail
    dup = requests.post(f"{BASE}/api/application", json=payload, headers=_h(nurse_a["token"]), timeout=15)
    assert dup.status_code == 409
    assert "already applied" in dup.json()["detail"].lower()


def test_nurse_cannot_change_own_application_status(nurse_a, created_job):
    apps = requests.get(f"{BASE}/api/application", headers=_h(nurse_a["token"]), timeout=15).json()
    my_app = next(a for a in apps if a["job_id"] == created_job["id"])
    r = requests.patch(f"{BASE}/api/application/{my_app['id']}", json={"status": "shortlisted"}, headers=_h(nurse_a["token"]), timeout=15)
    assert r.status_code == 403


def test_hospital_shortlists_application(nurse_a, hospital, created_job):
    apps = requests.get(f"{BASE}/api/application", headers=_h(nurse_a["token"]), timeout=15).json()
    my_app = next(a for a in apps if a["job_id"] == created_job["id"])
    r = requests.patch(f"{BASE}/api/application/{my_app['id']}", json={"status": "shortlisted"}, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200, r.text
    # Nurse sees updated status
    got = requests.get(f"{BASE}/api/application/{my_app['id']}", headers=_h(nurse_a["token"]), timeout=15).json()
    assert got["status"] == "shortlisted"


# ---------- Interview ----------

def test_hospital_creates_interview_nurse_reads(nurse_a, hospital, created_job):
    apps = requests.get(f"{BASE}/api/application", headers=_h(nurse_a["token"]), timeout=15).json()
    my_app = next(a for a in apps if a["job_id"] == created_job["id"])
    r = requests.post(f"{BASE}/api/interview", json={
        "application_id": my_app["id"], "date": "2099-01-01", "time": "10:30",
        "interview_type": "Video", "meeting_link": "https://meet.example/xyz",
        "job_title": created_job["title"], "hospital_name": created_job["hospital_name"],
    }, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200, r.text
    interview = r.json()
    listed = requests.get(f"{BASE}/api/interview", headers=_h(nurse_a["token"]), timeout=15).json()
    assert any(i["id"] == interview["id"] and i["meeting_link"] == "https://meet.example/xyz" for i in listed)


# ---------- Nurse-to-nurse isolation ----------

def test_nurse_b_sees_empty_and_cannot_read_nurse_a_profile(nurse_a, nurse_b):
    # First ensure nurse A has a nurse_profile
    r = requests.post(f"{BASE}/api/nurse_profile", json={"full_name": "Nurse A", "recruitment_visible": False},
                      headers=_h(nurse_a["token"]), timeout=15)
    assert r.status_code == 200
    np_a_id = r.json()["id"]

    for path in ("/api/application", "/api/saved_job", "/api/interview", "/api/document"):
        r = requests.get(f"{BASE}{path}", headers=_h(nurse_b["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json() == [], f"Nurse B should see empty {path}, got {r.json()}"

    r = requests.get(f"{BASE}/api/nurse_profile/{np_a_id}", headers=_h(nurse_b["token"]), timeout=15)
    assert r.status_code == 403


# ---------- Documents ----------

def test_document_upload_download_delete(nurse_b):
    payload = {"doc_type": "qualification_certificate", "file_name": "cert.pdf",
               "content_type": "application/pdf", "file_size": 12,
               "data_base64": "SGVsbG8gV29ybGQh"}
    r = requests.post(f"{BASE}/api/document", json=payload, headers=_h(nurse_b["token"]), timeout=15)
    assert r.status_code == 200
    doc_id = r.json()["id"]
    got = requests.get(f"{BASE}/api/document/{doc_id}", headers=_h(nurse_b["token"]), timeout=15)
    assert got.status_code == 200
    assert got.json()["data_base64"] == "SGVsbG8gV29ybGQh"
    d = requests.delete(f"{BASE}/api/document/{doc_id}", headers=_h(nurse_b["token"]), timeout=15)
    assert d.status_code == 200
    assert requests.get(f"{BASE}/api/document/{doc_id}", headers=_h(nurse_b["token"]), timeout=15).status_code == 404


# ---------- Cross-hospital isolation on application ----------

def test_other_hospital_cannot_read_application(nurse_a, hospital_2, created_job):
    apps = requests.get(f"{BASE}/api/application", headers=_h(nurse_a["token"]), timeout=15).json()
    my_app = next(a for a in apps if a["job_id"] == created_job["id"])
    r = requests.get(f"{BASE}/api/application/{my_app['id']}", headers=_h(hospital_2["token"]), timeout=15)
    assert r.status_code == 403
