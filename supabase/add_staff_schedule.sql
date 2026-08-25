-- Недельный график смен операторов (1 = понедельник … 7 = воскресенье)
CREATE TABLE IF NOT EXISTS public.staff_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday >= 1 AND weekday <= 7),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_schedule_operator_weekday UNIQUE (operator_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_staff_schedule_operator_id
  ON public.staff_schedule (operator_id);
