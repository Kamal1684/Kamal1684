/*
# NurseConnect — Core Schema

## Overview
Creates the full database schema for NurseConnect, a platform connecting nurses
with hospitals for shift-based work.

## New Tables
1. profiles — user profiles with role (nurse/hospital/admin)
2. hospitals — hospital organization profiles
3. shifts — shift postings by hospitals
4. applications — nurse applications to shifts
5. reviews — post-shift reviews between nurses and hospitals

## Security (RLS)
All tables have RLS enabled with role-appropriate policies.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('nurse', 'hospital', 'admin')),
  phone text,
  license_number text,
  specialty text,
  years_experience integer,
  bio text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ============ HOSPITALS ============
CREATE TABLE IF NOT EXISTS hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text NOT NULL,
  description text,
  website text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hospitals_select_all" ON hospitals;
CREATE POLICY "hospitals_select_all" ON hospitals FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "hospitals_insert_own" ON hospitals;
CREATE POLICY "hospitals_insert_own" ON hospitals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "hospitals_update_own" ON hospitals;
CREATE POLICY "hospitals_update_own" ON hospitals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "hospitals_delete_own" ON hospitals;
CREATE POLICY "hospitals_delete_own" ON hospitals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ SHIFTS ============
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  department text NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('day', 'evening', 'night')),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  hourly_rate numeric(10,2) NOT NULL,
  required_specialty text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select_all" ON shifts;
CREATE POLICY "shifts_select_all" ON shifts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "shifts_insert_hospital_owner" ON shifts;
CREATE POLICY "shifts_insert_hospital_owner" ON shifts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM hospitals WHERE hospitals.id = shifts.hospital_id AND hospitals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "shifts_update_hospital_owner" ON shifts;
CREATE POLICY "shifts_update_hospital_owner" ON shifts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM hospitals WHERE hospitals.id = shifts.hospital_id AND hospitals.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM hospitals WHERE hospitals.id = shifts.hospital_id AND hospitals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "shifts_delete_hospital_owner" ON shifts;
CREATE POLICY "shifts_delete_hospital_owner" ON shifts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM hospitals WHERE hospitals.id = shifts.hospital_id AND hospitals.user_id = auth.uid())
  );

-- ============ APPLICATIONS ============
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  nurse_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  cover_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, nurse_id)
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_select_nurse_or_hospital" ON applications;
CREATE POLICY "applications_select_nurse_or_hospital" ON applications FOR SELECT
  TO authenticated USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM shifts
      JOIN hospitals ON hospitals.id = shifts.hospital_id
      WHERE shifts.id = applications.shift_id AND hospitals.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "applications_insert_own" ON applications;
CREATE POLICY "applications_insert_own" ON applications FOR INSERT
  TO authenticated WITH CHECK (nurse_id = auth.uid());

DROP POLICY IF EXISTS "applications_update_hospital_status" ON applications;
CREATE POLICY "applications_update_hospital_status" ON applications FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM shifts
      JOIN hospitals ON hospitals.id = shifts.hospital_id
      WHERE shifts.id = applications.shift_id AND hospitals.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM shifts
      JOIN hospitals ON hospitals.id = shifts.hospital_id
      WHERE shifts.id = applications.shift_id AND hospitals.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "applications_update_nurse_withdraw" ON applications;
CREATE POLICY "applications_update_nurse_withdraw" ON applications FOR UPDATE
  TO authenticated USING (nurse_id = auth.uid()) WITH CHECK (nurse_id = auth.uid());

DROP POLICY IF EXISTS "applications_delete_own" ON applications;
CREATE POLICY "applications_delete_own" ON applications FOR DELETE
  TO authenticated USING (nurse_id = auth.uid());

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_role text NOT NULL CHECK (reviewer_role IN ('nurse', 'hospital')),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT
  TO authenticated WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE
  TO authenticated USING (reviewer_id = auth.uid()) WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_delete_own" ON reviews;
CREATE POLICY "reviews_delete_own" ON reviews FOR DELETE
  TO authenticated USING (reviewer_id = auth.uid());

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_shifts_hospital_id ON shifts(hospital_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_applications_shift_id ON applications(shift_id);
CREATE INDEX IF NOT EXISTS idx_applications_nurse_id ON applications(nurse_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_user_id ON hospitals(user_id);
