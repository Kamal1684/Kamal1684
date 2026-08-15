"""Comprehensive live RLS security tests for NurseConnect.

Covers every private entity (Profile, NurseProfile, Hospital, Job, Application,
SavedJob, Interview, Document) and confirms owner isolation across two nurses
(A, B), two hospitals (H1, H2), plus positive admin overrides via the
ADMIN_BOOTSTRAP_SECRET header.
"""
from __future__ import annotations

import os
import uuid

import requests
from dotenv import dotenv_values


def _base_url() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
    return url.rstrip("/")


def _admin_secret() -> str:
    return dotenv_values("/app/backend/.env")["ADMIN_BOOTSTRAP_SECRET"].strip('"')


BASE = _base_url()
ADMIN_SECRET = _admin_secret()


def _post(path: str, token: str | None = None, **kwargs):
    headers = kwargs.pop("headers", {}) or {}
    headers.setdefault("Content-Type", "application/json")
    if token:
        headers["Authorization"] = "Bearer " + token
    return requests.post(BASE + path, headers=headers, timeout=15, **kwargs)


def _get(path: str, token: str | None = None):
    headers = {"Authorization": "Bearer " + token} if token else {}
    return requests.get(BASE + path, headers=headers, timeout=15)


def _patch(path: str, token: str, body: dict):
    return requests.patch(BASE + path, json=body, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"}, timeout=15)


def _delete(path: str, token: str):
    return requests.delete(BASE + path, headers={"Authorization": "Bearer " + token}, timeout=15)


def _new_account(account_type: str) -> tuple[str, str, str, str]:
    """Return (token, user_id, email, password)."""
    email = f"TEST_{uuid.uuid4().hex}@example.com"
    password = "StrongPass123!"
    mobile = "9" + str(uuid.uuid4().int % 10**9).zfill(9)
    r = _post("/api/auth/register", json={"email": email, "password": password, "account_type": account_type, "mobile": mobile})
    assert r.status_code == 200, f"register {account_type} failed: {r.status_code} {r.text}"
    login = _post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    body = login.json()
    return body["token"], body["user"]["id"], email, password


def _bootstrap_admin() -> str:
    """Create a fresh admin using the server-side secret and return its token."""
    email = f"ADMIN_{uuid.uuid4().hex}@example.com"
    password = "AdminStrong123!"
    mobile = "9" + str(uuid.uuid4().int % 10**9).zfill(9)
    r = _post("/api/auth/register", json={"email": email, "password": password, "account_type": "hospital", "mobile": mobile})
    assert r.status_code == 200, r.text
    r = _post("/api/auth/admin-bootstrap", json={"email": email, "password": password, "account_type": "hospital"}, headers={"x-admin-bootstrap-secret": ADMIN_SECRET})
    assert r.status_code == 200, r.text
    login = _post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200 and login.json()["user"]["is_admin"] is True
    return login.json()["token"]


def test_admin_bootstrap_rejects_without_secret():
    email = f"NOADMIN_{uuid.uuid4().hex}@example.com"
    password = "TryAdmin123!"
    _post("/api/auth/register", json={"email": email, "password": password, "account_type": "nurse", "mobile": "9" + str(uuid.uuid4().int % 10**9).zfill(9)})
    # Missing secret header
    r = _post("/api/auth/admin-bootstrap", json={"email": email, "password": password, "account_type": "nurse"})
    assert r.status_code == 403
    # Wrong secret
    r = _post("/api/auth/admin-bootstrap", json={"email": email, "password": password, "account_type": "nurse"}, headers={"x-admin-bootstrap-secret": "wrong"})
    assert r.status_code == 403
    # Client-supplied is_admin in register payload must be ignored
    login = _post("/api/auth/login", json={"email": email, "password": password}).json()
    assert login["user"]["is_admin"] is False


def test_register_rejects_admin_account_type():
    r = _post("/api/auth/register", json={"email": f"X_{uuid.uuid4().hex}@example.com", "password": "StrongPass123!", "account_type": "admin", "mobile": "9" + str(uuid.uuid4().int % 10**9).zfill(9)})
    assert r.status_code == 400


def test_generic_resource_allowlist():
    tok, _, _, _ = _new_account("nurse")
    for bad in ("users", "user", "secrets", "config"):
        assert _get(f"/api/{bad}", tok).status_code in (404,), bad
        assert _get(f"/api/{bad}/anything", tok).status_code in (404,), bad
        assert _patch(f"/api/{bad}/anything", tok, {"x": 1}).status_code in (404,), bad
        assert _delete(f"/api/{bad}/anything", tok).status_code in (404, 405), bad


def test_unauthenticated_requires_token():
    for path in ("/api/profile", "/api/nurse_profile", "/api/hospital", "/api/job", "/api/application", "/api/saved_job", "/api/interview", "/api/document"):
        assert _get(path).status_code == 401, path


def test_profile_ownership_isolation():
    a, aid, _, _ = _new_account("nurse")
    b, bid, _, _ = _new_account("nurse")
    prof_a = _post("/api/profile", a, json={"name": "Nurse A"}).json()
    prof_b = _post("/api/profile", b, json={"name": "Nurse B"}).json()
    # Own read/update
    assert _get(f"/api/profile/{prof_a['id']}", a).status_code == 200
    assert _patch(f"/api/profile/{prof_a['id']}", a, {"name": "Nurse A2"}).status_code == 200
    # Cross access blocked
    assert _get(f"/api/profile/{prof_b['id']}", a).status_code == 403
    assert _patch(f"/api/profile/{prof_b['id']}", a, {"name": "hijack"}).status_code == 403
    # List scoping: A only sees own
    listed = _get("/api/profile", a).json()
    assert all(item.get("user_id") == aid for item in listed)


def test_nurse_profile_and_saved_job_isolation():
    a, _, _, _ = _new_account("nurse")
    b, _, _, _ = _new_account("nurse")
    np_a = _post("/api/nurse_profile", a, json={"summary": "A"}).json()
    np_b = _post("/api/nurse_profile", b, json={"summary": "B"}).json()
    assert _patch(f"/api/nurse_profile/{np_b['id']}", a, {"summary": "hijack"}).status_code == 403
    assert _get(f"/api/nurse_profile/{np_b['id']}", a).status_code == 403
    sj_a = _post("/api/saved_job", a, json={"job_id": "any"}).json()
    assert _delete(f"/api/saved_job/{sj_a['id']}", b).status_code == 403
    assert _delete(f"/api/saved_job/{sj_a['id']}", a).status_code == 200


def test_hospital_and_job_isolation_full_flow():
    h1, h1id, _, _ = _new_account("hospital")
    h2, h2id, _, _ = _new_account("hospital")
    nurse_a, na_id, _, _ = _new_account("nurse")
    nurse_b, nb_id, _, _ = _new_account("nurse")

    hosp1 = _post("/api/hospital", h1, json={"name": "H1"}).json()
    hosp2 = _post("/api/hospital", h2, json={"name": "H2"}).json()
    # Cross-hospital modification blocked
    assert _patch(f"/api/hospital/{hosp2['id']}", h1, {"name": "hijack"}).status_code == 403

    # Nurse cannot create a job
    assert _post("/api/job", nurse_a, json={"title": "x"}).status_code == 403
    # Hospital creates a job (initially not active/published)
    job1 = _post("/api/job", h1, json={"title": "J1", "published": True, "approved": True, "status": "active"}).json()
    job2 = _post("/api/job", h2, json={"title": "J2", "published": True, "approved": True, "status": "active"}).json()

    # H1 cannot modify H2 job
    assert _patch(f"/api/job/{job2['id']}", h1, {"title": "hijack"}).status_code == 403
    # Nurse cannot modify job
    assert _patch(f"/api/job/{job1['id']}", nurse_a, {"title": "hijack"}).status_code == 403
    # Nurse reads only if active/published (via id)
    r = _get(f"/api/job/{job1['id']}", nurse_a)
    assert r.status_code == 200
    # Public jobs list works unauthenticated
    assert _get("/api/public/jobs").status_code == 200

    # Applications: nurse A applies to job1 (H1)
    app_a = _post("/api/application", nurse_a, json={"job_id": job1["id"]})
    assert app_a.status_code == 200, app_a.text
    app_a = app_a.json()
    # Nurse B applies to job1 too
    app_b = _post("/api/application", nurse_b, json={"job_id": job1["id"]}).json()

    # Nurse A cannot see B's application
    assert _get(f"/api/application/{app_b['id']}", nurse_a).status_code == 403
    # Nurse A cannot flip own status
    r = _patch(f"/api/application/{app_a['id']}", nurse_a, {"status": "shortlisted"})
    assert r.status_code == 403
    # Hospital H1 owns the job -> can read+patch status
    assert _get(f"/api/application/{app_a['id']}", h1).status_code == 200
    assert _patch(f"/api/application/{app_a['id']}", h1, {"status": "shortlisted"}).status_code == 200
    # Hospital H2 cannot read or modify H1's job applications
    assert _get(f"/api/application/{app_a['id']}", h2).status_code == 403
    assert _patch(f"/api/application/{app_a['id']}", h2, {"status": "rejected"}).status_code == 403

    # Interviews: hospital H1 creates interview for app_a
    intv = _post("/api/interview", h1, json={"application_id": app_a["id"], "when": "2026-02-01"})
    assert intv.status_code == 200, intv.text
    intv = intv.json()
    # Nurse A (applicant) can read
    assert _get(f"/api/interview/{intv['id']}", nurse_a).status_code == 200
    # Nurse B cannot read
    assert _get(f"/api/interview/{intv['id']}", nurse_b).status_code == 403
    # Hospital H2 cannot manage
    assert _patch(f"/api/interview/{intv['id']}", h2, {"when": "2026-03-01"}).status_code == 403
    # Nurse cannot create interview
    assert _post("/api/interview", nurse_a, json={"application_id": app_a["id"]}).status_code == 403


def test_document_privacy():
    a, _, _, _ = _new_account("nurse")
    b, _, _, _ = _new_account("nurse")
    doc = _post("/api/document", a, json={"kind": "id_proof", "url": "secret://x"}).json()
    # Cross-nurse cannot read/delete
    assert _get(f"/api/document/{doc['id']}", b).status_code == 403
    assert _delete(f"/api/document/{doc['id']}", b).status_code == 403
    # Owner can read + delete
    assert _get(f"/api/document/{doc['id']}", a).status_code == 200
    assert _delete(f"/api/document/{doc['id']}", a).status_code == 200


def test_admin_can_access_and_manage_everything():
    admin = _bootstrap_admin()
    nurse, nid, _, _ = _new_account("nurse")
    hosp, hid, _, _ = _new_account("hospital")
    prof = _post("/api/profile", nurse, json={"name": "N"}).json()
    hosp_rec = _post("/api/hospital", hosp, json={"name": "HX"}).json()
    job = _post("/api/job", hosp, json={"title": "J", "published": True, "approved": True, "status": "active"}).json()
    application = _post("/api/application", nurse, json={"job_id": job["id"]}).json()

    # Admin GET each entity by id
    for path in (f"/api/profile/{prof['id']}", f"/api/hospital/{hosp_rec['id']}", f"/api/job/{job['id']}", f"/api/application/{application['id']}"):
        assert _get(path, admin).status_code == 200, path
    # Admin list returns all rows (no ownership scoping)
    assert len(_get("/api/profile", admin).json()) >= 1
    # Admin can update application status, verify nurse, etc.
    assert _patch(f"/api/application/{application['id']}", admin, {"status": "verified"}).status_code == 200
    assert _patch(f"/api/hospital/{hosp_rec['id']}", admin, {"verified": True}).status_code == 200


def test_immutable_ownership_fields_on_patch():
    a, aid, _, _ = _new_account("nurse")
    b, bid, _, _ = _new_account("nurse")
    prof = _post("/api/profile", a, json={"name": "A"}).json()
    # Attempt to reassign user_id via PATCH should silently drop the field
    r = _patch(f"/api/profile/{prof['id']}", a, {"user_id": bid, "name": "A2"})
    assert r.status_code == 200
    latest = _get(f"/api/profile/{prof['id']}", a).json()
    assert latest["user_id"] == aid
