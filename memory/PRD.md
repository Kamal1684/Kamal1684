# NurseConnect - PRD

## Original problem statement
Implement the complete Row-Level Security / server-side authorization layer for
NurseConnect covering Profile, NurseProfile, Hospital, Job, Application,
SavedJob, Interview, and Documents. Frontend checks are UX only; the actual
authorization must live at the API/data layer. Admin must use a real server
side flag, never a client-supplied role. Do NOT add demo/seed data yet.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) + Motor (async MongoDB).
- Storage: MongoDB collections `users`, `profiles`, `nurse_profiles`,
  `hospitals`, `jobs`, `applications`, `saved_jobs`, `interviews`, `documents`.
- Auth: bcrypt password hashing, HS256 JWT (60-min access token).
- Admin: server-side `is_admin` boolean on the user document. Promotion is
  gated by `POST /api/auth/admin-bootstrap` which requires the server-only
  `ADMIN_BOOTSTRAP_SECRET` header. Clients can never set `is_admin`.
- Frontend: React starter scaffold (no NurseConnect UI implemented yet; out of
  scope for this security task).

## Entities & ownership fields
- `profile`: owned via `user_id`.
- `nurse_profile`, `hospital`, `saved_job`, `document`: owned via `owner_id`.
- `job`: owned by hospital via `hospital_id` (== hospital user's id).
- `application`: owned by nurse via `nurse_id`, links to `job_id` (hospital
  owns via the job).
- `interview`: linked to `application_id`; access derived from that
  application's nurse and job's hospital.

## Authorization policies (RLS)
- Every private endpoint requires a valid JWT (`Authorization: Bearer …`).
- Listing (`GET /api/{resource}`) filters MongoDB by ownership for the caller;
  admin sees everything.
- Reading (`GET /api/{resource}/{id}`) resolves the doc then applies the same
  ownership check. Nurses reading `job` only see published+approved+active.
- Creating (`POST /api/{resource}`) forces the ownership field to the caller
  and enforces per-resource account-type constraints:
  - nurses cannot create `job` or `interview`;
  - hospitals cannot create `application`;
  - applications only allowed for active/published/approved jobs.
- Updating (`PATCH /api/{resource}/{id}`):
  - re-validates ownership;
  - applicants cannot set application `status`/`shortlisted`/`rejected`;
  - immutable fields (`id`, `owner_id`, `user_id`, `nurse_id`, `hospital_id`,
    `job_id`, `application_id`) are stripped before update.
- Deleting (`DELETE /api/{resource}/{id}`) only allowed for `saved_job` and
  `document`, still ownership-checked.
- Generic route allowlist: only entities in `ALLOWED_RESOURCES` may be
  reached via `/{resource}` handlers; any other collection returns 404.

## Public / recruitment endpoints
- `GET /api/public/jobs` – published+approved+active jobs (hospital id
  redacted).
- `GET /api/public/hospitals` – hospitals with `public: true` (owner id
  redacted).
- `GET /api/recruitment/nurses` – hospital/admin only, returns only nurses
  with `recruitment_visible: true`, redacts sensitive fields (documents,
  id proof, registration certificate, owner/user id).

## What has been implemented
- 2026-01: Backend auth (`register`, `login`, `me`) with bcrypt + JWT.
- 2026-01: Ownership-aware RLS on all 8 private resources.
- 2026-01: Admin bootstrap endpoint gated by server-side secret.
- 2026-01: Generic-resource allowlist guard, immutable ownership field
  stripping on PATCH, delete restricted to safe resources.
- 2026-01: Public jobs + hospitals and recruitment-nurse view with field
  redaction.
- 2026-01: Comprehensive live pytest suite (`tests/test_security_live.py`)
  covering nurse↔nurse, hospital↔hospital and admin-positive scenarios (10/10
  passing).
- 2026-06: Backend: duplicate-application prevention (POST /api/application
  returns 409 if the nurse already applied to that job). No RLS changes.
- 2026-06: Complete Nurse Dashboard frontend (React + Tailwind + shadcn):
  - Auth: /login with Sign In / Register tabs (nurse or hospital account),
    JWT stored in localStorage, axios interceptor, 401 auto-logout redirect.
  - Protected /nurse/* area: unauthenticated → /login; hospital accounts see
    "Nurse access only" message; admin (server-side is_admin) may also enter.
  - NurseLayout: sidebar (Dashboard, My Profile, Find Jobs, Saved Jobs,
    Applications, Interviews), sticky topbar with nurse name/avatar,
    notifications bell (real data derived: upcoming interviews + status
    updates), logout, mobile Sheet nav (testids prefixed `mobile-nav-*`).
  - Dashboard: real stat cards (saved, active apps, shortlisted, upcoming
    interviews), profile summary with completion % + verification badge
    (Pending/Under Review/Verified/Rejected), recent applications, upcoming
    interviews, empty states everywhere.
  - Profile (/nurse/profile): personal, professional, preferences sections;
    create/PATCH own nurse_profile; document upload (base64 ≤2MB) for
    qualification certificate / registration certificate / ID proof via the
    RLS-protected /api/document, with download + delete.
  - Find Jobs (/nurse/jobs): GET /api/public/jobs, client-side filters
    (title, department, qualification, location, salary, experience, shift,
    accommodation), job details dialog, Save Job, Apply (duplicate blocked),
    transparent rule-based match % badge with breakdown tooltip (dept 25,
    location 20, experience 20, shift 15, qualification 10, salary 10).
  - Saved Jobs: list own saved_jobs (snapshot fields), remove, apply.
  - Applications: own applications with visual stepper Applied → Under
    Review → Shortlisted → Interview Scheduled → Selected (+ Rejected/
    Withdrawn pills). Nurse cannot change status (backend-enforced).
  - Interviews: own interviews split Upcoming/Previous, details dialog with
    meeting link / location / notes.
- 2026-06: Full-stack test pass (iteration_3): 22/22 backend pytest
  (10 security + 12 new nurse-flow tests in `tests/test_nurse_flows.py`),
  11/11 frontend Playwright flows incl. mobile responsiveness and
  nurse-to-nurse isolation.

## Tested user actions (all passing)
- Register/login/me; admin-account registration is blocked.
- Admin bootstrap: succeeds with the secret; fails without or with wrong.
- Nurse A cannot read/modify Nurse B's profile, nurse_profile, saved_job,
  document, application, interview.
- Hospital H1 cannot modify Hospital H2's hospital record, jobs,
  applications, or interviews.
- Hospital owner can read applications for its jobs and update status;
  applicants cannot change status.
- Nurse can only view published+approved+active jobs by id.
- Nurse cannot create/update jobs or interviews; hospital cannot create
  applications.
- Deleting saved_job and document restricted to owner only.
- Generic `/api/{bad}` targets (`users`, `secrets`, …) return 404.
- Admin overrides work for read/list/update across resources.
- PATCH cannot reassign ownership fields (`user_id`, etc.).

## Remaining security limitations / notes
- No refresh-token rotation or session revocation – JWT valid for 60 minutes.
- Rate-limiting/brute-force protection not implemented (out of scope).
- Document storage is metadata-only; if actual files are added later they must
  live behind a signed-URL/private-storage flow (still owner/hospital/admin
  scoped).
- Frontend NurseConnect UI (nurse/hospital/admin dashboards, job search,
  applications, interviews) is NOT built yet. Only the starter React scaffold
  exists. Security is enforced server-side regardless.

## Prioritized backlog
- P0: none.
- P1: Hospital dashboard (post jobs, review applications, update status,
  schedule interviews via UI) and Admin dashboard (verification workflows).
- P2: refresh tokens, rate limiting, audit log for admin actions, signed URLs
  / object storage for larger document files, verification workflows UI.

## Files of reference
- `/app/backend/server.py` – all API + RLS logic (+ duplicate-application 409).
- `/app/backend/tests/test_security_live.py` – live security test suite.
- `/app/backend/tests/test_nurse_flows.py` – nurse/hospital flow tests.
- `/app/frontend/src/App.js` – routes + NurseArea guard.
- `/app/frontend/src/pages/nurse/*` – Dashboard, Profile, Jobs, SavedJobs,
  Applications, Interviews.
- `/app/frontend/src/components/nurse/*` – NurseLayout, Badges, JobCard,
  States, NotificationsBell.
- `/app/frontend/src/lib/{api,match,status}.js` – axios client, match score,
  status metadata.
- `/app/memory/test_credentials.md` – credential handling notes.
