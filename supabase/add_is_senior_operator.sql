-- Старший оператор: может передавать заявки другому оператору
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_senior_operator BOOLEAN NOT NULL DEFAULT false;
