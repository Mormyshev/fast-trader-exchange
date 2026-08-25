-- Недельный график смен операторов (1 = понедельник … 7 = воскресенье)
CREATE TABLE IF NOT EXISTS "staff_schedule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "operator_id" UUID NOT NULL,
  "weekday" SMALLINT NOT NULL,
  "starts_at" TIME NOT NULL,
  "ends_at" TIME NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_schedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_schedule_operator_weekday" UNIQUE ("operator_id", "weekday"),
  CONSTRAINT "staff_schedule_weekday_check" CHECK ("weekday" >= 1 AND "weekday" <= 7)
);

ALTER TABLE "staff_schedule"
  ADD CONSTRAINT "staff_schedule_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_staff_schedule_operator_id"
  ON "staff_schedule" ("operator_id");
