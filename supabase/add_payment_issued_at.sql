-- Старт окна оплаты: таймер 15 минут с момента выдачи реквизитов.
-- Выполните в SQL Editor Supabase.

ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "payment_issued_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_payment_issued_at
  ON "orders" ("payment_issued_at")
  WHERE status = 'awaiting_payment';
