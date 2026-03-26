-- Firm analytics RPC + supporting indexes (run in Supabase SQL Editor)
-- Safe to re-run: CREATE OR REPLACE, IF NOT EXISTS

CREATE INDEX IF NOT EXISTS risk_flags_created_at_idx ON public.risk_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS review_decisions_created_at_idx ON public.review_decisions(created_at DESC);

CREATE OR REPLACE FUNCTION public.get_firm_analytics_dashboard(
  p_since_30 timestamptz,
  p_since_90 timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_firm uuid;
  c_contracts_30 int;
  c_contracts_90 int;
  c_flags_30 int;
  c_flags_90 int;
  avg_issues_90 numeric;
  sev_low int;
  sev_med int;
  sev_high int;
  n_accepted int;
  n_edited int;
  n_rejected int;
  n_not_reviewed int;
  total_flags int;
BEGIN
  v_firm := public.get_my_firm_id();
  IF v_firm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_firm');
  END IF;

  SELECT COUNT(*)::int INTO c_contracts_30
  FROM public.contracts
  WHERE firm_id = v_firm AND created_at >= p_since_30;

  SELECT COUNT(*)::int INTO c_contracts_90
  FROM public.contracts
  WHERE firm_id = v_firm AND created_at >= p_since_90;

  SELECT COUNT(DISTINCT rf.contract_id)::int INTO c_flags_30
  FROM public.risk_flags rf
  INNER JOIN public.contracts c ON c.id = rf.contract_id
  WHERE c.firm_id = v_firm AND rf.created_at >= p_since_30;

  SELECT COUNT(DISTINCT rf.contract_id)::int INTO c_flags_90
  FROM public.risk_flags rf
  INNER JOIN public.contracts c ON c.id = rf.contract_id
  WHERE c.firm_id = v_firm AND rf.created_at >= p_since_90;

  SELECT COALESCE(AVG(g.cnt), 0)::numeric INTO avg_issues_90
  FROM (
    SELECT rf.contract_id, COUNT(*)::int AS cnt
    FROM public.risk_flags rf
    INNER JOIN public.contracts c ON c.id = rf.contract_id
    WHERE c.firm_id = v_firm AND rf.created_at >= p_since_90
    GROUP BY rf.contract_id
  ) g;

  SELECT COUNT(*)::int INTO sev_low
  FROM public.risk_flags rf
  INNER JOIN public.contracts c ON c.id = rf.contract_id
  WHERE c.firm_id = v_firm AND rf.created_at >= p_since_90 AND rf.severity = 'low';

  SELECT COUNT(*)::int INTO sev_med
  FROM public.risk_flags rf
  INNER JOIN public.contracts c ON c.id = rf.contract_id
  WHERE c.firm_id = v_firm AND rf.created_at >= p_since_90 AND rf.severity = 'medium';

  SELECT COUNT(*)::int INTO sev_high
  FROM public.risk_flags rf
  INNER JOIN public.contracts c ON c.id = rf.contract_id
  WHERE c.firm_id = v_firm AND rf.created_at >= p_since_90 AND rf.severity = 'high';

  SELECT COUNT(*)::int INTO total_flags
  FROM public.risk_flags rf
  INNER JOIN public.contracts c ON c.id = rf.contract_id
  WHERE c.firm_id = v_firm;

  WITH latest AS (
    SELECT DISTINCT ON (rd.risk_flag_id)
      rd.risk_flag_id,
      rd.action
    FROM public.review_decisions rd
    INNER JOIN public.risk_flags rf ON rf.id = rd.risk_flag_id
    INNER JOIN public.contracts c ON c.id = rf.contract_id
    WHERE c.firm_id = v_firm
    ORDER BY rd.risk_flag_id, rd.created_at DESC
  )
  SELECT
    COUNT(*) FILTER (WHERE L.action = 'accepted')::int,
    COUNT(*) FILTER (WHERE L.action = 'edited')::int,
    COUNT(*) FILTER (WHERE L.action = 'rejected')::int
  INTO n_accepted, n_edited, n_rejected
  FROM latest L;

  SELECT COUNT(*)::int INTO n_not_reviewed
  FROM public.risk_flags rf
  INNER JOIN public.contracts c ON c.id = rf.contract_id
  WHERE c.firm_id = v_firm
    AND NOT EXISTS (
      SELECT 1 FROM public.review_decisions rd WHERE rd.risk_flag_id = rf.id
    );

  RETURN jsonb_build_object(
    'ok', true,
    'contracts_uploaded_30', c_contracts_30,
    'contracts_uploaded_90', c_contracts_90,
    'contracts_with_ai_flags_30', c_flags_30,
    'contracts_with_ai_flags_90', c_flags_90,
    'avg_issues_per_contract_90', ROUND(COALESCE(avg_issues_90, 0)::numeric, 2),
    'severity_90d', jsonb_build_object(
      'low', sev_low,
      'medium', sev_med,
      'high', sev_high
    ),
    'decision_latest', jsonb_build_object(
      'accepted', n_accepted,
      'edited', n_edited,
      'rejected', n_rejected,
      'not_reviewed', n_not_reviewed
    ),
    'total_risk_flags', total_flags
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_firm_analytics_dashboard(timestamptz, timestamptz) TO authenticated;
