-- Порядковый номер заявки: «Заявка № 100001». Выполните в SQL Editor Supabase.

CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START WITH 100001;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INTEGER;

WITH numbered AS (
  SELECT
    id,
    100000 + ROW_NUMBER() OVER (ORDER BY created_at ASC) AS n
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders o
SET order_number = numbered.n
FROM numbered
WHERE o.id = numbered.id;

SELECT setval(
  'orders_order_number_seq',
  GREATEST(
    100001,
    COALESCE((SELECT MAX(order_number) FROM orders), 100000) + 1
  ),
  false
);

ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('orders_order_number_seq');

DO $$
BEGIN
  ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON orders (order_number);
