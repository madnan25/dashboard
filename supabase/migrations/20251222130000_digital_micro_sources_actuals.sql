-- Digital micro-sources: Meta vs Web/WhatsApp/Google
-- Sales Ops enters source-wise actuals; totals are computed into project_actuals_channels (digital).

-- 1) Enum for digital sources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'digital_source'
  ) THEN
    CREATE TYPE public.digital_source AS ENUM ('meta','web');
  END IF;
END $$;

-- 2) Source-wise actuals table
CREATE TABLE IF NOT EXISTS public.project_actuals_digital_sources (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  source public.digital_source NOT NULL,

  leads int NOT NULL DEFAULT 0,
  qualified_leads int NOT NULL DEFAULT 0,
  meetings_scheduled int NOT NULL DEFAULT 0,
  meetings_done int NOT NULL DEFAULT 0,
  deals_won int NOT NULL DEFAULT 0,
  sqft_won int NOT NULL DEFAULT 0,

  updated_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (project_id, year, month, source)
);

DROP TRIGGER IF EXISTS set_project_actuals_digital_sources_updated_at ON public.project_actuals_digital_sources;
CREATE TRIGGER set_project_actuals_digital_sources_updated_at
BEFORE UPDATE ON public.project_actuals_digital_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.project_actuals_digital_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS actuals_digital_sources_select ON public.project_actuals_digital_sources;
CREATE POLICY actuals_digital_sources_select
ON public.project_actuals_digital_sources
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS actuals_digital_sources_write_sales_ops_or_cmo ON public.project_actuals_digital_sources;
CREATE POLICY actuals_digital_sources_write_sales_ops_or_cmo
ON public.project_actuals_digital_sources
FOR ALL
TO authenticated
USING (public.current_user_role() IN ('cmo','sales_ops'))
WITH CHECK (public.current_user_role() IN ('cmo','sales_ops'));

-- 3) Trigger to sync digital totals into project_actuals_channels
CREATE OR REPLACE FUNCTION public.sync_digital_sources_to_channel_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_year int;
  v_month int;
  s_leads int;
  s_qualified int;
  s_meetings_sched int;
  s_meetings_done int;
  s_deals int;
  s_sqft int;
BEGIN
  v_project_id := coalesce(NEW.project_id, OLD.project_id);
  v_year := coalesce(NEW.year, OLD.year);
  v_month := coalesce(NEW.month, OLD.month);

  SELECT
    coalesce(sum(s.leads), 0),
    coalesce(sum(s.qualified_leads), 0),
    coalesce(sum(s.meetings_scheduled), 0),
    coalesce(sum(s.meetings_done), 0),
    coalesce(sum(s.deals_won), 0),
    coalesce(sum(s.sqft_won), 0)
  INTO s_leads, s_qualified, s_meetings_sched, s_meetings_done, s_deals, s_sqft
  FROM public.project_actuals_digital_sources s
  WHERE s.project_id = v_project_id AND s.year = v_year AND s.month = v_month;

  INSERT INTO public.project_actuals_channels (
    project_id, year, month, channel,
    leads, qualified_leads, meetings_scheduled, meetings_done,
    deals_won, sqft_won,
    updated_by, updated_at
  )
  VALUES (
    v_project_id, v_year, v_month, 'digital',
    s_leads, s_qualified, s_meetings_sched, s_meetings_done,
    s_deals, s_sqft,
    auth.uid(), now()
  )
  ON CONFLICT (project_id, year, month, channel) DO UPDATE
    SET leads = EXCLUDED.leads,
        qualified_leads = EXCLUDED.qualified_leads,
        meetings_scheduled = EXCLUDED.meetings_scheduled,
        meetings_done = EXCLUDED.meetings_done,
        deals_won = EXCLUDED.deals_won,
        sqft_won = EXCLUDED.sqft_won,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_digital_sources_to_channel_totals ON public.project_actuals_digital_sources;
CREATE TRIGGER trg_sync_digital_sources_to_channel_totals
AFTER INSERT OR UPDATE OR DELETE ON public.project_actuals_digital_sources
FOR EACH ROW EXECUTE FUNCTION public.sync_digital_sources_to_channel_totals();

