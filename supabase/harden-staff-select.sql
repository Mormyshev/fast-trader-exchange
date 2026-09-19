-- Off-duty staff must not SELECT all orders via PostgREST / Realtime.
-- Run in Supabase SQL Editor. Safe if harden-security.sql already applied.

DROP POLICY IF EXISTS "orders_select_staff" ON public.orders;

CREATE POLICY "orders_select_staff"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('operator', 'admin')
      AND COALESCE(p.staff_active, false) = true
  )
);
