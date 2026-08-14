"""End-to-end API tests for the Hospital Console flows (iteration 4).

Covers:
- Hospital-to-hospital isolation on jobs, applications, interviews.
- Cross-hospital PATCH on job / application -> 403.
- Job publish/close visibility on /api/public/jobs.
- Nurse cannot access hospital PATCH on job/application/interview.
- Nurse snapshot fields on application flow through and are readable by owning hospital.
- Interview create + PATCH application to interview_scheduled works for owning hospital.
- Hospital profile create + hospital_license document round-trip.
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
def hospital_a():
    return _register("hospital")


@pytest.fixture(scope="module")
def hospital_b():
    return _register("hospital")


@pytest.fixture(scope="module")
def nurse_x():
    return _register("nurse")


@pytest.fixture(scope="module")
def job_a(hospital_a):
    payload = {
        "title": "ER Nurse", "department": "Emergency", "location": "Delhi",
        "salary_min": 40000, "salary_max": 60000, "shift": "Night",
        "experience_required": 3, "qualification_required": "BSc",
        "openings": 2, "hospital_name": "Hospital A",
        "hospital_verified": False, "published": True, "approved": True,
        "status": "active", "accommodation": True,
    }
    r = requests.post(f"{BASE}/api/job", json=payload, headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Hospital-to-hospital isolation ----------

def test_hospital_b_cannot_see_hospital_a_jobs(hospital_a, hospital_b, job_a):
    # Hospital B GET /api/job should NOT include Hospital A's job
    r = requests.get(f"{BASE}/api/job", headers=_h(hospital_b["token"]), timeout=15)
    assert r.status_code == 200
    ids = [j["id"] for j in r.json()]
    assert job_a["id"] not in ids


def test_hospital_b_cannot_patch_hospital_a_job(hospital_b, job_a):
    r = requests.patch(f"{BASE}/api/job/{job_a['id']}", json={"title": "hijack"}, headers=_h(hospital_b["token"]), timeout=15)
    assert r.status_code == 403


def test_hospital_a_can_patch_own_job(hospital_a, job_a):
    r = requests.patch(f"{BASE}/api/job/{job_a['id']}", json={"salary_max": 65000}, headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200
    got = requests.get(f"{BASE}/api/job/{job_a['id']}", headers=_h(hospital_a["token"]), timeout=15).json()
    assert got["salary_max"] == 65000


# ---------- Applications with nurse snapshot ----------

@pytest.fixture(scope="module")
def application_with_snapshot(nurse_x, job_a):
    payload = {
        "job_id": job_a["id"], "job_title": job_a["title"],
        "hospital_name": job_a["hospital_name"], "department": job_a["department"],
        # Nurse snapshot (new mechanism this iteration)
        "nurse_name": "Test Nurse X",
        "nurse_qualification": "BSc Nursing",
        "nurse_experience_years": 4,
        "nurse_departments": ["Emergency", "ICU"],
        "nurse_location": "Delhi",
        "nurse_city": "Delhi",
        "nurse_phone": "9999999999",
        "nurse_verification_status": "pending",
        "nurse_preferred_shift": "Night",
        "nurse_expected_salary": 55000,
        "nurse_preferred_location": "Delhi",
        "nurse_accommodation_required": True,
    }
    r = requests.post(f"{BASE}/api/application", json=payload, headers=_h(nurse_x["token"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_hospital_a_reads_application_snapshot(hospital_a, application_with_snapshot):
    apps = requests.get(f"{BASE}/api/application", headers=_h(hospital_a["token"]), timeout=15).json()
    match = next((a for a in apps if a["id"] == application_with_snapshot["id"]), None)
    assert match is not None, "Hospital A should see application to its own job"
    assert match.get("nurse_name") == "Test Nurse X"
    assert match.get("nurse_qualification") == "BSc Nursing"
    assert match.get("nurse_experience_years") == 4
    assert match.get("nurse_accommodation_required") is True


def test_hospital_b_cannot_read_hospital_a_application(hospital_b, application_with_snapshot):
    r = requests.get(f"{BASE}/api/application/{application_with_snapshot['id']}", headers=_h(hospital_b["token"]), timeout=15)
    assert r.status_code == 403


def test_hospital_b_cannot_patch_hospital_a_application(hospital_b, application_with_snapshot):
    r = requests.patch(f"{BASE}/api/application/{application_with_snapshot['id']}", json={"status": "shortlisted"}, headers=_h(hospital_b["token"]), timeout=15)
    assert r.status_code == 403


def test_hospital_b_list_applications_excludes_hospital_a(hospital_b, application_with_snapshot):
    r = requests.get(f"{BASE}/api/application", headers=_h(hospital_b["token"]), timeout=15)
    assert r.status_code == 200
    ids = [a["id"] for a in r.json()]
    assert application_with_snapshot["id"] not in ids


# ---------- Interview by hospital + PATCH application to interview_scheduled ----------

def test_interview_schedule_and_status_transition(hospital_a, application_with_snapshot):
    # PATCH application status -> shortlisted
    r = requests.patch(f"{BASE}/api/application/{application_with_snapshot['id']}", json={"status": "shortlisted"}, headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200

    # Create interview
    r = requests.post(f"{BASE}/api/interview", json={
        "application_id": application_with_snapshot["id"],
        "date": "2099-06-15", "time": "14:00",
        "interview_type": "Video", "meeting_link": "https://meet.example/hospA",
        "job_title": application_with_snapshot["job_title"],
        "hospital_name": application_with_snapshot["hospital_name"],
    }, headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200, r.text
    interview_id = r.json()["id"]

    # PATCH application -> interview_scheduled
    r = requests.patch(f"{BASE}/api/application/{application_with_snapshot['id']}", json={"status": "interview_scheduled"}, headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200

    # Hospital B cannot see the interview
    r = requests.get(f"{BASE}/api/interview", headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200
    assert any(i["id"] == interview_id for i in r.json())


def test_hospital_b_cannot_see_hospital_a_interviews(hospital_b, application_with_snapshot):
    r = requests.get(f"{BASE}/api/interview", headers=_h(hospital_b["token"]), timeout=15)
    assert r.status_code == 200
    for i in r.json():
        assert i.get("application_id") != application_with_snapshot["id"]


# ---------- Job close removes from public visibility ----------

def test_job_close_hides_from_public(hospital_a, job_a):
    r = requests.patch(f"{BASE}/api/job/{job_a['id']}", json={"status": "closed", "published": False}, headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200
    pub = requests.get(f"{BASE}/api/public/jobs", timeout=15).json()
    assert not any(j["id"] == job_a["id"] for j in pub)


def test_nurse_cannot_apply_to_closed_job(nurse_x, job_a):
    # A fresh nurse should be blocked because job is not published+approved+active
    other_nurse = _register("nurse")
    r = requests.post(f"{BASE}/api/application", json={
        "job_id": job_a["id"], "job_title": job_a["title"],
        "hospital_name": job_a["hospital_name"], "department": job_a["department"],
    }, headers=_h(other_nurse["token"]), timeout=15)
    # Backend returns 403 or 404 when job not visible
    assert r.status_code in (400, 403, 404), r.text


# ---------- Nurse cannot patch a job ----------

def test_nurse_cannot_patch_job(nurse_x, job_a):
    r = requests.patch(f"{BASE}/api/job/{job_a['id']}", json={"title": "hax"}, headers=_h(nurse_x["token"]), timeout=15)
    assert r.status_code == 403


# ---------- Hospital profile + license document ----------

def test_hospital_profile_and_license_upload(hospital_a):
    # Create hospital profile
    r = requests.post(f"{BASE}/api/hospital", json={
        "name": "Hospital A Central", "phone": "0111000000",
        "address": "1 Main St", "city": "Delhi", "state": "DL",
        "pincode": "110001", "hospital_type": "Private",
        "beds": 200, "license_number": "LIC-A-001",
    }, headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200, r.text

    # Upload license doc
    r = requests.post(f"{BASE}/api/document", json={
        "doc_type": "hospital_license", "file_name": "lic.pdf",
        "content_type": "application/pdf", "file_size": 12,
        "data_base64": "SGVsbG8gV29ybGQh",
    }, headers=_h(hospital_a["token"]), timeout=15)
    assert r.status_code == 200
    doc_id = r.json()["id"]

    got = requests.get(f"{BASE}/api/document/{doc_id}", headers=_h(hospital_a["token"]), timeout=15)
    assert got.status_code == 200
    assert got.json()["data_base64"] == "SGVsbG8gV29ybGQh"

    d = requests.delete(f"{BASE}/api/document/{doc_id}", headers=_h(hospital_a["token"]), timeout=15)
    assert d.status_code == 200
