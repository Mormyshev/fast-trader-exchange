ALTER TABLE orders
ADD COLUMN IF NOT EXISTS operator_pseudonym_snapshot TEXT;
