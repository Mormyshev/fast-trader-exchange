-- Создаем перечисления (Enums)
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'failed');
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'operator');
CREATE TYPE "VerificationStatus" AS ENUM ('not_started', 'pending', 'verified', 'rejected');

-- Создаем таблицу профилей
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" DEFAULT 'user',
    "verification" "VerificationStatus" DEFAULT 'not_started',
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT,
    "last_name" TEXT,
    "first_name" TEXT,
    "middle_name" TEXT,
    "phone" TEXT,
    "telegram" TEXT,
    "passport_url" TEXT,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- Создаем таблицу ордеров
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "user_id" UUID,
    "operator_id" UUID,
    "currency_from" TEXT NOT NULL,
    "currency_to" TEXT NOT NULL,
    "amount_from" DECIMAL(20,8) NOT NULL,
    "amount_to" DECIMAL(20,8) NOT NULL,
    "wallet_from" TEXT,
    "wallet_to" TEXT NOT NULL,
    "tx_hash" TEXT,
    "payment_details" TEXT,
    "receipt_url" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- Настраиваем связи (Внешние ключи)
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
ALTER TABLE "orders" ADD CONSTRAINT "orders_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "profiles"("id") ON DELETE SET NULL;

-- Создаем индексы для быстрого поиска
CREATE INDEX "idx_profiles_id_role" ON "profiles"("id", "role");
CREATE INDEX "idx_orders_created_at" ON "orders"("created_at" DESC);
CREATE INDEX "idx_orders_operator_id" ON "orders"("operator_id");
CREATE INDEX "idx_orders_operator_status_composite" ON "orders"("operator_id", "status");
CREATE INDEX "idx_orders_status_pending_final" ON "orders"("status", "created_at" DESC);
