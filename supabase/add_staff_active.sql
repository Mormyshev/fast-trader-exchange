-- Активный / неактивный режим оператора и админа
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS staff_active BOOLEAN NOT NULL DEFAULT false;
