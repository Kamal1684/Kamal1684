/*
# Extend profiles and hospitals tables for production NurseConnect

## Overview
Adds missing columns to the existing `profiles` and `hospitals` tables
to support the production recruitment platform. No data is lost — all
changes are additive ALTER TABLE statements using conditional DO blocks.

## Modified Tables

### profiles (existing — extended)
New columns added:
- `profile_photo` (text, nullable) — URL to profile photo
- `city` (text, nullable) — user's city
- `state` (text, nullable) — user's state
- `status` (text, not null, default 'active') — active / suspended / deactivated
- `verification_status` (text, not null, default 'pending') — pending / verified / rejected
- `updated_at` (timestamptz, default now()) — last modification timestamp

The existing columns (id, email, full_name, role, phone, license_number,
specialty, years_experience, bio, avatar_url, created_at) are preserved.
`avatar_url` remains for backward compatibility; `profile_photo` is the
canonical field going forward.

### hospitals (existing — extended)
New columns added:
- `hospital_name` (text, nullable) — canonical hospital name (existing `name` preserved)
- `hospital_type` (text, nullable) — government / private / trust / clinic
- `address` (text, nullable) — full street address
- `city` (text, nullable) — city
- `state` (text, nullable) — state
- `pincode` (text, nullable) — postal code
- `number_of_beds` (integer, nullable) — bed capacity
- `departments` (text, nullable) — comma-separated department list
- `contact_person` (text, nullable) — HR/contact person name
- `contact_email` (text, nullable) — contact email
- `verification_status` (text, not null, default 'pending') — pending / verified / rejected
- `updated_at` (timestamptz, default now()) — last modification timestamp

The existing columns (id, user_id, name, location, description, website,
phone, created_at) are preserved. `name` remains for backward compatibility;
`hospital_name` is the canonical field going forward.

## Security
- No policy changes in this migration — existing RLS policies remain intact.
- New columns inherit the existing table-level RLS.

## Notes
1. All ALTER TABLE additions use DO $$ ... IF NOT EXISTS ... END $$ blocks
   so the migration is safe to re-run.
2. `updated_at` columns have a trigger to auto-update on row modification.
3. No existing column is dropped, renamed, or type-changed.
*/

-- ============ PROFILES EXTENSION ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'profile_photo') THEN
    ALTER TABLE profiles ADD COLUMN profile_photo text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'city') THEN
    ALTER TABLE profiles ADD COLUMN city text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'state') THEN
    ALTER TABLE profiles ADD COLUMN state text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'status') THEN
    ALTER TABLE profiles ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'suspended', 'deactivated'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_status') THEN
    ALTER TABLE profiles ADD COLUMN verification_status text NOT NULL DEFAULT 'pending'
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- ============ HOSPITALS EXTENSION ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'hospital_name') THEN
    ALTER TABLE hospitals ADD COLUMN hospital_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'hospital_type') THEN
    ALTER TABLE hospitals ADD COLUMN hospital_type text
      CHECK (hospital_type IN ('government', 'private', 'trust', 'clinic'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'address') THEN
    ALTER TABLE hospitals ADD COLUMN address text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'city') THEN
    ALTER TABLE hospitals ADD COLUMN city text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'state') THEN
    ALTER TABLE hospitals ADD COLUMN state text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'pincode') THEN
    ALTER TABLE hospitals ADD COLUMN pincode text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'number_of_beds') THEN
    ALTER TABLE hospitals ADD COLUMN number_of_beds integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'departments') THEN
    ALTER TABLE hospitals ADD COLUMN departments text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'contact_person') THEN
    ALTER TABLE hospitals ADD COLUMN contact_person text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'contact_email') THEN
    ALTER TABLE hospitals ADD COLUMN contact_email text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'verification_status') THEN
    ALTER TABLE hospitals ADD COLUMN verification_status text NOT NULL DEFAULT 'pending'
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'updated_at') THEN
    ALTER TABLE hospitals ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- ============ AUTO-UPDATE TRIGGER FOR updated_at ============
-- Reusable function for auto-updating updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS hospitals_updated_at ON hospitals;
CREATE TRIGGER hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
