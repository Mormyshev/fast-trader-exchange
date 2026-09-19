-- Close leftover Dashboard policies that the previous harden scripts did not drop
-- (they used different names). Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.is_staff_on_duty()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('operator', 'admin')
      AND COALESCE(staff_active, false) = true
  );
$$;

-- =============================================================================
-- 1) Orders: browser may only SELECT; writes go through the Next.js service role
-- =============================================================================
DROP POLICY IF EXISTS "Operators can view and update all orders" ON public.orders;
DROP POLICY IF EXISTS "Operators can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_staff" ON public.orders;

DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "orders_select_staff" ON public.orders;
CREATE POLICY "orders_select_staff"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_staff_on_duty());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;

-- =============================================================================
-- 2) Profiles: own row, or on-duty staff SELECT. No PostgREST UPDATE of others.
-- =============================================================================
DROP POLICY IF EXISTS "View profiles policy" ON public.profiles;
DROP POLICY IF EXISTS "Update profiles policy" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Insert profiles policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_staff_on_duty" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_select_staff_on_duty"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_staff_on_duty());

-- Writes only via Next.js (service role). Do not recreate insert/update policies.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT ON public.profiles TO authenticated;

-- =============================================================================
-- 3) Chat tables: RLS is on and there are no policies => deny. Keep it that way.
--    Revoke table grants so anon/authenticated cannot hit them via PostgREST.
-- =============================================================================
REVOKE ALL ON public.chat_conversations FROM anon, authenticated;
REVOKE ALL ON public.chat_messages FROM anon, authenticated;
REVOKE ALL ON public.staff_conversations FROM anon, authenticated;
REVOKE ALL ON public.staff_messages FROM anon, authenticated;
REVOKE ALL ON public.staff_conversation_reads FROM anon, authenticated;

-- =============================================================================
-- 4) Storage: bucket is private, but old object policies still allow public R/W
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to upload passports" ON storage.objects;
DROP POLICY IF EXISTS "Allow everyone to read passports" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Разрешить загрузку паспортов для " ON storage.objects;
DROP POLICY IF EXISTS "Разрешить загрузку чеков для всех" ON storage.objects;
DROP POLICY IF EXISTS "Разрешить чтение верификаций" ON storage.objects;
DROP POLICY IF EXISTS "Разрешить чтение чеков для всех" ON storage.objects;

-- crypto_rates: public SELECT is OK (курс открытый). Writes stay denied by RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.crypto_rates FROM anon, authenticated;
GRANT SELECT ON public.crypto_rates TO anon, authenticated;
