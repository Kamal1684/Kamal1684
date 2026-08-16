/*
# Create job_matches table and rule-based matching function

## Overview
Creates a `job_matches` table that stores pre-computed match scores between
nurses and jobs. A PL/pgSQL function `calculate_job_match` computes a
rule-based score using the specified weighted factors.

## New Table: job_matches
- `id` (uuid, PK)
- `job_id` (uuid, NOT NULL, FK → jobs)
- `nurse_id` (uuid, NOT NULL, FK → auth.users)
- `match_score` (numeric(5,2), NOT NULL, 0-100)
- `qualification_score` (numeric(5,2)) — 0-30
- `experience_score` (numeric(5,2)) — 0-25
- `skills_score` (numeric(5,2)) — 0-20
- `location_score` (numeric(5,2)) — 0-15
- `salary_score` (numeric(5,2)) — 0-10
- `created_at` (timestamptz)
- UNIQUE (job_id, nurse_id)

## New Function: calculate_job_match(p_job_id uuid, p_nurse_id uuid)
Returns a single row with the breakdown and total score.

### Matching factors and weights:
1. Qualification match (30%): compares job.qualification_required with
   nurse_profile.qualification. Exact match = 30, partial = 15, no match = 0.
2. Experience match (25%): compares job.experience_required with
   nurse_profile.total_experience. Meets/exceeds = 25, within 1 year = 15,
   else scaled.
3. Department/skills match (20%): compares job.required_skills with
   nurse_profile.departments. Overlap ratio determines score.
4. Location match (15%): compares job.location with
   nurse_profile.preferred_location. Exact = 15, same state = 8, else 0.
5. Salary match (10%): compares job.salary_max with
   nurse_profile.expected_salary. If salary_max >= expected = 10,
   if within 20% = 5, else 0.

## Security (RLS)
- SELECT: nurse sees matches for themselves; hospital sees matches for
  their jobs; admin sees all.
- INSERT/UPDATE/DELETE: admin only (matches are system-computed).

## Notes
1. The function is a SECURITY DEFINER function so it can read all
   relevant tables regardless of the caller's RLS. It is read-only
   (no writes) and returns only the score — no sensitive data.
2. The function is callable by authenticated users.
3. job_matches rows are typically populated by a batch job or on-demand
   by calling the function and inserting results.
*/

CREATE TABLE IF NOT EXISTS job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  nurse_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  qualification_score numeric(5,2) NOT NULL DEFAULT 0,
  experience_score numeric(5,2) NOT NULL DEFAULT 0,
  skills_score numeric(5,2) NOT NULL DEFAULT 0,
  location_score numeric(5,2) NOT NULL DEFAULT 0,
  salary_score numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, nurse_id)
);

ALTER TABLE job_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_matches_select_nurse_hospital_admin" ON job_matches;
CREATE POLICY "job_matches_select_nurse_hospital_admin"
ON job_matches FOR SELECT
TO authenticated USING (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM jobs
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE jobs.id = job_matches.job_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "job_matches_insert_admin" ON job_matches;
CREATE POLICY "job_matches_insert_admin"
ON job_matches FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "job_matches_update_admin" ON job_matches;
CREATE POLICY "job_matches_update_admin"
ON job_matches FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "job_matches_delete_admin" ON job_matches;
CREATE POLICY "job_matches_delete_admin"
ON job_matches FOR DELETE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE INDEX IF NOT EXISTS idx_job_matches_job_id ON job_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_nurse_id ON job_matches(nurse_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_score ON job_matches(match_score DESC);

-- ============ MATCHING FUNCTION ============
-- Security definer so it can read all tables; read-only, returns only scores.
CREATE OR REPLACE FUNCTION calculate_job_match(p_job_id uuid, p_nurse_id uuid)
RETURNS TABLE (
  match_score numeric(5,2),
  qualification_score numeric(5,2),
  experience_score numeric(5,2),
  skills_score numeric(5,2),
  location_score numeric(5,2),
  salary_score numeric(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_nurse RECORD;
  v_qual_score numeric(5,2) := 0;
  v_exp_score numeric(5,2) := 0;
  v_skills_score numeric(5,2) := 0;
  v_loc_score numeric(5,2) := 0;
  v_salary_score numeric(5,2) := 0;
  v_job_skills text[];
  v_nurse_skills text[];
  v_overlap int := 0;
  v_total_skills int := 0;
  v_i int;
BEGIN
  -- Fetch job
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric(5,2), 0::numeric(5,2), 0::numeric(5,2), 0::numeric(5,2), 0::numeric(5,2), 0::numeric(5,2);
    RETURN;
  END IF;

  -- Fetch nurse profile
  SELECT * INTO v_nurse FROM nurse_profiles WHERE nurse_id = p_nurse_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric(5,2), 0::numeric(5,2), 0::numeric(5,2), 0::numeric(5,2), 0::numeric(5,2), 0::numeric(5,2);
    RETURN;
  END IF;

  -- 1. Qualification (30%)
  IF v_job.qualification_required IS NOT NULL AND v_nurse.qualification IS NOT NULL THEN
    IF LOWER(TRIM(v_nurse.qualification)) = LOWER(TRIM(v_job.qualification_required)) THEN
      v_qual_score := 30;
    ELSIF POSITION(LOWER(TRIM(v_job.qualification_required)) IN LOWER(TRIM(v_nurse.qualification))) > 0
       OR POSITION(LOWER(TRIM(v_nurse.qualification)) IN LOWER(TRIM(v_job.qualification_required))) > 0 THEN
      v_qual_score := 15;
    END IF;
  END IF;

  -- 2. Experience (25%)
  IF v_job.experience_required IS NOT NULL AND v_nurse.total_experience IS NOT NULL THEN
    IF v_nurse.total_experience >= v_job.experience_required THEN
      v_exp_score := 25;
    ELSIF v_nurse.total_experience >= v_job.experience_required - 1 THEN
      v_exp_score := 15;
    ELSE
      v_exp_score := GREATEST(0, (v_nurse.total_experience::numeric / v_job.experience_required::numeric) * 25);
    END IF;
  END IF;

  -- 3. Skills/Departments (20%)
  IF v_job.required_skills IS NOT NULL AND v_nurse.departments IS NOT NULL THEN
    v_job_skills := string_to_array(LOWER(v_job.required_skills), ',');
    v_nurse_skills := string_to_array(LOWER(v_nurse.departments), ',');
    v_total_skills := array_length(v_job_skills, 1);
    IF v_total_skills > 0 THEN
      FOREACH v_i IN ARRAY v_job_skills LOOP
        IF TRIM(v_i) = ANY(v_nurse_skills) THEN
          v_overlap := v_overlap + 1;
        END IF;
      END LOOP;
      v_skills_score := (v_overlap::numeric / v_total_skills::numeric) * 20;
    END IF;
  END IF;

  -- 4. Location (15%)
  IF v_job.location IS NOT NULL AND v_nurse.preferred_location IS NOT NULL THEN
    IF LOWER(TRIM(v_nurse.preferred_location)) = LOWER(TRIM(v_job.location)) THEN
      v_loc_score := 15;
    ELSIF POSITION(LOWER(TRIM(v_job.location)) IN LOWER(TRIM(v_nurse.preferred_location))) > 0 THEN
      v_loc_score := 8;
    END IF;
  END IF;

  -- 5. Salary (10%)
  IF v_job.salary_max IS NOT NULL AND v_nurse.expected_salary IS NOT NULL THEN
    IF v_job.salary_max >= v_nurse.expected_salary THEN
      v_salary_score := 10;
    ELSIF v_job.salary_max >= v_nurse.expected_salary * 0.8 THEN
      v_salary_score := 5;
    END IF;
  END IF;

  RETURN QUERY SELECT
    (v_qual_score + v_exp_score + v_skills_score + v_loc_score + v_salary_score)::numeric(5,2),
    v_qual_score,
    v_exp_score,
    v_skills_score,
    v_loc_score,
    v_salary_score;
  RETURN;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION calculate_job_match(uuid, uuid) TO authenticated;
