/*
# 1. Create hospital-documents storage bucket with secure RLS policies
# 2. Create create_notification SECURITY DEFINER function for cross-user notifications
*/

-- ============================================================
-- 1. hospital-documents PRIVATE bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hospital-documents',
  'hospital-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Hospital owner can upload to their folder (path = hospital_id/...)
DROP POLICY IF EXISTS "hospital_docs_upload_own" ON storage.objects;
CREATE POLICY "hospital_docs_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hospital-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Hospital owner can read their own files
DROP POLICY IF EXISTS "hospital_docs_read_own" ON storage.objects;
CREATE POLICY "hospital_docs_read_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'hospital-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Hospital owner can delete their own files
DROP POLICY IF EXISTS "hospital_docs_delete_own" ON storage.objects;
CREATE POLICY "hospital_docs_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'hospital-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read any hospital document
DROP POLICY IF EXISTS "hospital_docs_admin_read" ON storage.objects;
CREATE POLICY "hospital_docs_admin_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'hospital-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Admins can delete any hospital document
DROP POLICY IF EXISTS "hospital_docs_admin_delete" ON storage.objects;
CREATE POLICY "hospital_docs_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'hospital-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- ============================================================
-- 2. create_notification SECURITY DEFINER function
-- Allows any authenticated user to create a notification for any user.
-- This is needed because notifications RLS requires user_id = auth.uid()
-- for inserts, but hospitals need to notify nurses and vice versa.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'system'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (p_user_id, p_title, p_message, p_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
