-- Поля KYC: серия/номер документа, селфи и доп. файл. Выполните в SQL Editor Supabase.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selfie_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extra_document_url TEXT;
