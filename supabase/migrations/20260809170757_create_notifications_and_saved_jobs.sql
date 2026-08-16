/*
# Create notifications and saved_jobs tables

## Overview
Creates two tables:
1. `notifications` — per-user notification feed
2. `saved_jobs` — nurses' bookmarked jobs

## New Table: notifications
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, FK → auth.users, default auth.uid())
- `title` (text, NOT NULL)
- `message` (text, NOT NULL)
- `type` (text, NOT NULL) — application / interview / verification / job / system
- `is_read` (boolean, default false)
- `created_at` (timestamptz)

## New Table: saved_jobs
- `id` (uuid, PK)
- `nurse_id` (uuid, NOT NULL, FK → auth.users, default auth.uid())
- `job_id` (uuid, NOT NULL, FK → jobs)
- `created_at` (timestamptz)
- UNIQUE (nurse_id, job_id) — prevents duplicate saves

## Security (RLS)
### notifications:
- SELECT/UPDATE: user reads/marks-read only own notifications.
- INSERT: user or system can insert for the user themselves.
- DELETE: user deletes own.

### saved_jobs:
- SELECT: nurse sees own saved jobs.
- INSERT: nurse saves own.
- DELETE: nurse removes own.

## Notes
1. notifications.user_id defaults to auth.uid() for self-insertion.
2. saved_jobs has UNIQUE (nurse_id, job_id) to prevent duplicate saves.
*/

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('application', 'interview', 'verification', 'job', 'system')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
ON notifications FOR SELECT
TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own"
ON notifications FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
ON notifications FOR UPDATE
TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
ON notifications FOR DELETE
TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============ SAVED JOBS ============
CREATE TABLE IF NOT EXISTS saved_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nurse_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nurse_id, job_id)
);

ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_jobs_select_own" ON saved_jobs;
CREATE POLICY "saved_jobs_select_own"
ON saved_jobs FOR SELECT
TO authenticated USING (nurse_id = auth.uid());

DROP POLICY IF EXISTS "saved_jobs_insert_own" ON saved_jobs;
CREATE POLICY "saved_jobs_insert_own"
ON saved_jobs FOR INSERT
TO authenticated WITH CHECK (nurse_id = auth.uid());

DROP POLICY IF EXISTS "saved_jobs_delete_own" ON saved_jobs;
CREATE POLICY "saved_jobs_delete_own"
ON saved_jobs FOR DELETE
TO authenticated USING (nurse_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_saved_jobs_nurse_id ON saved_jobs(nurse_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job_id ON saved_jobs(job_id);
