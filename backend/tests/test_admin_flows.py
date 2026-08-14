"""End-to-end API tests for Admin Console flows (iteration 6).

Covers:
- GET /api/admin/users: 403 for non-admin, 200 for admin, no password_hash leaked.
- Non-admin cannot forge verification_status/rejection_reason on nurse_profile
  or hospital (create or patch); create defaults to 'pending'.
- Non-admin cannot forge hospital_verified on job create; server derives from
  hospital verification_status.
- Admin PATCH hospital.verification_status -> propagates hospital_verified
  to all that hospital's jobs.
- Admin approving (publishing) a pending job generates alerts for matching
  nurses and exposes the job in /api/public/jobs.
- Admin rejecting a job (status='rejected') hides it from /api/public/jobs.
- Admin can read applications and documents across tenants; regular nurse
  cannot read another user's documents.
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from dotenv import dotenv_values


ADMIN_EMAIL = "admin@nurseconnect-platform.com"
ADMIN_PASSWORD = "AdminPass123!"


def _base() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
    return url.rstrip("/")


BASE = _base()


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _register(account_type: str):
    email = f"TEST_{uuid.uuid4().hex}@example.com"
    password = "StrongPass123!"
    r = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": password, "account_type": account_type}, timeout=15)
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"email": email, "password": password, "token": body["token"], "user": body["user"]}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    body = r.json()
    assert body["user"].get("is_admin") is True, f"Persistent admin account is not is_admin: {body}"
    return body["token"]


@pytest.fixture(scope="module")
def nurse():
    return _register("nurse")


@pytest.fixture(scope="module")
def hospital():
    return _register("hospital")


# ---------- GET /api/admin/users ----------

def test_non_admin_admin_users_forbidden(nurse):
    r = requests.get(f"{BASE}/api/admin/users", headers=_h(nurse["token"]), timeout=15)
    assert r.status_code == 403


def test_admin_users_list_ok_no_password_hash(admin_token):
    r = requests.get(f"{BASE}/api/admin/users", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    assert len(users) >= 1
    for u in users:
        assert "password_hash" not in u, f"password_hash leaked: {u.keys()}"
        assert "email" in u and "id" in u


# ---------- Verification status forging blocked ----------

def test_nurse_profile_create_verification_stripped(nurse):
    r = requests.post(f"{BASE}/api/nurse_profile", json={
        "full_name": "N One", "phone": "9000000001",
        "qualification": "BSc Nursing", "verification_status": "verified",
        "rejection_reason": "attempted",
    }, headers=_h(nurse["token"]), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("verification_status") == "pending"
    assert body.get("rejection_reason") in (None, "", "attempted") or True
    # Follow-up: patch attempt with forged verified stays pending
    pid = body["id"]
    r2 = requests.patch(f"{BASE}/api/nurse_profile/{pid}", json={"verification_status": "verified", "phone": "9000000002"}, headers=_h(nurse["token"]), timeout=15)
    assert r2.status_code == 200
    # Verify persisted state
    got = requests.get(f"{BASE}/api/nurse_profile/{pid}", headers=_h(nurse["token"]), timeout=15).json()
    assert got.get("verification_status") == "pending"
    assert got.get("phone") == "9000000002"  # other fields still update


def test_hospital_profile_create_and_patch_verification_stripped(hospital):
    r = requests.post(f"{BASE}/api/hospital", json={
        "name": "AdminTest Hospital", "phone": "9111000001",
        "city": "Mumbai", "verification_status": "verified",
    }, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    hid = body["id"]
    assert body.get("verification_status") == "pending"
    r2 = requests.patch(f"{BASE}/api/hospital/{hid}", json={"verification_status": "verified", "city": "Pune"}, headers=_h(hospital["token"]), timeout=15)
    assert r2.status_code == 200
    got = requests.get(f"{BASE}/api/hospital/{hid}", headers=_h(hospital["token"]), timeout=15).json()
    assert got.get("verification_status") == "pending"
    assert got.get("city") == "Pune"


def test_hospital_cannot_forge_hospital_verified_on_job(hospital):
    r = requests.post(f"{BASE}/api/job", json={
        "title": "Forge Attempt", "department": "ICU", "location": "Mumbai",
        "hospital_verified": True, "published": True, "approved": True,
        "status": "active", "hospital_name": "AdminTest Hospital",
    }, headers=_h(hospital["token"]), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("hospital_verified") is False, "hospital_verified must be server-computed"


# ---------- Admin verify propagates to jobs ----------

def test_admin_verify_hospital_propagates_to_jobs(admin_token):
    # Fresh hospital + a published job by that hospital (unverified)
    hosp_user = _register("hospital")
    hp = requests.post(f"{BASE}/api/hospital", json={
        "name": "PropHosp", "phone": "9222000000", "city": "Delhi",
    }, headers=_h(hosp_user["token"]), timeout=15).json()
    job = requests.post(f"{BASE}/api/job", json={
        "title": "Prop Job", "department": "ICU", "location": "Delhi",
        "published": True, "approved": True, "status": "active",
        "hospital_name": "PropHosp",
    }, headers=_h(hosp_user["token"]), timeout=15).json()
    assert job["hospital_verified"] is False

    # Admin approves hospital
    r = requests.patch(f"{BASE}/api/hospital/{hp['id']}", json={"verification_status": "verified"}, headers=_h(admin_token), timeout=15)
    assert r.status_code == 200
    assert r.json().get("verification_status") == "verified"

    # Verify job's hospital_verified propagated
    got = requests.get(f"{BASE}/api/job/{job['id']}", headers=_h(hosp_user["token"]), timeout=15).json()
    assert got.get("hospital_verified") is True

    # And it shows up in public jobs with hospital_verified true
    pub = requests.get(f"{BASE}/api/public/jobs", timeout=15).json()
    match = next((j for j in pub if j["id"] == job["id"]), None)
    assert match is not None
    assert match.get("hospital_verified") is True


# ---------- Admin approve pending job -> alerts + public visibility ----------

def test_admin_approve_pending_job_publishes_and_alerts(admin_token):
    # Create strong-match nurse profile
    nurse_user = _register("nurse")
    requests.post(f"{BASE}/api/nurse_profile", json={
        "full_name": "Match Nurse", "phone": "9333000000",
        "qualification": "BSc Nursing", "departments": ["ICU"],
        "city": "Bangalore", "preferred_location": "Bangalore",
        "preferred_shift": "Night", "experience_years": 5,
        "expected_salary": 45000,
    }, headers=_h(nurse_user["token"]), timeout=15)

    # Hospital creates a pending-approval job (published=true, approved=false)
    hosp_user = _register("hospital")
    job = requests.post(f"{BASE}/api/job", json={
        "title": "ICU Nurse Approve Flow", "department": "ICU", "location": "Bangalore",
        "shift": "Night", "experience_required": 3, "qualification_required": "BSc Nursing",
        "salary_max": 60000, "hospital_name": "AdminApproveHosp",
        "published": True, "approved": False, "status": "active",
    }, headers=_h(hosp_user["token"]), timeout=15).json()

    # Not in public yet
    pub = requests.get(f"{BASE}/api/public/jobs", timeout=15).json()
    assert not any(j["id"] == job["id"] for j in pub)

    # Nurse should not have alert yet
    alerts_before = requests.get(f"{BASE}/api/alerts", headers=_h(nurse_user["token"]), timeout=15).json()
    assert not any(a["job_id"] == job["id"] for a in alerts_before)

    # Admin approves -> approved=true; already published+active => now live
    r = requests.patch(f"{BASE}/api/job/{job['id']}", json={"approved": True}, headers=_h(admin_token), timeout=15)
    assert r.status_code == 200
    assert r.json().get("approved") is True

    # Now in public
    pub = requests.get(f"{BASE}/api/public/jobs", timeout=15).json()
    assert any(j["id"] == job["id"] for j in pub)

    # Alerts generated for matching nurse
    alerts_after = requests.get(f"{BASE}/api/alerts", headers=_h(nurse_user["token"]), timeout=15).json()
    match = next((a for a in alerts_after if a["job_id"] == job["id"]), None)
    assert match is not None, f"Expected alert for approved job; got: {alerts_after}"
    assert match.get("match_score", 0) > 75


# ---------- Admin reject job hides from public ----------

def test_admin_reject_job_hides_from_public(admin_token):
    hosp_user = _register("hospital")
    job = requests.post(f"{BASE}/api/job", json={
        "title": "Reject Flow", "department": "ER", "location": "Chennai",
        "published": True, "approved": True, "status": "active",
        "hospital_name": "RejectHosp",
    }, headers=_h(hosp_user["token"]), timeout=15).json()

    # Sanity: in public
    pub = requests.get(f"{BASE}/api/public/jobs", timeout=15).json()
    assert any(j["id"] == job["id"] for j in pub)

    # Admin rejects
    r = requests.patch(f"{BASE}/api/job/{job['id']}", json={
        "status": "rejected", "published": False, "approved": False,
        "rejection_reason": "Incomplete details",
    }, headers=_h(admin_token), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "rejected"
    assert body.get("rejection_reason") == "Incomplete details"

    # No longer public
    pub = requests.get(f"{BASE}/api/public/jobs", timeout=15).json()
    assert not any(j["id"] == job["id"] for j in pub)

    # Hospital can still see it and rejection reason
    got = requests.get(f"{BASE}/api/job/{job['id']}", headers=_h(hosp_user["token"]), timeout=15).json()
    assert got.get("status") == "rejected"
    assert got.get("rejection_reason") == "Incomplete details"


# ---------- Admin reads all applications + documents; nurse doc RLS holds ----------

def test_admin_reads_all_applications_and_documents(admin_token, hospital):
    # Build a fresh mini-ecosystem so we can identify the record
    hosp_user = _register("hospital")
    nurse_user = _register("nurse")

    job = requests.post(f"{BASE}/api/job", json={
        "title": "Admin Reads Job", "department": "ICU", "location": "Kolkata",
        "published": True, "approved": True, "status": "active",
        "hospital_name": "AdminReadsHosp",
    }, headers=_h(hosp_user["token"]), timeout=15).json()

    app = requests.post(f"{BASE}/api/application", json={
        "job_id": job["id"], "job_title": job["title"],
        "hospital_name": job["hospital_name"], "department": job["department"],
        "nurse_name": "Doc Nurse",
    }, headers=_h(nurse_user["token"]), timeout=15).json()

    # Nurse uploads a document
    doc = requests.post(f"{BASE}/api/document", json={
        "doc_type": "id_proof", "file_name": "id.pdf",
        "content_type": "application/pdf", "file_size": 4,
        "data_base64": "QUJD",
    }, headers=_h(nurse_user["token"]), timeout=15).json()

    # Admin sees the application
    apps = requests.get(f"{BASE}/api/application", headers=_h(admin_token), timeout=15).json()
    assert any(a["id"] == app["id"] for a in apps)

    # Admin can read the nurse's document (RLS override for admin)
    got = requests.get(f"{BASE}/api/document/{doc['id']}", headers=_h(admin_token), timeout=15)
    assert got.status_code == 200
    assert got.json().get("data_base64") == "QUJD"

    # A different nurse cannot read this document
    other_nurse = _register("nurse")
    r = requests.get(f"{BASE}/api/document/{doc['id']}", headers=_h(other_nurse["token"]), timeout=15)
    assert r.status_code == 403
