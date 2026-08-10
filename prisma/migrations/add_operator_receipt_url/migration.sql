-- Чек оператора при выплате RUB клиенту (продажа крипты)
ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "operator_receipt_url" TEXT;
