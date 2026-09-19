-- Harden RLS and storage. Run in Supabase SQL Editor after fix-orders-rls.sql.
-- App writes go through the service role; browsers must not INSERT/UPDATE orders.

-- 1) Orders: keep SELECT, drop client/staff writes via PostgREST
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_staff" ON public.orders;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2) Profiles: privilege / KYC status only via service_role (API)
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW)->>'role') IS DISTINCT FROM (to_jsonb(OLD)->>'role')
     OR (to_jsonb(NEW)->>'is_senior_operator') IS DISTINCT FROM (to_jsonb(OLD)->>'is_senior_operator')
     OR (to_jsonb(NEW)->>'staff_active') IS DISTINCT FROM (to_jsonb(OLD)->>'staff_active')
     OR (to_jsonb(NEW)->>'verification') IS DISTINCT FROM (to_jsonb(OLD)->>'verification')
     OR (to_jsonb(NEW)->>'verification_rejection_comment') IS DISTINCT FROM (to_jsonb(OLD)->>'verification_rejection_comment')
     OR COALESCE(to_jsonb(NEW)->>'is_blacklisted', 'false') IS DISTINCT FROM COALESCE(to_jsonb(OLD)->>'is_blacklisted', 'false')
     OR (to_jsonb(NEW)->>'blacklist_reason') IS DISTINCT FROM (to_jsonb(OLD)->>'blacklist_reason')
     OR (to_jsonb(NEW)->>'blacklisted_at') IS DISTINCT FROM (to_jsonb(OLD)->>'blacklisted_at') THEN
    RAISE EXCEPTION 'Cannot change privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- 3) Private buckets — objects are served via signed URLs from the API
UPDATE storage.buckets
SET public = false
WHERE id IN ('receipts', 'verifications', 'chat-attachments');
