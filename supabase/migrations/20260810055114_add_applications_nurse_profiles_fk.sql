/*
# Fix HospitalPortal applications query — add FK applications → nurse_profiles

## Problem
The HospitalPortal ReviewApplications component queries:
  applications?select=*,profiles(...),nurse_profiles(...),interviews(*)

PostgREST resolves embedded relations using foreign keys. There was no FK
between `applications` and `nurse_profiles`, so PostgREST could not resolve
the `nurse_profiles(...)` embed. This caused the ENTIRE query to fail,
returning null/zero rows — the hospital saw no applications at all.

The NursePortal and AdminPortal queries do not embed nurse_profiles from
applications, so they were not affected by this specific issue (they were
fixed by the previous FK additions to profiles).

## Fix
Add a FK from `applications.nurse_id` → `nurse_profiles.nurse_id`.
Since `nurse_profiles.nurse_id` has a UNIQUE constraint, this is a valid
FK target. This lets PostgREST resolve `applications?select=...,nurse_profiles(...)`.

The existing FKs (applications.nurse_id → profiles.id, auth.users.id) are
preserved. RLS is not affected — the nurse_profiles SELECT policy already
allows hospitals to read nurse_profiles for applicants to their jobs.

## Data Safety
- No tables created or deleted.
- No columns added, removed, or renamed.
- No data modified.
- RLS unchanged.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_nurse_id_nurse_profiles_fkey'
      AND conrelid = 'applications'::regclass
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_nurse_id_nurse_profiles_fkey
      FOREIGN KEY (nurse_id) REFERENCES nurse_profiles(nurse_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Reload PostgREST schema cache so the new FK is picked up immediately
NOTIFY pgrst, 'reload schema';
