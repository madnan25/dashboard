-- Admin viewer access: Intelligence Desk (read + refresh snapshot)

-- 1) Intelligence reports: allow admin_viewer read + insert (refresh).
DROP POLICY IF EXISTS intelligence_reports_cmo_read ON public.intelligence_reports;
CREATE POLICY intelligence_reports_cmo_read
  ON public.intelligence_reports
  FOR SELECT
  USING (public.current_user_role() IN ('cmo','admin_viewer'));

DROP POLICY IF EXISTS intelligence_reports_cmo_insert ON public.intelligence_reports;
CREATE POLICY intelligence_reports_cmo_insert
  ON public.intelligence_reports
  FOR INSERT
  WITH CHECK (public.current_user_role() IN ('cmo','admin_viewer'));

-- Keep update restricted to CMO (existing policy).

-- 2) Allow admin_viewer to read sync settings via RPC (timezone needed for refresh).
CREATE OR REPLACE FUNCTION public.get_intelligence_sync_settings()
RETURNS TABLE (
  timezone text,
  sync_time time,
  schedule_utc text,
  jobname text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
BEGIN
  IF public.current_user_role() NOT IN ('cmo','admin_viewer') THEN
    RAISE EXCEPTION 'CMO only';
  END IF;

  INSERT INTO public.intelligence_sync_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  -- Best-effort bootstrap from existing cron job if missing.
  UPDATE public.intelligence_sync_settings s
  SET
    edge_function_url = coalesce(s.edge_function_url, substring(j.command from 'net\.http_get\(''([^'']+)''')),
    cron_secret = coalesce(s.cron_secret, substring(j.command from E'\\\\\"x-cron-secret\\\\\":\\\\\"([^\\\\\"]+)\\\\\"')),
    schedule_utc = coalesce(s.schedule_utc, j.schedule),
    updated_at = now()
  FROM cron.job j
  WHERE s.id = 1
    AND j.jobname = s.jobname
    AND (s.edge_function_url IS NULL OR s.cron_secret IS NULL OR s.schedule_utc IS NULL);

  RETURN QUERY
  SELECT s.timezone, s.sync_time, s.schedule_utc, s.jobname, s.updated_at
  FROM public.intelligence_sync_settings s
  WHERE s.id = 1;
END;
$$;

