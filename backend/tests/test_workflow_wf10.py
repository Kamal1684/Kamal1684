"""WF10 - Admin stats endpoint, admin edit, selected/joined report data.

Focuses on the new /api/admin/stats identity guarantee and admin PATCH access
for nurse_profile and hospital resources. Uses wf10_ email prefix for created
test data so leftovers can be purged.
"""
import os
import random
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@nurseconnect-platform.com"
ADMIN_PASSWORD = "AdminPass123!"


def _mobile():
    return "9" + "".join(str(random.randint(0, 9)) for _ in range(9))


def _register(account_type: str):
    email = f"wf10_{uuid.uuid4().hex[:10]}@example.com"
    password = "StrongPass123!"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "account_type": account_type, "mobile": _mobile()},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    lr = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert lr.status_code == 200, lr.text
    body = lr.json()
    return {"email": email, "password": password, "id": body["user"]["id"], "token": body["token"]}


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    if r.status_code != 200 or not r.json().get("user", {}).get("is_admin"):
        pytest.skip("Admin credentials unavailable")
    return r.json()["token"]


# ---------------- /admin/stats ----------------

class TestAdminStats:
    def test_requires_auth(self):
        r = requests.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 401

    def test_forbids_non_admin(self):
        nurse = _register("nurse")
        r = requests.get(f"{API}/admin/stats", headers=_headers(nurse["token"]), timeout=15)
        assert r.status_code == 403

    def test_identity_and_shape(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        s = r.json()
        for k in [
            "total_nurses", "verified_nurses", "pending_nurses",
            "total_hospitals", "verified_hospitals", "pending_hospitals",
            "total_jobs", "active_jobs", "pending_jobs",
            "total_applications", "selected", "joined",
        ]:
            assert k in s, f"missing {k}"
            assert isinstance(s[k], int)
        # Core identity guaranteed by server
        assert s["total_nurses"] == s["verified_nurses"] + s["pending_nurses"]
        assert s["total_hospitals"] == s["verified_hospitals"] + s["pending_hospitals"]

    def test_counts_move_when_nurse_registers(self, admin_token):
        before = requests.get(f"{API}/admin/stats", headers=_headers(admin_token), timeout=15).json()
        _register("nurse")
        after = requests.get(f"{API}/admin/stats", headers=_headers(admin_token), timeout=15).json()
        # >=1 accounts for parallel workers registering nurses concurrently
        assert after["total_nurses"] >= before["total_nurses"] + 1
        # Identity still holds after the change
        assert after["total_nurses"] == after["verified_nurses"] + after["pending_nurses"]


# ---------------- Admin edit access ----------------

class TestAdminEdit:
    def test_admin_can_patch_nurse_profile(self, admin_token):
        nurse = _register("nurse")
        cr = requests.post(f"{API}/nurse_profile", headers=_headers(nurse["token"]),
                           json={"full_name": "wf10 Original", "phone": nurse["email"]}, timeout=15)
        assert cr.status_code == 200, cr.text
        pid = cr.json()["id"]

        pr = requests.patch(f"{API}/nurse_profile/{pid}", headers=_headers(admin_token),
                            json={"full_name": "wf10 Edited By Admin"}, timeout=15)
        assert pr.status_code == 200, pr.text
        assert pr.json()["full_name"] == "wf10 Edited By Admin"

        # Persistence check via nurse's own GET
        gr = requests.get(f"{API}/nurse_profile/{pid}", headers=_headers(nurse["token"]), timeout=15)
        assert gr.status_code == 200
        assert gr.json()["full_name"] == "wf10 Edited By Admin"

    def test_admin_can_patch_hospital(self, admin_token):
        hosp = _register("hospital")
        cr = requests.post(f"{API}/hospital", headers=_headers(hosp["token"]),
                           json={"name": "wf10 Original Hospital", "city": "Delhi"}, timeout=15)
        assert cr.status_code == 200, cr.text
        hid = cr.json()["id"]

        pr = requests.patch(f"{API}/hospital/{hid}", headers=_headers(admin_token),
                            json={"name": "wf10 Renamed Hospital", "address": "1 wf10 lane"}, timeout=15)
        assert pr.status_code == 200, pr.text
        body = pr.json()
        assert body["name"] == "wf10 Renamed Hospital"
        assert body["address"] == "1 wf10 lane"

        gr = requests.get(f"{API}/hospital/{hid}", headers=_headers(hosp["token"]), timeout=15)
        assert gr.status_code == 200
        assert gr.json()["name"] == "wf10 Renamed Hospital"

    def test_admin_verification_reflects_in_stats(self, admin_token):
        # Approve a fresh nurse's profile; verified_nurses should go up by 1
        nurse = _register("nurse")
        cr = requests.post(f"{API}/nurse_profile", headers=_headers(nurse["token"]),
                           json={"full_name": "wf10 stats", "phone": "+919999999990"}, timeout=15)
        pid = cr.json()["id"]

        before = requests.get(f"{API}/admin/stats", headers=_headers(admin_token), timeout=15).json()
        pr = requests.patch(f"{API}/nurse_profile/{pid}", headers=_headers(admin_token),
                            json={"verification_status": "verified"}, timeout=15)
        assert pr.status_code == 200, pr.text
        after = requests.get(f"{API}/admin/stats", headers=_headers(admin_token), timeout=15).json()
        assert after["verified_nurses"] == before["verified_nurses"] + 1
        # pending should drop or stay flat depending on whether nurse existed already
        assert after["total_nurses"] == after["verified_nurses"] + after["pending_nurses"]


# ---------------- Selected/Joined report data source ----------------

class TestSelectedJoinedReport:
    def test_report_data_via_admin_application_list(self, admin_token):
        # Admin sees all applications and hospitals; the frontend joins them.
        apps = requests.get(f"{API}/application", headers=_headers(admin_token), timeout=15)
        assert apps.status_code == 200
        hosps = requests.get(f"{API}/hospital", headers=_headers(admin_token), timeout=15)
        assert hosps.status_code == 200
        # Every selected/joined app must reference an existing job (admin can see all jobs too)
        jobs = requests.get(f"{API}/job", headers=_headers(admin_token), timeout=15)
        assert jobs.status_code == 200
        job_ids = {j["id"] for j in jobs.json()}
        for a in apps.json():
            if a.get("status") in ("selected", "joined"):
                assert a.get("job_id") in job_ids, "selected/joined app must map to a known job"
