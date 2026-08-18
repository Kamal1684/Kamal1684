"""WF8 - Backend contract tests for iteration workflow features.

Covers:
- Select gating: PATCH /application status=selected requires (a) a completed
  interview AND (b) a joining_date; otherwise 400.
- Interview status=completed cascades application status -> interview_completed.
- Nurse can withdraw own application; cannot mutate any other field/status.
- Mark Joined: PATCH status=joined works when currently selected.
- /candidate-documents/{id}: owning hospital OK; different hospital -> 403.
- /candidate-notes/{id}: GET/POST work for owning hospital; other hospital ->
  403; nurse listing /api/application must NOT expose notes field.
"""
import os
import random
import uuid
import pytest
import requests
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = "StrongPass123!"


def _mobile():
    return "9" + "".join(str(random.randint(0, 9)) for _ in range(9))


def _email(tag):
    return f"wf8_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register_login(account_type, tag):
    email = _email(tag)
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PASSWORD, "account_type": account_type, "mobile": _mobile(),
    })
    assert r.status_code == 200, f"register {tag}: {r.status_code} {r.text}"
    r = requests.post(f"{API}/auth/login", json={
        "email": email, "password": PASSWORD, "account_type": account_type,
    })
    assert r.status_code == 200, f"login {tag}: {r.status_code} {r.text}"
    data = r.json()
    return {
        "email": email,
        "token": data["token"],
        "user": data["user"],
        "H": {"Authorization": f"Bearer {data['token']}"},
    }


@pytest.fixture(scope="module")
def ctx():
    hospA = _register_login("hospital", "hospA")
    hospB = _register_login("hospital", "hospB")
    nurse = _register_login("nurse", "nurse1")
    nurse2 = _register_login("nurse", "nurse2")

    # Hospital A creates hospital profile + published job
    r = requests.post(f"{API}/hospital", headers=hospA["H"], json={
        "name": "WF8 Hospital A", "city": "Delhi", "email": hospA["email"],
    })
    assert r.status_code == 200, r.text
    hospA["hospital_id"] = r.json()["id"]

    # Hospital B profile
    r = requests.post(f"{API}/hospital", headers=hospB["H"], json={
        "name": "WF8 Hospital B", "city": "Delhi", "email": hospB["email"],
    })
    assert r.status_code == 200, r.text

    # Job for hospital A - must be published+approved+active
    r = requests.post(f"{API}/job", headers=hospA["H"], json={
        "title": "WF8 Staff Nurse", "department": "ICU", "location": "Delhi",
        "hospital_name": "WF8 Hospital A", "published": True, "approved": True, "status": "active",
        "last_date": "2030-12-31",
    })
    assert r.status_code == 200, r.text
    hospA["job_id"] = r.json()["id"]

    # Nurse profile (complete) + apply
    r = requests.post(f"{API}/nurse_profile", headers=nurse["H"], json={
        "full_name": "N One", "phone": "+919999999901", "city": "Delhi",
        "qualification": "GNM", "experience_years": 3, "departments": ["ICU"],
    })
    assert r.status_code == 200, r.text

    r = requests.post(f"{API}/application", headers=nurse["H"], json={
        "job_id": hospA["job_id"], "hospital_name": "WF8 Hospital A",
    })
    assert r.status_code == 200, r.text
    nurse["application_id"] = r.json()["id"]

    return {"hospA": hospA, "hospB": hospB, "nurse": nurse, "nurse2": nurse2}


# --- Select gating -----------------------------------------------------------

class TestSelectGating:
    def test_select_without_interview_400(self, ctx):
        app_id = ctx["nurse"]["application_id"]
        r = requests.patch(f"{API}/application/{app_id}", headers=ctx["hospA"]["H"], json={
            "status": "selected", "joining_date": "2030-06-01",
        })
        assert r.status_code == 400, f"expected 400 without completed interview, got {r.status_code} {r.text}"

    def test_shortlist_then_schedule_then_complete_cascades(self, ctx):
        app_id = ctx["nurse"]["application_id"]
        H = ctx["hospA"]["H"]

        r = requests.patch(f"{API}/application/{app_id}", headers=H, json={"status": "shortlisted"})
        assert r.status_code == 200, r.text

        r = requests.post(f"{API}/interview", headers=H, json={
            "application_id": app_id, "scheduled_at": "2030-05-15T10:00:00Z",
            "mode": "in-person", "status": "scheduled",
        })
        assert r.status_code == 200, r.text
        iv_id = r.json()["id"]

        # move app to interview_scheduled explicitly (hospital allowed to)
        r = requests.patch(f"{API}/application/{app_id}", headers=H, json={"status": "interview_scheduled"})
        assert r.status_code == 200, r.text

        # complete the interview -> cascades application to interview_completed
        r = requests.patch(f"{API}/interview/{iv_id}", headers=H, json={"status": "completed"})
        assert r.status_code == 200, r.text

        r = requests.get(f"{API}/application/{app_id}", headers=H)
        assert r.status_code == 200
        assert r.json()["status"] == "interview_completed", r.json()

        ctx["nurse"]["interview_id"] = iv_id

    def test_select_missing_joining_date_400(self, ctx):
        app_id = ctx["nurse"]["application_id"]
        r = requests.patch(f"{API}/application/{app_id}", headers=ctx["hospA"]["H"], json={
            "status": "selected",
        })
        assert r.status_code == 400, f"expected 400 without joining_date, got {r.status_code} {r.text}"

    def test_select_ok_with_completed_interview_and_joining_date(self, ctx):
        app_id = ctx["nurse"]["application_id"]
        r = requests.patch(f"{API}/application/{app_id}", headers=ctx["hospA"]["H"], json={
            "status": "selected", "joining_date": "2030-06-01",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "selected"
        assert data["joining_date"] == "2030-06-01"

    def test_mark_joined(self, ctx):
        app_id = ctx["nurse"]["application_id"]
        r = requests.patch(f"{API}/application/{app_id}", headers=ctx["hospA"]["H"], json={"status": "joined"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "joined"


# --- Nurse withdraw / mutation ----------------------------------------------

class TestNurseMutationRules:
    def test_nurse_cannot_change_status_to_non_withdrawn(self, ctx):
        # Create a fresh application for nurse2
        # first make nurse2 have profile
        H = ctx["nurse2"]["H"]
        requests.post(f"{API}/nurse_profile", headers=H, json={
            "full_name": "N Two", "phone": "+919999999902", "city": "Delhi",
            "qualification": "GNM", "experience_years": 2, "departments": ["ICU"],
        })
        r = requests.post(f"{API}/application", headers=H, json={
            "job_id": ctx["hospA"]["job_id"], "hospital_name": "WF8 Hospital A",
        })
        assert r.status_code == 200, r.text
        ctx["nurse2"]["application_id"] = r.json()["id"]

        r = requests.patch(f"{API}/application/{ctx['nurse2']['application_id']}", headers=H, json={
            "status": "shortlisted",
        })
        assert r.status_code == 403, f"expected 403 for nurse changing status, got {r.status_code} {r.text}"

    def test_nurse_cannot_change_other_fields(self, ctx):
        H = ctx["nurse2"]["H"]
        r = requests.patch(f"{API}/application/{ctx['nurse2']['application_id']}", headers=H, json={
            "joining_date": "2030-01-01",
        })
        assert r.status_code == 403, r.text

    def test_nurse_can_withdraw(self, ctx):
        H = ctx["nurse2"]["H"]
        r = requests.patch(f"{API}/application/{ctx['nurse2']['application_id']}", headers=H, json={
            "status": "withdrawn",
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "withdrawn"


# --- Candidate documents privacy --------------------------------------------

class TestCandidateDocumentsPrivacy:
    def test_owner_hospital_can_read(self, ctx):
        # Nurse uploads a document
        r = requests.post(f"{API}/document", headers=ctx["nurse"]["H"], json={
            "name": "resume.pdf", "url": "https://example.com/resume.pdf", "type": "resume",
        })
        assert r.status_code == 200, r.text

        r = requests.get(f"{API}/candidate-documents/{ctx['nurse']['application_id']}", headers=ctx["hospA"]["H"])
        assert r.status_code == 200, r.text
        docs = r.json()
        assert isinstance(docs, list)
        assert any(d.get("name") == "resume.pdf" for d in docs)

    def test_other_hospital_forbidden(self, ctx):
        r = requests.get(f"{API}/candidate-documents/{ctx['nurse']['application_id']}", headers=ctx["hospB"]["H"])
        assert r.status_code == 403, f"expected 403 for other hospital, got {r.status_code} {r.text}"


# --- Candidate notes privacy -------------------------------------------------

class TestCandidateNotesPrivacy:
    def test_owner_hospital_post_and_get(self, ctx):
        app_id = ctx["nurse"]["application_id"]
        r = requests.post(f"{API}/candidate-notes/{app_id}", headers=ctx["hospA"]["H"], json={
            "note": "Strong ICU experience",
        })
        assert r.status_code == 200, r.text
        assert r.json().get("note") == "Strong ICU experience"

        r = requests.get(f"{API}/candidate-notes/{app_id}", headers=ctx["hospA"]["H"])
        assert r.status_code == 200
        assert r.json().get("note") == "Strong ICU experience"

    def test_other_hospital_forbidden_get_and_post(self, ctx):
        app_id = ctx["nurse"]["application_id"]
        r = requests.get(f"{API}/candidate-notes/{app_id}", headers=ctx["hospB"]["H"])
        assert r.status_code == 403, f"other hospital GET: {r.status_code} {r.text}"

        r = requests.post(f"{API}/candidate-notes/{app_id}", headers=ctx["hospB"]["H"], json={"note": "sneaky"})
        assert r.status_code == 403, f"other hospital POST: {r.status_code} {r.text}"

    def test_notes_not_returned_via_application_endpoints(self, ctx):
        # Notes live in a separate collection, so nurse GET /api/application
        # must not contain the note text.
        r = requests.get(f"{API}/application", headers=ctx["nurse"]["H"])
        assert r.status_code == 200
        payload = r.text
        assert "Strong ICU experience" not in payload, "Candidate note leaked to nurse via /api/application"

        # Also /api/application/{id}
        r = requests.get(f"{API}/application/{ctx['nurse']['application_id']}", headers=ctx["nurse"]["H"])
        assert r.status_code == 200
        assert "Strong ICU experience" not in r.text


# --- RLS regression ---------------------------------------------------------

class TestRlsRegression:
    def test_hospital_b_cannot_read_hospital_a_application(self, ctx):
        r = requests.get(f"{API}/application/{ctx['nurse']['application_id']}", headers=ctx["hospB"]["H"])
        assert r.status_code == 403, f"cross-hospital read leak: {r.status_code}"

    def test_hospital_b_cannot_patch_hospital_a_application(self, ctx):
        r = requests.patch(f"{API}/application/{ctx['nurse']['application_id']}", headers=ctx["hospB"]["H"], json={"status": "rejected"})
        assert r.status_code == 403
