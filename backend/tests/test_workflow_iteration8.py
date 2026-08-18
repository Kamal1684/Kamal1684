"""Iteration 8 - End-to-end Nurse+Hospital workflow + RLS verification.

Covers:
- Register hospital + nurse (mobile validation)
- Hospital profile save
- Job create + publish (published/approved/status active)
- Nurse apply -> duplicate 409 -> My Applications visible
- Hospital Shortlist -> Schedule Interview -> Complete -> Select -> Hired
- Reject path (second nurse)
- Status visibility on nurse side
- RLS isolation between two hospitals
"""
import os
import uuid
import random
import pytest
import requests
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

PASSWORD = "StrongPass123!"


def _mobile():
    return "9" + "".join(str(random.randint(0, 9)) for _ in range(9))


def _email(tag):
    return f"wftest_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register_login(account_type, tag):
    email = _email(tag)
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PASSWORD, "account_type": account_type, "mobile": _mobile()
    })
    assert r.status_code == 200, f"register {tag}: {r.status_code} {r.text}"
    r = requests.post(f"{API}/auth/login", json={
        "email": email, "password": PASSWORD, "account_type": account_type
    })
    assert r.status_code == 200, f"login {tag}: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"], "headers": {"Authorization": f"Bearer {data['token']}"}}


@pytest.fixture(scope="module")
def workflow_context():
    hospital_a = _register_login("hospital", "hospA")
    hospital_b = _register_login("hospital", "hospB")
    nurse_a = _register_login("nurse", "nurseA")
    nurse_b = _register_login("nurse", "nurseB")
    return {"hA": hospital_a, "hB": hospital_b, "nA": nurse_a, "nB": nurse_b}


# --- Registration/mobile validation ---
def test_register_rejects_bad_mobile():
    r = requests.post(f"{API}/auth/register", json={
        "email": _email("badmob"), "password": PASSWORD, "account_type": "nurse", "mobile": "1234567890"
    })
    assert r.status_code == 400


def test_register_rejects_duplicate_mobile(workflow_context):
    mobile = workflow_context["nA"]["user"].get("mobile")
    r = requests.post(f"{API}/auth/register", json={
        "email": _email("dupmob"), "password": PASSWORD, "account_type": "nurse", "mobile": mobile.replace("+91", "")
    })
    assert r.status_code == 409


# --- Hospital profile + Publish job ---
def test_hospital_profile_and_publish_job(workflow_context):
    ctx = workflow_context
    hA = ctx["hA"]
    r = requests.post(f"{API}/hospital", headers=hA["headers"], json={
        "name": "WFTest Hospital A", "city": "Delhi", "state": "Delhi", "public": True
    })
    assert r.status_code == 200, r.text
    hospital_doc = r.json()
    ctx["hospital_a_doc"] = hospital_doc

    # Create + publish job in one call (published=true,approved=true,status=active)
    r = requests.post(f"{API}/job", headers=hA["headers"], json={
        "title": "Nursing Officer", "department": "ICU", "location": "Delhi",
        "hospital_name": "WFTest Hospital A", "shift": "day",
        "salary_min": 30000, "salary_max": 60000,
        "apply_by": "2026-12-31",
        "published": True, "approved": True, "status": "active"
    })
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["published"] is True and job["approved"] is True and job["status"] == "active"
    ctx["job"] = job

    # Nurse can see it via /api/public/jobs
    r = requests.get(f"{API}/public/jobs")
    assert r.status_code == 200
    assert any(j["id"] == job["id"] for j in r.json())


# --- Nurse apply + duplicate 409 ---
def test_nurse_apply_and_duplicate_blocked(workflow_context):
    ctx = workflow_context
    nA = ctx["nA"]
    job_id = ctx["job"]["id"]

    # Read job detail as nurse
    r = requests.get(f"{API}/job/{job_id}", headers=nA["headers"])
    assert r.status_code == 200

    # Apply
    r = requests.post(f"{API}/application", headers=nA["headers"], json={"job_id": job_id})
    assert r.status_code == 200, r.text
    app_a = r.json()
    ctx["app_a"] = app_a

    # Duplicate must return 409
    r = requests.post(f"{API}/application", headers=nA["headers"], json={"job_id": job_id})
    assert r.status_code == 409

    # Nurse My Applications shows it with status submitted/applied
    r = requests.get(f"{API}/application", headers=nA["headers"])
    assert r.status_code == 200
    apps = r.json()
    mine = [a for a in apps if a["id"] == app_a["id"]]
    assert len(mine) == 1
    assert mine[0]["status"] in {"submitted", "applied"}


# --- Hospital candidate transitions Shortlist -> Interview Scheduled -> Completed -> Selected ---
def test_hospital_shortlist_interview_select(workflow_context):
    ctx = workflow_context
    hA = ctx["hA"]
    nA = ctx["nA"]
    app_id = ctx["app_a"]["id"]

    # Hospital sees application
    r = requests.get(f"{API}/application", headers=hA["headers"])
    assert r.status_code == 200
    assert any(a["id"] == app_id for a in r.json())

    # Shortlist
    r = requests.patch(f"{API}/application/{app_id}", headers=hA["headers"], json={"status": "shortlisted"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "shortlisted"

    # Schedule interview: create + patch app
    r = requests.post(f"{API}/interview", headers=hA["headers"], json={
        "application_id": app_id, "date": "2026-02-15", "time": "10:00",
        "type": "video", "meeting_link": "https://meet.example.com/xyz"
    })
    assert r.status_code == 200, r.text
    interview = r.json()
    ctx["interview"] = interview

    r = requests.patch(f"{API}/application/{app_id}", headers=hA["headers"], json={"status": "interview_scheduled"})
    assert r.status_code == 200
    assert r.json()["status"] == "interview_scheduled"

    # Nurse sees interview_scheduled + interview record
    r = requests.get(f"{API}/application", headers=nA["headers"])
    assert any(a["id"] == app_id and a["status"] == "interview_scheduled" for a in r.json())
    r = requests.get(f"{API}/interview", headers=nA["headers"])
    assert any(iv["id"] == interview["id"] for iv in r.json())

    # Mark interview completed
    r = requests.patch(f"{API}/interview/{interview['id']}", headers=hA["headers"], json={"status": "completed"})
    assert r.status_code == 200

    # Select candidate
    r = requests.patch(f"{API}/application/{app_id}", headers=hA["headers"], json={"status": "selected"})
    assert r.status_code == 200
    assert r.json()["status"] == "selected"

    # Nurse sees selected
    r = requests.get(f"{API}/application", headers=nA["headers"])
    assert any(a["id"] == app_id and a["status"] == "selected" for a in r.json())


# --- Reject path with second nurse ---
def test_reject_path(workflow_context):
    ctx = workflow_context
    nB = ctx["nB"]
    job_id = ctx["job"]["id"]

    r = requests.post(f"{API}/application", headers=nB["headers"], json={"job_id": job_id})
    assert r.status_code == 200
    app_b = r.json()

    r = requests.patch(f"{API}/application/{app_b['id']}", headers=ctx["hA"]["headers"],
                       json={"status": "rejected"})
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"

    r = requests.get(f"{API}/application", headers=nB["headers"])
    assert any(a["id"] == app_b["id"] and a["status"] == "rejected" for a in r.json())


# --- Nurse cannot change own application status ---
def test_nurse_cannot_change_status(workflow_context):
    ctx = workflow_context
    r = requests.patch(f"{API}/application/{ctx['app_a']['id']}",
                       headers=ctx["nA"]["headers"], json={"status": "selected"})
    assert r.status_code == 403


# --- RLS: hospital B cannot see A's jobs/apps and cannot PATCH ---
def test_rls_hospital_isolation(workflow_context):
    ctx = workflow_context
    hB = ctx["hB"]

    r = requests.get(f"{API}/job", headers=hB["headers"])
    assert r.status_code == 200
    assert not any(j["id"] == ctx["job"]["id"] for j in r.json())

    r = requests.get(f"{API}/application", headers=hB["headers"])
    assert r.status_code == 200
    assert not any(a["id"] == ctx["app_a"]["id"] for a in r.json())

    r = requests.get(f"{API}/interview", headers=hB["headers"])
    assert r.status_code == 200
    assert not any(iv["id"] == ctx["interview"]["id"] for iv in r.json())

    # PATCH by hospital B on hospital A's application -> 403
    r = requests.patch(f"{API}/application/{ctx['app_a']['id']}", headers=hB["headers"],
                       json={"status": "shortlisted"})
    assert r.status_code == 403

    # GET single job/application/interview by ID must also be blocked
    r = requests.get(f"{API}/application/{ctx['app_a']['id']}", headers=hB["headers"])
    assert r.status_code == 403
    r = requests.get(f"{API}/interview/{ctx['interview']['id']}", headers=hB["headers"])
    assert r.status_code == 403
