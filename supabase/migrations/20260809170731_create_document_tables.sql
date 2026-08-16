/*
# Create nurse_documents and hospital_documents tables

## Overview
Creates two document tables for secure storage of verification documents.
Documents are NOT publicly accessible — RLS ensures only the owner (and
admin for verification) can read them.

## New Table: nurse_documents
- `id` (uuid, PK)
- `nurse_id` (uuid, NOT NULL, FK → auth.users, default auth.uid())
- `document_type` (text, NOT NULL) — qualification / registration /
  experience / id_proof / resume / other
- `file_name` (text, NOT NULL) — original file name
- `file_url` (text, NOT NULL) — path in Supabase Storage (private bucket)
- `file_size` (bigint, nullable) — file size in bytes
- `mime_type` (text, nullable)
- `verification_status` (text, default 'pending') — pending / verified / rejected
- `created_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated)

## New Table: hospital_documents
- `id` (uuid, PK)
- `hospital_id` (uuid, NOT NULL, FK → hospitals)
- `document_type` (text, NOT NULL) — registration / license / tax / other
- `file_name` (text, NOT NULL)
- `file_url` (text, NOT NULL) — path in Supabase Storage (private bucket)
- `file_size` (bigint, nullable)
- `mime_type` (text, nullable)
- `verification_status` (text, default 'pending')
- `created_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated)

## Security (RLS)
### nurse_documents:
- SELECT: nurse reads own documents; admin reads all.
  Hospitals do NOT have direct read access — they see verified status
  through the application review flow.
- INSERT/UPDATE/DELETE: nurse manages own documents only.

### hospital_documents:
- SELECT: hospital owner reads own; admin reads all.
- INSERT/UPDATE/DELETE: hospital owner manages own only.

## Notes
1. file_url should reference a Supabase Storage path in a PRIVATE bucket.
   Access to the actual file content is controlled by Storage bucket
   policies, not just RLS. The frontend should use signed URLs for
   downloading.
2. These tables store metadata — the actual files live in Supabase Storage.
*/

-- ============ NURSE DOCUMENTS ============
CREATE TABLE IF NOT EXISTS nurse_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nurse_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('qualification', 'registration', 'experience', 'id_proof', 'resume', 'other')),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nurse_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nurse_documents_select_own_or_admin" ON nurse_documents;
CREATE POLICY "nurse_documents_select_own_or_admin"
ON nurse_documents FOR SELECT
TO authenticated USING (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "nurse_documents_insert_own" ON nurse_documents;
CREATE POLICY "nurse_documents_insert_own"
ON nurse_documents FOR INSERT
TO authenticated WITH CHECK (nurse_id = auth.uid());

DROP POLICY IF EXISTS "nurse_documents_update_own" ON nurse_documents;
CREATE POLICY "nurse_documents_update_own"
ON nurse_documents FOR UPDATE
TO authenticated USING (nurse_id = auth.uid()) WITH CHECK (nurse_id = auth.uid());

DROP POLICY IF EXISTS "nurse_documents_delete_own" ON nurse_documents;
CREATE POLICY "nurse_documents_delete_own"
ON nurse_documents FOR DELETE
TO authenticated USING (nurse_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_nurse_documents_nurse_id ON nurse_documents(nurse_id);

DROP TRIGGER IF EXISTS nurse_documents_updated_at ON nurse_documents;
CREATE TRIGGER nurse_documents_updated_at
  BEFORE UPDATE ON nurse_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============ HOSPITAL DOCUMENTS ============
CREATE TABLE IF NOT EXISTS hospital_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('registration', 'license', 'tax', 'other')),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hospital_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hospital_documents_select_owner_or_admin" ON hospital_documents;
CREATE POLICY "hospital_documents_select_owner_or_admin"
ON hospital_documents FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = hospital_documents.hospital_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "hospital_documents_insert_owner" ON hospital_documents;
CREATE POLICY "hospital_documents_insert_owner"
ON hospital_documents FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = hospital_documents.hospital_id AND hospitals.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "hospital_documents_update_owner" ON hospital_documents;
CREATE POLICY "hospital_documents_update_owner"
ON hospital_documents FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = hospital_documents.hospital_id AND hospitals.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = hospital_documents.hospital_id AND hospitals.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "hospital_documents_delete_owner" ON hospital_documents;
CREATE POLICY "hospital_documents_delete_owner"
ON hospital_documents FOR DELETE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = hospital_documents.hospital_id AND hospitals.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_hospital_documents_hospital_id ON hospital_documents(hospital_id);

DROP TRIGGER IF EXISTS hospital_documents_updated_at ON hospital_documents;
CREATE TRIGGER hospital_documents_updated_at
  BEFORE UPDATE ON hospital_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
