-- Add "Not contacted" to digital micro-sources.

ALTER TABLE public.project_actuals_digital_sources
ADD COLUMN IF NOT EXISTS not_contacted int NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_actuals_digital_sources_not_contacted_nonneg'
  ) THEN
    ALTER TABLE public.project_actuals_digital_sources
      ADD CONSTRAINT project_actuals_digital_sources_not_contacted_nonneg
      CHECK (not_contacted >= 0);
  END IF;
END $$;


