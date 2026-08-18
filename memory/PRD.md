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
- 2026-06: Complete Hospital Dashboard / Hospital Console (frontend only, zero
  backend changes):
  - Protected /hospital/* area: unauth → /login; nurse accounts see
    "Hospital access only"; admin (server-side is_admin) may enter.
  - HospitalLayout (emerald theme): sidebar (Dashboard, Hospital Profile,
    Jobs, Candidates, Interviews, Hired Nurses), topbar with hospital name,
    verification badge, notifications (new applications + upcoming
    interviews), logout, mobile Sheet nav (`hospital-mobile-nav-*`).
  - Dashboard: real stats (active jobs, applications, shortlisted, upcoming
    interviews, hired), recent jobs/applications lists, verification card.
  - /hospital/profile: name, phone, address, city, state, pincode, type,
    beds, license number; secure license upload/download/delete via
    /api/document (doc_type hospital_license); verification badge.
  - /hospital/jobs + /hospital/jobs/new + /hospital/jobs/:id/edit: full
    validation (required fields, salary min≤max, openings≥1, future
    deadline); Save Draft (published:false, status draft — hidden from
    public) vs Submit & Publish (published+approved+active); job state
    badges Draft/Pending Approval/Published/Closed; close job; applicant
    counts; hospital_name/hospital_verified auto-attached to jobs.
  - /hospital/candidates: applicants for own jobs only, sorted by
    rule-based match %, job filter, candidate detail dialog with match
    breakdown, Shortlist / Reject / Select / Schedule Interview actions.
  - Interview scheduler dialog (date/time/type/link/location/notes,
    past-date + missing-link validation); scheduling also moves the
    application to interview_scheduled. /hospital/interviews: upcoming/past,
    reschedule, cancel, mark completed.
  - /hospital/hired: roster of Selected applications with contact info from
    the nurse-supplied application snapshot.
  - Nurse apply flow now attaches a nurse profile snapshot (name,
    qualification, experience, departments, location, phone, verification
    status, preferences) to POST /api/application so hospitals see candidate
    info through their already-RLS-authorized application reads — no RLS
    change needed.
  - A11y: sr-only SheetTitle added to mobile nav sheets.
- 2026-06: Full-stack test pass (iteration_4): 35/35 backend pytest
  (10 security + 12 nurse-flow + 13 new hospital-flow tests in
  `tests/test_hospital_flows.py` covering hospital↔hospital isolation,
  snapshots, interview transitions, closed-job visibility); 100% frontend
  Playwright coverage of hospital flows incl. cross-role guards and mobile.
- 2026-06: Job Alerts feature:
  - Backend: `compute_match_score` (Python mirror of frontend rule-based
    algorithm), `generate_job_alerts` hook fired when a job becomes live
    (POST /api/job or PATCH transition to published+approved+active);
    creates `job_alerts` docs {nurse_id, job_id, job_title, hospital_name,
    department, location, match_score, read} for nurses matching strictly
    above 75%. Deduped per (nurse_id, job_id). Draft jobs create no alerts.
  - Endpoints (registered before generic /{resource} routes):
    GET /api/alerts (nurse-scoped, admin sees all), POST
    /api/alerts/mark-read (own alerts only). Clients cannot create alerts
    (generic router rejects the resource).
  - Frontend: nurse notifications bell fetches /api/alerts, shows
    "{score}% match — {job} at {hospital}" items (emerald, Sparkles icon),
    unread count badge, marks read on popover open, click navigates to
    /nurse/jobs. Hospital bell unchanged (no /api/alerts calls).
- 2026-06: Test pass (iteration_5): 42/42 backend pytest (35 regression + 7
  new in `tests/test_job_alerts.py`: scoring, draft→live transition, dedupe,
  RLS isolation, mark-read isolation); frontend Playwright E2E of the full
  alert flow passed.
- 2026-06: Admin Console + backend hardening:
  - Backend hardening (strengthens, never weakens RLS):
    - Non-admins can no longer set/patch `verification_status` /
      `rejection_reason` on nurse_profile & hospital (stripped server-side;
      create defaults to "pending"). Self-verification impossible.
    - `hospital_verified` on jobs is computed server-side from the
      hospital's real verification_status on non-admin job create/patch
      (badge cannot be forged).
    - Admin PATCH of a hospital's verification_status propagates
      hospital_verified to all that hospital's jobs.
    - New admin-only `GET /api/admin/users` (email/account_type map, no
      password_hash, 403 for non-admins).
    - Job workflow gained "rejected" status (admin reject → unpublished +
      rejection_reason shown on hospital Jobs page).
  - Admin Console frontend (/admin/*, indigo theme, is_admin server flag
    only): AdminLayout (sidebar Dashboard/Nurses/Hospitals/Job Approvals/
    Applications/Verification/Settings, pending-actions bell, mobile nav);
    Dashboard with 10 live stat cards; Nurses & Hospitals verification
    tables with filters, detail dialogs showing documents (download),
    Mark Under Review / Approve (confirm dialog) / Reject (reason dialog);
    Job Approvals table with state filter, review dialog, Approve & Publish
    (triggers alerts + public visibility), Reject with reason, Close;
    read-only Applications overview with filters; unified Verification
    Center (pending nurses/hospitals/jobs/documents with quick actions);
    Settings (account, admin provisioning, matching config).
  - Persistent admin account created for QA:
    admin@nurseconnect-platform.com / AdminPass123! (test_credentials.md).
- 2026-06: Test pass (iteration_6): 51/51 backend pytest (42 regression + 9
  new in `tests/test_admin_flows.py`); 100% frontend Playwright checks
  (admin login, access guards for nurse/hospital/unauth, approve/reject job
  E2E incl. alerts + public visibility, mobile). Zero defects.
- 2026-06: UI fix — mobile/tablet nav drawer overlay made fully transparent
  (`bg-black/80` → `bg-transparent` in `components/ui/sheet.jsx`). Sheet is
  used only by the three console nav drawers; modal dialogs (dialog.jsx /
  alert-dialog.jsx) keep their dark overlay. Outside-click close, X button,
  and desktop sidebar unchanged. Verified on mobile 390px and tablet 768px.

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
- P1: none (all three consoles — Nurse, Hospital, Admin — complete).
- P2: refresh tokens, rate limiting, audit log for admin actions, pagination
  for /api/admin/users and admin tables, signed URLs / object storage for
  larger document files, interview reminders, candidate notes, optional
  strict admin-approval gate for job publishing (hospitals currently
  self-publish by design), server.py modular refactor (routes/auth,
  routes/admin, services/alerts).

## Files of reference
- `/app/backend/server.py` – all API + RLS logic, job alerts engine,
  admin endpoints + verification hardening.
- `/app/backend/tests/` – test_security_live.py (10), test_nurse_flows.py
  (12), test_hospital_flows.py (13), test_job_alerts.py (7),
  test_admin_flows.py (9).
- `/app/frontend/src/App.js` – routes + NurseArea/HospitalArea guards.
- `/app/frontend/src/pages/nurse/*`, `/app/frontend/src/pages/hospital/*`,
  `/app/frontend/src/pages/admin/*`.
- `/app/frontend/src/components/nurse/*`, `components/hospital/*`,
  `components/admin/*` (AdminLayout, AdminDialogs, adminShared).
- `/app/frontend/src/lib/{api,match,status}.js` – axios client, match score +
  snapshots, status/job-state metadata.
- `/app/memory/test_credentials.md` – credential handling notes.


## Changelog

### 2026-06 — Login/Register UI redesign + Mobile number registration
- **Login/Register UI**: Removed the Sign In/Register tabs. Single form shown
  first; account switch moved to the bottom ("Don't have an account? Register"
  / "Already have an account? Sign In"). Auth logic unchanged.
  (`frontend/src/pages/Login.jsx`)
- **Mobile registration (required)**: Added required `mobile` field to Nurse &
  Hospital registration, wired end-to-end.
  - Backend (`server.py`): new `RegisterInput` model (email/password/account_type/mobile),
    `normalize_indian_mobile()` validates & normalizes +91 numbers to
    `+91XXXXXXXXXX` (10 digits starting 6-9, accepts +91/0/91 prefixes).
    `/auth/register` now stores `mobile` + `mobile_verified: False`, rejects
    duplicate mobiles (409) and invalid formats (400). `login` & `/auth/me`
    responses include `mobile` and `mobile_verified`.
  - No OTP/SMS verification implemented — number stored as verification pending
    (UI shows "Verification pending" note). NOT verified.
  - Frontend: `AuthContext.register` passes mobile; Login register form has
    `register-mobile-input` (+91 prefix); `apiError` hardened to format 422
    validation arrays into readable strings.
  - Tests: all test register helpers updated to send a unique valid mobile.
    Full suite **64 passed** (3× stable). E2E UI registration confirmed the
    mobile persists in MongoDB (`+91…`, `mobile_verified: False`).
- `Credentials` model (login/admin-bootstrap) left unchanged.


### 2026-06 — Nurse Portal UI additions + full workflow verification
- **Nurse Portal (frontend only)**:
  - Find Jobs shows Hospital Name and "Apply by {last date}" (from `application_deadline`).
  - Added Job Title filter dropdown with "Nursing Officer" (`pages/nurse/Jobs.jsx`).
  - Nurse Profile State converted to dropdown: Haryana, Delhi, Himachal Pradesh,
    Punjab, Chandigarh (preserves any pre-existing saved value).
- **Signup/Profile prefill**: Show/Hide password toggle on signup; added required
  Full Name field; Nurse Profile auto-fills Name (from signup, localStorage),
  Email (read-only) and Mobile without re-asking.
- **Nurse + Hospital workflow — verified end-to-end (testing agent iteration_8)**:
  - Nurse: Find Jobs → Details → Apply → duplicate blocked (409, graceful UI) →
    My Applications status tracker.
  - Hospital: profile → create/publish job (published+approved+active) → Candidates
    (Shortlist → Schedule Interview → Select/Reject) → Interviews (Mark Completed/
    Cancel/Reschedule) → Hired roster.
  - Status transitions Applied → Shortlisted → Interview Scheduled → Selected/Rejected
    saved & visible to BOTH nurse and hospital; nurses cannot mutate their own
    application status (403).
  - RLS: a hospital can access only its own jobs/applications/interviews (list/read/
    PATCH all isolated). **72/72 backend tests pass** (64 preexisting + 8 new
    `test_workflow_iteration8.py`).
  - Fixed genuine LOW bug: invalid `<div>` (Badge) nested in `<p>` in
    `components/nurse/JobCard.jsx` and the Job Details dialog — now valid, no
    console hydration warning.
- No backend/auth/RLS/DB-structure changes. All `wftest_`/smoke test data purged.
