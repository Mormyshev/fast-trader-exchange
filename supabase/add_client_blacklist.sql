ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "blacklist_reason" TEXT,
ADD COLUMN IF NOT EXISTS "blacklisted_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "blacklisted_by" UUID;

CREATE INDEX IF NOT EXISTS "idx_profiles_is_blacklisted"
ON "profiles" ("is_blacklisted")
WHERE "is_blacklisted" = true;
