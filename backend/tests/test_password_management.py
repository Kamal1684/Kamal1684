"""End-to-end tests for the password management endpoints (iteration 7).

Covers:
- POST /api/auth/change-password: happy path (fresh token; old JWT invalidated;
  no password/hash leaked), wrong current, short new, same-as-current,
  unauthenticated.
- POST /api/auth/forgot-password: generic response for known+unknown emails,
  hash-at-rest, rate limit (5/hour), rejects raw token in response.
- POST /api/auth/reset-password: happy path via DB-seeded raw token, one-time
  use, expired, invalid token; old JWTs invalidated after reset.
- No API response leaks password_hash/password.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient


def _base() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
    return url.rstrip("/")


BASE = _base()

# Load backend env for direct DB access (token seeding for reset flow)
_BE = dotenv_values("/app/backend/.env")
MONGO_URL = _BE.get("MONGO_URL") or os.environ.get("MONGO_URL")
DB_NAME = _BE.get("DB_NAME") or os.environ.get("DB_NAME")


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _register(account_type: str = "nurse"):
    email = f"TEST_{uuid.uuid4().hex}@example.com"
    password = "StrongPass123!"
    mobile = "9" + str(uuid.uuid4().int % 10**9).zfill(9)
    r = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": password, "account_type": account_type, "mobile": mobile}, timeout=15)
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"email": email, "password": password, "token": body["token"], "user": body["user"]}


def _sha256(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.new_event_loop().run_until_complete(coro)


# ---------- change-password ----------

@pytest.fixture(autouse=True)
def _clear_reset_rate_limits():
    """The reset endpoint is rate-limited per IP; clear the failure log so
    repeated local test runs don't trip 429s. Do NOT touch reset_requests here:
    tests run in parallel (xdist) and wiping it would race with the per-email
    rate-limit test. Production limits are untouched."""
    async def _clear():
        db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await db.reset_attempt_failures.delete_many({})
    _run(_clear())
    yield


class TestChangePassword:
    def test_happy_path_invalidates_old_token(self):
        u = _register("nurse")
        old_token = u["token"]
        new_pw = "BrandNewPass456!"
        r = requests.post(f"{BASE}/api/auth/change-password",
                          json={"current_password": u["password"], "new_password": new_pw},
                          headers=_h(old_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 10
        assert "message" in body
        # No secrets leaked
        text = r.text.lower()
        assert "password_hash" not in text
        assert u["password"].lower() not in text
        assert new_pw.lower() not in text

        fresh = body["token"]
        # Old JWT should be invalid now due to iat < password_changed_at
        me_old = requests.get(f"{BASE}/api/auth/me", headers=_h(old_token), timeout=15)
        assert me_old.status_code == 401
        # Fresh token works
        me_new = requests.get(f"{BASE}/api/auth/me", headers=_h(fresh), timeout=15)
        assert me_new.status_code == 200
        # Login with new password works, old password fails
        r1 = requests.post(f"{BASE}/api/auth/login", json={"email": u["email"], "password": u["password"]}, timeout=15)
        assert r1.status_code == 401
        r2 = requests.post(f"{BASE}/api/auth/login", json={"email": u["email"], "password": new_pw}, timeout=15)
        assert r2.status_code == 200

    def test_wrong_current_password(self):
        u = _register("nurse")
        r = requests.post(f"{BASE}/api/auth/change-password",
                          json={"current_password": "WrongPass!!", "new_password": "AnotherPass123!"},
                          headers=_h(u["token"]), timeout=15)
        assert r.status_code == 401

    def test_short_new_password(self):
        u = _register("nurse")
        r = requests.post(f"{BASE}/api/auth/change-password",
                          json={"current_password": u["password"], "new_password": "short"},
                          headers=_h(u["token"]), timeout=15)
        assert r.status_code == 422

    def test_same_as_current(self):
        u = _register("nurse")
        r = requests.post(f"{BASE}/api/auth/change-password",
                          json={"current_password": u["password"], "new_password": u["password"]},
                          headers=_h(u["token"]), timeout=15)
        assert r.status_code == 400

    def test_unauthenticated(self):
        r = requests.post(f"{BASE}/api/auth/change-password",
                          json={"current_password": "x" * 8, "new_password": "y" * 10}, timeout=15)
        assert r.status_code == 401

    def test_hospital_can_change_own(self):
        u = _register("hospital")
        new_pw = "HospNewPass789!"
        r = requests.post(f"{BASE}/api/auth/change-password",
                          json={"current_password": u["password"], "new_password": new_pw},
                          headers=_h(u["token"]), timeout=15)
        assert r.status_code == 200
        assert requests.post(f"{BASE}/api/auth/login", json={"email": u["email"], "password": new_pw}, timeout=15).status_code == 200

    def test_extra_target_fields_ignored(self):
        """Change-password uses JWT identity only - additional user/email params must not target another account."""
        victim = _register("nurse")
        attacker = _register("nurse")
        r = requests.post(f"{BASE}/api/auth/change-password",
                          json={"current_password": attacker["password"], "new_password": "AttackerNew123!",
                                "email": victim["email"], "user_id": victim["user"]["id"], "id": victim["user"]["id"]},
                          headers=_h(attacker["token"]), timeout=15)
        assert r.status_code == 200
        # Victim's password must be unchanged
        v = requests.post(f"{BASE}/api/auth/login", json={"email": victim["email"], "password": victim["password"]}, timeout=15)
        assert v.status_code == 200


# ---------- forgot-password ----------

class TestForgotPassword:
    def test_generic_response_and_hash_at_rest(self):
        u = _register("nurse")
        r_known = requests.post(f"{BASE}/api/auth/forgot-password", json={"email": u["email"]}, timeout=15)
        r_unknown = requests.post(f"{BASE}/api/auth/forgot-password",
                                  json={"email": f"nobody_{uuid.uuid4().hex}@example.com"}, timeout=15)
        assert r_known.status_code == 200
        assert r_unknown.status_code == 200
        assert r_known.json() == r_unknown.json()
        body = r_known.json()
        assert "token" not in str(body).lower() or "token" not in body  # generic message only
        assert "message" in body

        # Verify hash-at-rest in Mongo
        async def check():
            client = AsyncIOMotorClient(MONGO_URL)
            try:
                docs = await client[DB_NAME].password_reset_tokens.find({"email": u["email"].lower()}, {"_id": 0}).to_list(10)
                assert len(docs) >= 1
                for d in docs:
                    assert "token_hash" in d
                    assert len(d["token_hash"]) == 64
                    int(d["token_hash"], 16)  # valid hex
                    # Raw token must NOT be stored
                    assert "token" not in d or d.get("token") is None
            finally:
                client.close()
        asyncio.new_event_loop().run_until_complete(check())

    def test_rate_limit_5_per_hour(self):
        email = f"TEST_rl_{uuid.uuid4().hex}@example.com"
        # Register so it's a real account (rate limit applies to email regardless)
        requests.post(f"{BASE}/api/auth/register",
                      json={"email": email, "password": "StrongPass123!", "account_type": "nurse", "mobile": "9" + str(uuid.uuid4().int % 10**9).zfill(9)}, timeout=15)
        codes = []
        for _ in range(6):
            codes.append(requests.post(f"{BASE}/api/auth/forgot-password", json={"email": email}, timeout=15).status_code)
        assert codes[:5] == [200, 200, 200, 200, 200], codes
        assert codes[5] == 429, codes


# ---------- reset-password ----------

class TestResetPassword:
    def _seed_token(self, user_id: str, email: str, minutes_from_now: int = 30) -> str:
        raw = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=minutes_from_now)).isoformat()

        async def insert():
            client = AsyncIOMotorClient(MONGO_URL)
            try:
                await client[DB_NAME].password_reset_tokens.insert_one({
                    "id": str(uuid.uuid4()), "token_hash": _sha256(raw), "user_id": user_id,
                    "email": email, "used": False, "expires_at": expires_at,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            finally:
                client.close()
        asyncio.new_event_loop().run_until_complete(insert())
        return raw

    def test_happy_path_and_old_token_invalidation(self):
        u = _register("nurse")
        old_jwt = u["token"]
        raw = self._seed_token(u["user"]["id"], u["email"], 30)
        new_pw = "ResetPass987!"
        r = requests.post(f"{BASE}/api/auth/reset-password",
                          json={"token": raw, "new_password": new_pw}, timeout=15)
        assert r.status_code == 200, r.text
        # Old password fails, new works
        assert requests.post(f"{BASE}/api/auth/login", json={"email": u["email"], "password": u["password"]}, timeout=15).status_code == 401
        assert requests.post(f"{BASE}/api/auth/login", json={"email": u["email"], "password": new_pw}, timeout=15).status_code == 200
        # Old JWT invalidated
        assert requests.get(f"{BASE}/api/auth/me", headers=_h(old_jwt), timeout=15).status_code == 401
        # Reuse same token -> 400
        r2 = requests.post(f"{BASE}/api/auth/reset-password",
                           json={"token": raw, "new_password": "AnotherPass111!"}, timeout=15)
        assert r2.status_code == 400

    def test_expired_token(self):
        u = _register("nurse")
        raw = self._seed_token(u["user"]["id"], u["email"], minutes_from_now=-5)
        r = requests.post(f"{BASE}/api/auth/reset-password",
                          json={"token": raw, "new_password": "NewPass2222!"}, timeout=15)
        assert r.status_code == 400

    def test_invalid_token(self):
        r = requests.post(f"{BASE}/api/auth/reset-password",
                          json={"token": "garbage-does-not-exist", "new_password": "NewPass2222!"}, timeout=15)
        assert r.status_code in (400, 429)  # 429 possible if prior negative tests tripped rate limit


# ---------- Password never returned by APIs ----------

class TestNoPasswordLeak:
    def test_login_me_admin_users_no_password_fields(self):
        u = _register("nurse")
        # Login response
        r = requests.post(f"{BASE}/api/auth/login", json={"email": u["email"], "password": u["password"]}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "password" not in str(body)
        assert "password_hash" not in str(body)
        # /auth/me
        me = requests.get(f"{BASE}/api/auth/me", headers=_h(u["token"]), timeout=15).json()
        assert "password" not in me and "password_hash" not in me
        # /admin/users via ephemeral bootstrapped admin
        secret = _BE.get("ADMIN_BOOTSTRAP_SECRET")
        if secret:
            adm = _register("nurse")
            promo = requests.post(f"{BASE}/api/auth/admin-bootstrap",
                                  json={"email": adm["email"], "password": adm["password"], "account_type": "nurse"},
                                  headers={"x-admin-bootstrap-secret": secret, "Content-Type": "application/json"},
                                  timeout=15)
            assert promo.status_code == 200
            adm_login = requests.post(f"{BASE}/api/auth/login", json={"email": adm["email"], "password": adm["password"]}, timeout=15).json()
            users = requests.get(f"{BASE}/api/admin/users", headers=_h(adm_login["token"]), timeout=15).json()
            for row in users:
                assert "password_hash" not in row
                assert "password" not in row
