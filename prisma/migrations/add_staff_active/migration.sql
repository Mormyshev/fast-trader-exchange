-- Активный / неактивный режим оператора и админа
ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "staff_active" BOOLEAN NOT NULL DEFAULT false;
