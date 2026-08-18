"""NurseConnect API with server-side ownership and role authorization.

The client never supplies an authority claim: admin access is read only from the
server-side users collection's is_admin flag.
"""
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional
import hashlib
import logging
import os
import re
import secrets
import time
import uuid

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
jwt_secret = os.environ["JWT_SECRET"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI(title="NurseConnect Security API")
api = APIRouter(prefix="/api")
JWT_ALGORITHM = "HS256"
TOKEN_MINUTES = 60
PRIVATE = {"profile", "nurse_profile", "hospital", "application", "saved_job", "interview", "document"}
ALLOWED_RESOURCES = PRIVATE | {"job"}

def collection_name(resource: str) -> str:
    return resource + "s"

def validate_resource(resource: str) -> None:
    if resource not in ALLOWED_RESOURCES:
        raise HTTPException(status_code=404, detail="Unknown resource")


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    account_type: str = "nurse"


class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    account_type: str = "nurse"
    mobile: str


def normalize_indian_mobile(raw: str) -> str:
    """Validate & normalize an Indian (+91) mobile number to '+91XXXXXXXXXX'.
    Raises HTTPException(400) with a clear message on invalid input."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("0091"):
        digits = digits[4:]
    elif len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise HTTPException(status_code=400, detail="Enter a valid Indian mobile number: 10 digits starting 6-9 (optionally prefixed with +91).")
    return "+91" + digits



class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ForgotPasswordInput(BaseModel):
    email: EmailStr


class ResetPasswordInput(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class ProfileInput(BaseModel):
    model_config = ConfigDict(extra="allow")

class StatusInput(BaseModel):
    client_name: str


def clean(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def current_user(request: Request) -> Dict[str, Any]:
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        claims = jwt.decode(header[7:], jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc
    user = await db.users.find_one({"id": claims.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    changed_at = user.get("password_changed_at")
    if changed_at and claims.get("iat", 0) < changed_at:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    return user


def issue_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "iat": time.time(), "exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES)},
        jwt_secret, algorithm=JWT_ALGORITHM,
    )


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def require_admin(user: Dict[str, Any]) -> None:
    if user.get("is_admin") is not True:
        raise HTTPException(status_code=403, detail="Administrator access required")


def hospital_key(user: Dict[str, Any]) -> str:
    """The identifier a hospital account uses to own jobs/records."""
    return user.get("hospital_id") or user["id"]


async def get_owned(resource: str, item_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    doc = clean(await db[collection_name(resource)].find_one({"id": item_id}))
    if not doc:
        raise HTTPException(status_code=404, detail=f"{resource} not found")
    if user.get("is_admin") is True:
        return doc
    if resource == "profile" and doc.get("user_id") == user["id"]:
        return doc
    if resource in {"nurse_profile", "hospital", "saved_job", "document"} and doc.get("owner_id") == user["id"]:
        return doc
    if resource == "job" and doc.get("hospital_id") == hospital_key(user):
        return doc
    raise HTTPException(status_code=403, detail="You are not allowed to access this record")


async def job_for_hospital(job_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user.get("is_admin") is not True and job.get("hospital_id") != hospital_key(user):
        raise HTTPException(status_code=403, detail="This job belongs to another hospital")
    return job


ALERT_MATCH_THRESHOLD = 75

def _norm(v: Any) -> str:
    return str(v or "").strip().lower()


def is_job_live(job: Dict[str, Any]) -> bool:
    return job.get("published") is True and job.get("approved") is True and job.get("status") == "active"


def compute_match_score(nurse: Dict[str, Any], job: Dict[str, Any]) -> Optional[int]:
    """Rule-based match mirroring the frontend algorithm (weights: dept 25,
    location 20, experience 20, shift 15, qualification 10, salary 10)."""
    checks = []
    if job.get("department"):
        deps = [_norm(d) for d in (nurse.get("departments") or [])]
        checks.append((25, _norm(job["department"]) in deps))
    if job.get("location"):
        locs = [x for x in (_norm(nurse.get("preferred_location")), _norm(nurse.get("city"))) if x]
        jl = _norm(job["location"])
        checks.append((20, any(jl in loc or loc in jl for loc in locs)))
    if job.get("shift"):
        s = _norm(nurse.get("preferred_shift"))
        checks.append((15, bool(s) and (s == _norm(job["shift"]) or s == "flexible" or _norm(job["shift"]) == "flexible")))
    if job.get("experience_required") not in (None, ""):
        try:
            required = float(job["experience_required"])
        except (TypeError, ValueError):
            required = 0.0
        try:
            years = float(nurse.get("experience_years") or 0)
        except (TypeError, ValueError):
            years = 0.0
        checks.append((20, years >= required))
    if job.get("qualification_required"):
        nq, jq = _norm(nurse.get("qualification")), _norm(job["qualification_required"])
        checks.append((10, nq in jq or jq in nq))
    if job.get("salary_max"):
        try:
            matched = not nurse.get("expected_salary") or float(job["salary_max"]) >= float(nurse["expected_salary"])
        except (TypeError, ValueError):
            matched = True
        checks.append((10, matched))
    total = sum(w for w, _ in checks)
    if not total:
        return None
    return round(sum(w for w, m in checks if m) / total * 100)


async def generate_job_alerts(job: Dict[str, Any]) -> None:
    """Create in-app alerts for nurses whose profile matches a newly live job above the threshold."""
    if not is_job_live(job):
        return
    now = datetime.now(timezone.utc).isoformat()
    async for profile in db.nurse_profiles.find({}, {"_id": 0}):
        nurse_id = profile.get("owner_id")
        if not nurse_id:
            continue
        score = compute_match_score(profile, job)
        if score is None or score <= ALERT_MATCH_THRESHOLD:
            continue
        if await db.job_alerts.find_one({"nurse_id": nurse_id, "job_id": job["id"]}):
            continue
        await db.job_alerts.insert_one({
            "id": str(uuid.uuid4()), "nurse_id": nurse_id, "job_id": job["id"],
            "job_title": job.get("title"), "hospital_name": job.get("hospital_name"),
            "department": job.get("department"), "location": job.get("location"),
            "match_score": score, "read": False, "created_at": now,
        })



@api.post("/auth/register")
async def register(body: RegisterInput):
    if body.account_type not in {"nurse", "hospital"}:
        raise HTTPException(400, "account_type must be nurse or hospital")
    mobile = normalize_indian_mobile(body.mobile)
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(409, "Email already registered")
    if await db.users.find_one({"mobile": mobile}):
        raise HTTPException(409, "Mobile number already registered")
    user = {"id": str(uuid.uuid4()), "email": body.email.lower(), "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(), "account_type": body.account_type, "mobile": mobile, "mobile_verified": False, "is_admin": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    return {"id": user["id"], "email": user["email"], "account_type": user["account_type"], "mobile": user["mobile"], "mobile_verified": user["mobile_verified"]}


@api.post("/auth/admin-bootstrap")
async def admin_bootstrap(body: Credentials, request: Request):
    """Promote a user to admin only when the request carries the server-only
    ADMIN_BOOTSTRAP_SECRET. Never trust client-supplied role fields."""
    secret = os.environ.get("ADMIN_BOOTSTRAP_SECRET")
    provided = request.headers.get("x-admin-bootstrap-secret")
    if not secret or provided != secret:
        raise HTTPException(status_code=403, detail="Administrator provisioning is not authorized")
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_admin": True}})
    return {"id": user["id"], "is_admin": True}


@api.post("/auth/login")
async def login(body: Credentials):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Invalid credentials")
    token = issue_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "account_type": user["account_type"], "is_admin": user.get("is_admin") is True, "mobile": user.get("mobile"), "mobile_verified": user.get("mobile_verified") is True}}


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordInput, user=Depends(current_user)):
    """Authenticated users change ONLY their own password. Old sessions are invalidated."""
    record = await db.users.find_one({"id": user["id"]})
    if not record or not bcrypt.checkpw(body.current_password.encode(), record["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password")
    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": new_hash, "password_changed_at": time.time()}})
    return {"message": "Password changed successfully", "token": issue_token(user["id"])}


RESET_TOKEN_MINUTES = 30
RESET_REQUESTS_PER_HOUR = 5
RESET_FAILED_ATTEMPT_LIMIT = 10


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordInput):
    """Always responds generically so account existence is never revealed."""
    email = body.email.lower()
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = await db.reset_requests.count_documents({"email": email, "created_at": {"$gte": hour_ago.isoformat()}})
    if recent >= RESET_REQUESTS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many reset requests. Please try again later.")
    await db.reset_requests.insert_one({"email": email, "created_at": datetime.now(timezone.utc).isoformat()})
    user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "id": str(uuid.uuid4()), "token_hash": hash_reset_token(token), "user_id": user["id"],
            "email": email, "used": False,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_MINUTES)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        email_sent = await deliver_reset_email(email, token)
        if not email_sent:
            logging.getLogger(__name__).warning("Password reset requested but no email provider is configured; token stored hashed and undeliverable.")
    return {"message": "If an account exists for that email, password reset instructions have been sent."}


async def deliver_reset_email(email: str, token: str) -> bool:
    """Send the reset link via the configured email provider. Never log the token."""
    if not os.environ.get("RESEND_API_KEY"):
        return False
    try:
        import resend
        resend.api_key = os.environ["RESEND_API_KEY"]
        frontend = os.environ.get("FRONTEND_URL", "")
        resend.Emails.send({
            "from": os.environ.get("RESET_EMAIL_FROM", "NurseConnect <onboarding@resend.dev>"),
            "to": [email],
            "subject": "Reset your NurseConnect password",
            "html": f"<p>Click the link below to reset your NurseConnect password. It expires in {RESET_TOKEN_MINUTES} minutes.</p>"
                    f"<p><a href=\"{frontend}/reset-password?token={token}\">Reset password</a></p>"
                    f"<p>If you did not request this, you can ignore this email.</p>",
        })
        return True
    except Exception:
        logging.getLogger(__name__).exception("Failed to send password reset email")
        return False


@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordInput, request: Request):
    ip = request.client.host if request.client else "unknown"
    win_start = datetime.now(timezone.utc) - timedelta(minutes=15)
    fails = await db.reset_attempt_failures.count_documents({"ip": ip, "created_at": {"$gte": win_start.isoformat()}})
    if fails >= RESET_FAILED_ATTEMPT_LIMIT:
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
    record = await db.password_reset_tokens.find_one({"token_hash": hash_reset_token(body.token)})
    now_iso = datetime.now(timezone.utc).isoformat()
    if not record or record.get("used") or record.get("expires_at", "") < now_iso:
        await db.reset_attempt_failures.insert_one({"ip": ip, "created_at": now_iso})
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.users.update_one({"id": record["user_id"]}, {"$set": {"password_hash": new_hash, "password_changed_at": time.time()}})
    await db.password_reset_tokens.update_one({"id": record["id"]}, {"$set": {"used": True, "used_at": now_iso}})
    return {"message": "Password has been reset. You can now log in with your new password."}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return {"id": user["id"], "email": user["email"], "account_type": user["account_type"], "is_admin": user.get("is_admin") is True, "mobile": user.get("mobile"), "mobile_verified": user.get("mobile_verified") is True}


@api.get("/status")
async def status_check():
    return {"status": "ok"}


@api.post("/status")
async def create_status_check(body: StatusInput):
    return {"id": str(uuid.uuid4()), "client_name": body.client_name, "timestamp": datetime.now(timezone.utc).isoformat()}


@api.get("/public/jobs")
async def public_jobs():
    return await db.jobs.find({"published": True, "approved": True, "status": "active"}, {"_id": 0, "hospital_id": 0}).to_list(1000)


@api.get("/public/hospitals")
async def public_hospitals():
    return await db.hospitals.find({"public": True}, {"_id": 0, "owner_id": 0}).to_list(1000)


@api.get("/recruitment/nurses")
async def recruitment_nurses(user=Depends(current_user)):
    if user.get("account_type") != "hospital" and user.get("is_admin") is not True:
        raise HTTPException(403, "Only hospitals can access recruitment profiles")
    fields = {"_id": 0, "owner_id": 0, "user_id": 0, "documents": 0, "id_proof": 0, "registration_certificate": 0}
    return await db.nurse_profiles.find({"recruitment_visible": True}, fields).to_list(1000)


@api.get("/alerts")
async def list_alerts(user=Depends(current_user)):
    query = {} if user.get("is_admin") is True else {"nurse_id": user["id"]}
    return await db.job_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/admin/users")
async def admin_users(user=Depends(current_user)):
    if user.get("is_admin") is not True:
        raise HTTPException(403, "Admin access required")
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(5000)


@api.post("/alerts/mark-read")
async def mark_alerts_read(user=Depends(current_user)):
    result = await db.job_alerts.update_many({"nurse_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"updated": result.modified_count}


@api.get("/candidate-documents/{application_id}")
async def candidate_documents(application_id: str, user=Depends(current_user)):
    """A hospital may view documents of nurses who applied to its own jobs."""
    appdoc = await db.applications.find_one({"id": application_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    if user.get("is_admin") is not True:
        await job_for_hospital(appdoc["job_id"], user)
    return await db.documents.find({"owner_id": appdoc["nurse_id"]}, {"_id": 0}).to_list(100)


@api.get("/candidate-notes/{application_id}")
async def get_candidate_notes(application_id: str, user=Depends(current_user)):
    appdoc = await db.applications.find_one({"id": application_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    if user.get("is_admin") is not True:
        await job_for_hospital(appdoc["job_id"], user)
    note = await db.candidate_notes.find_one({"application_id": application_id}, {"_id": 0})
    return note or {"application_id": application_id, "note": ""}


@api.post("/candidate-notes/{application_id}")
async def set_candidate_notes(application_id: str, body: ProfileInput, user=Depends(current_user)):
    appdoc = await db.applications.find_one({"id": application_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    if user.get("is_admin") is not True:
        await job_for_hospital(appdoc["job_id"], user)
    note = (body.model_dump() or {}).get("note", "")
    await db.candidate_notes.update_one(
        {"application_id": application_id},
        {"$set": {"application_id": application_id, "hospital_id": hospital_key(user), "note": note, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"application_id": application_id, "note": note}



@api.get("/{resource}")
async def list_resource(resource: str, user=Depends(current_user)):
    if resource not in PRIVATE and resource != "job":
        raise HTTPException(404, "Unknown resource")
    if user.get("is_admin") is True:
        query = {}
    elif resource == "profile": query = {"user_id": user["id"]}
    elif resource in {"nurse_profile", "hospital", "saved_job", "document"}: query = {"owner_id": user["id"]}
    elif resource == "job": query = {"hospital_id": hospital_key(user)}
    elif resource == "application":
        if user.get("account_type") == "nurse": query = {"nurse_id": user["id"]}
        else:
            owned = await db.jobs.find({"hospital_id": hospital_key(user)}, {"_id": 0, "id": 1}).to_list(1000)
            query = {"job_id": {"$in": [x["id"] for x in owned]}}
    elif resource == "interview":
        if user.get("account_type") == "nurse":
            apps = await db.applications.find({"nurse_id": user["id"]}, {"_id": 0, "id": 1}).to_list(1000)
            query = {"application_id": {"$in": [x["id"] for x in apps]}}
        else:
            jobs = await db.jobs.find({"hospital_id": hospital_key(user)}, {"_id": 0, "id": 1}).to_list(1000)
            apps = await db.applications.find({"job_id": {"$in": [x["id"] for x in jobs]}}, {"_id": 0, "id": 1}).to_list(1000)
            query = {"application_id": {"$in": [x["id"] for x in apps]}}
    return await db[collection_name(resource)].find(query, {"_id": 0}).to_list(1000)


@api.post("/{resource}")
async def create(resource: str, body: ProfileInput, user=Depends(current_user)):
    if resource not in PRIVATE and resource != "job":
        raise HTTPException(404, "Unknown resource")
    data = body.model_dump()
    if resource == "profile": data["user_id"] = user["id"]
    elif resource in {"nurse_profile", "hospital", "saved_job", "document"}:
        data["owner_id"] = user["id"]
        if resource in {"nurse_profile", "hospital"} and user.get("is_admin") is not True:
            data.pop("verification_status", None)
            data.pop("rejection_reason", None)
            data["verification_status"] = "pending"
    elif resource == "job":
        if user.get("account_type") != "hospital" and user.get("is_admin") is not True: raise HTTPException(403, "Only hospitals can create jobs")
        data["hospital_id"] = hospital_key(user)
        if user.get("is_admin") is not True:
            hosp = await db.hospitals.find_one({"owner_id": user["id"]}, {"_id": 0, "verification_status": 1})
            data["hospital_verified"] = bool(hosp and hosp.get("verification_status") == "verified")
    elif resource == "application":
        if user.get("account_type") != "nurse" and user.get("is_admin") is not True: raise HTTPException(403, "Only nurses can apply")
        data["nurse_id"] = user["id"]
        data.setdefault("status", "submitted")
        job = await db.jobs.find_one({"id": data.get("job_id"), "published": True, "approved": True, "status": "active"})
        if not job: raise HTTPException(403, "Applications are only allowed for active published jobs")
        if await db.applications.find_one({"nurse_id": user["id"], "job_id": data.get("job_id")}):
            raise HTTPException(409, "You have already applied to this job")
    elif resource == "interview":
        if user.get("account_type") != "hospital" and user.get("is_admin") is not True: raise HTTPException(403, "Only the job owner can create interviews")
        application = await db.applications.find_one({"id": data.get("application_id")}, {"_id": 0})
        if not application: raise HTTPException(404, "Application not found")
        await job_for_hospital(application["job_id"], user)
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db[collection_name(resource)].insert_one(data)
    if resource == "job":
        await generate_job_alerts(data)
    return clean(data)


@api.get("/{resource}/{item_id}")
async def read(resource: str, item_id: str, user=Depends(current_user)):
    validate_resource(resource)
    if resource == "job" and user.get("account_type") == "nurse":
        doc = await db.jobs.find_one({"id": item_id, "published": True, "approved": True, "status": "active"}, {"_id": 0})
        if not doc: raise HTTPException(404, "Published job not found")
        return doc
    if resource == "application":
        doc = clean(await db.applications.find_one({"id": item_id}))
        if not doc: raise HTTPException(404, "Application not found")
        if user.get("is_admin") is True or doc.get("nurse_id") == user["id"]: return doc
        await job_for_hospital(doc["job_id"], user); return doc
    if resource == "interview":
        doc = clean(await db.interviews.find_one({"id": item_id}))
        if not doc: raise HTTPException(404, "Interview not found")
        app_doc = await db.applications.find_one({"id": doc.get("application_id")}, {"_id": 0})
        if user.get("is_admin") is True or (app_doc and app_doc.get("nurse_id") == user["id"]): return doc
        await job_for_hospital(app_doc["job_id"], user); return doc
    return await get_owned(resource, item_id, user)


@api.patch("/{resource}/{item_id}")
async def update(resource: str, item_id: str, body: ProfileInput, user=Depends(current_user)):
    validate_resource(resource)
    data = body.model_dump(); collection = db[resource + "s"]
    doc = clean(await collection.find_one({"id": item_id}))
    if not doc: raise HTTPException(404, "Record not found")
    if resource == "application":
        is_owner_nurse = doc.get("nurse_id") == user["id"]
        if user.get("is_admin") is not True and not is_owner_nurse:
            await job_for_hospital(doc["job_id"], user)
        if is_owner_nurse and user.get("is_admin") is not True:
            if (set(data.keys()) - {"status", "updated_at"}) or data.get("status") != "withdrawn":
                raise HTTPException(403, "Applicants can only withdraw their own application")
        if user.get("is_admin") is not True and data.get("status") == "selected":
            completed_iv = await db.interviews.find_one({"application_id": item_id, "status": "completed"})
            if not completed_iv:
                raise HTTPException(400, "Interview must be completed before selecting this candidate")
            if not (data.get("joining_date") or doc.get("joining_date")):
                raise HTTPException(400, "A joining date is required to select this candidate")
    elif resource == "interview":
        app_doc = await db.applications.find_one({"id": doc.get("application_id")}, {"_id": 0})
        if user.get("is_admin") is not True: await job_for_hospital(app_doc["job_id"], user)
    else: await get_owned(resource, item_id, user)
    for protected in {"id", "owner_id", "user_id", "nurse_id", "hospital_id", "job_id", "application_id"}:
        data.pop(protected, None)
    if user.get("is_admin") is not True:
        if resource in {"nurse_profile", "hospital"}:
            data.pop("verification_status", None)
            data.pop("rejection_reason", None)
        if resource == "job":
            hosp = await db.hospitals.find_one({"owner_id": user["id"]}, {"_id": 0, "verification_status": 1})
            data["hospital_verified"] = bool(hosp and hosp.get("verification_status") == "verified")
    if not data:
        return doc
    was_live = resource == "job" and is_job_live(doc)
    await collection.update_one({"id": item_id}, {"$set": data})
    updated = clean(await collection.find_one({"id": item_id}))
    if resource == "job" and not was_live and is_job_live(updated):
        await generate_job_alerts(updated)
    if resource == "interview" and data.get("status") == "completed":
        appdoc = await db.applications.find_one({"id": updated.get("application_id")})
        if appdoc and appdoc.get("status") in {"submitted", "under_review", "shortlisted", "interview_scheduled"}:
            await db.applications.update_one({"id": appdoc["id"]}, {"$set": {"status": "interview_completed", "updated_at": datetime.now(timezone.utc).isoformat()}})
    if resource == "hospital" and user.get("is_admin") is True and "verification_status" in data:
        await db.jobs.update_many({"hospital_id": updated.get("owner_id")}, {"$set": {"hospital_verified": data["verification_status"] == "verified"}})
    return updated


@api.delete("/{resource}/{item_id}")
async def delete(resource: str, item_id: str, user=Depends(current_user)):
    if resource not in {"saved_job", "document"}: raise HTTPException(405, "Deletion is not allowed for this resource")
    await get_owned(resource, item_id, user)
    await db[resource + "s"].delete_one({"id": item_id})
    return {"deleted": True}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()