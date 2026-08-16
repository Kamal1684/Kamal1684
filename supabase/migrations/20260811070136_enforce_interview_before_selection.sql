/*
# Enforce interview-before-selection workflow at the database level

## Problem
A hospital can set an application status to 'selected' directly from
'shortlisted', bypassing the interview stage entirely. The UI should
prevent this, but we also need a database-level guard so the rule
cannot be bypassed by any client.

## Fix
Add a BEFORE UPDATE trigger on `applications` that rejects any update
to status = 'selected' unless a related interview exists with
status = 'completed'. This is the server-side enforcement that
complements the UI hiding of the Select button.

## Data Safety
- No tables created or deleted.
- No columns added, removed, or renamed.
- No data modified.
- RLS unchanged.
- Existing applications and interviews preserved.
*/

CREATE OR REPLACE FUNCTION public.enforce_interview_before_selection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when transitioning TO 'selected'
  IF NEW.status = 'selected' AND OLD.status <> 'selected' THEN
    -- Must have at least one completed interview for this application
    IF NOT EXISTS (
      SELECT 1 FROM interviews
      WHERE interviews.application_id = NEW.id
        AND interviews.status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Cannot select an applicant without a completed interview';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_interview_before_selection ON applications;
CREATE TRIGGER trigger_enforce_interview_before_selection
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_interview_before_selection();

-- Revoke execute from anon/authenticated so it can only be called by the trigger
REVOKE EXECUTE ON FUNCTION public.enforce_interview_before_selection() FROM anon, authenticated;
