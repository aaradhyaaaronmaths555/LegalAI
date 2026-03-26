-- =============================================================================
-- LegalAI - FULL SUPABASE SCHEMA (single file, start -> end)
-- =============================================================================
-- Run in the Supabase SQL Editor (postgres role). Safe to re-run: uses IF NOT EXISTS,
-- DROP ... IF EXISTS, and idempotent DO blocks where needed.
--
-- Includes:
--   * Auth helpers (auto-confirm email, signup -> firm + profile)
--   * Profiles, firms, multi-tenant get_my_firm_id()
--   * Contracts + Phase 3 workflow (assignee, review_status, priority)
--   * Storage bucket + firm-scoped policies
--   * Phase 2: clauses, ai_analyses, risk_flags, review_decisions, flag_comments
--   * get_firm_analytics_dashboard() RPC (firm-scoped metrics)
--
-- Supersedes: supabase-auth-setup.sql, supabase-phase1.sql, supabase-phase3-assignments.sql
-- (keep those files only as historical reference if you like)
-- =============================================================================


-- =============================================================================
-- PART A - PROFILES (linked to auth.users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users.';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);


-- =============================================================================
-- PART B - AUTO-CONFIRM EMAIL (immediate sign-in in dev / MVP)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();


-- =============================================================================
-- PART C - FIRMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- PART D - FIRM MEMBERSHIP ON PROFILES
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL;


-- =============================================================================
-- PART E - HELPER + FIRMS RLS
-- =============================================================================

ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_firm_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT firm_id FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "Users can view own firm" ON public.firms;
CREATE POLICY "Users can view own firm"
  ON public.firms FOR SELECT
  USING (id = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can update own firm" ON public.firms;
CREATE POLICY "Users can update own firm"
  ON public.firms FOR UPDATE
  USING (id = public.get_my_firm_id());


-- =============================================================================
-- PART F - NEW USER -> FIRM + PROFILE (replaces profile-only signup)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_firm_id UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );
  IF user_name = '' OR user_name IS NULL THEN user_name := 'My Practice'; END IF;

  INSERT INTO public.firms (name)
  VALUES (user_name || '''s Practice')
  RETURNING id INTO new_firm_id;

  INSERT INTO public.profiles (id, name, email, firm_id)
  VALUES (NEW.id, user_name, NEW.email, new_firm_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- PART G - UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_firm_updated ON public.firms;
CREATE TRIGGER on_firm_updated
  BEFORE UPDATE ON public.firms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PART H - BACKFILL PROFILES FROM AUTH (existing deployments)
-- =============================================================================

INSERT INTO public.profiles (id, name, email)
SELECT
  id,
  COALESCE(
    NULLIF(trim(raw_user_meta_data->>'name'), ''),
    NULLIF(trim(raw_user_meta_data->>'full_name'), ''),
    split_part(email, '@', 1)
  ),
  email
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  name = COALESCE(EXCLUDED.name, public.profiles.name),
  email = COALESCE(EXCLUDED.email, public.profiles.email);


-- =============================================================================
-- PART I - BACKFILL FIRMS FOR PROFILES MISSING firm_id
-- =============================================================================

DO $$
DECLARE
  prof RECORD;
  new_firm_id UUID;
BEGIN
  FOR prof IN SELECT id, name, email FROM public.profiles WHERE firm_id IS NULL
  LOOP
    INSERT INTO public.firms (name)
    VALUES (
      COALESCE(NULLIF(trim(prof.name), ''), split_part(prof.email, '@', 1), 'My Practice') || '''s Practice'
    )
    RETURNING id INTO new_firm_id;
    UPDATE public.profiles SET firm_id = new_firm_id WHERE id = prof.id;
  END LOOP;
END;
$$;


-- =============================================================================
-- PART J - CONFIRM EXISTING AUTH USERS
-- =============================================================================

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;


-- =============================================================================
-- PART K - ENUMS (contract file pipeline + types)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_type') THEN
    CREATE TYPE public.contract_type AS ENUM ('nda', 'msa', 'employment_agreement');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
    CREATE TYPE public.contract_status AS ENUM ('uploaded', 'processing', 'completed', 'failed');
  END IF;
END;
$$;


-- =============================================================================
-- PART L - CONTRACTS (file pipeline + firm scope)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  contract_type public.contract_type NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'uploaded',
  raw_text TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contracts_firm_id_idx ON public.contracts(firm_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON public.contracts(status);
CREATE INDEX IF NOT EXISTS contracts_created_at_idx ON public.contracts(created_at DESC);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own firm contracts" ON public.contracts;
CREATE POLICY "Users can view own firm contracts"
  ON public.contracts FOR SELECT
  USING (firm_id = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can insert own firm contracts" ON public.contracts;
CREATE POLICY "Users can insert own firm contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (firm_id = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can update own firm contracts" ON public.contracts;
CREATE POLICY "Users can update own firm contracts"
  ON public.contracts FOR UPDATE
  USING (firm_id = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can delete own firm contracts" ON public.contracts;
CREATE POLICY "Users can delete own firm contracts"
  ON public.contracts FOR DELETE
  USING (firm_id = public.get_my_firm_id());

DROP TRIGGER IF EXISTS on_contract_updated ON public.contracts;
CREATE TRIGGER on_contract_updated
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PART M - PHASE 3: ASSIGNMENTS + REVIEW WORKFLOW (on contracts)
-- =============================================================================
-- Human workflow: who is reviewing + status + priority (not the same as file pipeline status).

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'not_started';

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS priority TEXT;

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_review_status_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_review_status_check
    CHECK (review_status IN ('not_started', 'in_progress', 'completed'));

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_priority_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_priority_check
    CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high'));

CREATE INDEX IF NOT EXISTS contracts_assigned_to_idx ON public.contracts(assigned_to);
CREATE INDEX IF NOT EXISTS contracts_review_status_idx ON public.contracts(review_status);
CREATE INDEX IF NOT EXISTS contracts_firm_review_idx ON public.contracts(firm_id, review_status);

CREATE OR REPLACE FUNCTION public.check_contract_assignee_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.assigned_to AND p.firm_id = NEW.firm_id
    ) THEN
      RAISE EXCEPTION 'assigned_to must be a user in the same firm as the contract';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_assignee_firm ON public.contracts;
CREATE TRIGGER trg_contract_assignee_firm
  BEFORE INSERT OR UPDATE OF assigned_to, firm_id ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_contract_assignee_firm();


-- =============================================================================
-- PART N - PROFILES RLS: FIRM MEMBERS VISIBLE (assignee names / dropdowns)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view firm member profiles" ON public.profiles;
CREATE POLICY "Users can view firm member profiles"
  ON public.profiles FOR SELECT
  USING (firm_id IS NOT NULL AND firm_id = public.get_my_firm_id());


-- =============================================================================
-- PART O - STORAGE BUCKET
-- =============================================================================

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'contracts',
    'contracts',
    false,
    10485760,
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  );
EXCEPTION
  WHEN unique_violation THEN NULL;
END;
$$;


-- =============================================================================
-- PART P - STORAGE POLICIES (path: firm_id/...)
-- =============================================================================

DROP POLICY IF EXISTS "Users can upload to own firm" ON storage.objects;
CREATE POLICY "Users can upload to own firm"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );

DROP POLICY IF EXISTS "Users can read own firm files" ON storage.objects;
CREATE POLICY "Users can read own firm files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );

DROP POLICY IF EXISTS "Users can delete own firm files" ON storage.objects;
CREATE POLICY "Users can delete own firm files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = public.get_my_firm_id()::text
  );


-- =============================================================================
-- PART Q - CLAUSES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  position INT NOT NULL,
  heading TEXT,
  raw_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clauses_position_positive CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS clauses_contract_id_idx ON public.clauses(contract_id);

ALTER TABLE public.clauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own firm clauses" ON public.clauses;
CREATE POLICY "Users can view own firm clauses"
  ON public.clauses FOR SELECT
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can insert own firm clauses" ON public.clauses;
CREATE POLICY "Users can insert own firm clauses"
  ON public.clauses FOR INSERT
  WITH CHECK ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can update own firm clauses" ON public.clauses;
CREATE POLICY "Users can update own firm clauses"
  ON public.clauses FOR UPDATE
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can delete own firm clauses" ON public.clauses;
CREATE POLICY "Users can delete own firm clauses"
  ON public.clauses FOR DELETE
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());


-- =============================================================================
-- PART R - AI_ANALYSES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_analyses_status_check CHECK (status IN ('pending', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS ai_analyses_contract_id_idx ON public.ai_analyses(contract_id);

ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own firm ai_analyses" ON public.ai_analyses;
CREATE POLICY "Users can view own firm ai_analyses"
  ON public.ai_analyses FOR SELECT
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can insert own firm ai_analyses" ON public.ai_analyses;
CREATE POLICY "Users can insert own firm ai_analyses"
  ON public.ai_analyses FOR INSERT
  WITH CHECK ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can update own firm ai_analyses" ON public.ai_analyses;
CREATE POLICY "Users can update own firm ai_analyses"
  ON public.ai_analyses FOR UPDATE
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can delete own firm ai_analyses" ON public.ai_analyses;
CREATE POLICY "Users can delete own firm ai_analyses"
  ON public.ai_analyses FOR DELETE
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());


-- =============================================================================
-- PART S - RISK_FLAGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_id UUID REFERENCES public.clauses(id) ON DELETE SET NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  explanation TEXT NOT NULL,
  suggestion TEXT,
  source_start INT,
  source_end INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT risk_flags_severity_check CHECK (severity IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS risk_flags_contract_id_idx ON public.risk_flags(contract_id);
CREATE INDEX IF NOT EXISTS risk_flags_clause_id_idx ON public.risk_flags(clause_id);
CREATE INDEX IF NOT EXISTS risk_flags_created_at_idx ON public.risk_flags(created_at DESC);

ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own firm risk_flags" ON public.risk_flags;
CREATE POLICY "Users can view own firm risk_flags"
  ON public.risk_flags FOR SELECT
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can insert own firm risk_flags" ON public.risk_flags;
CREATE POLICY "Users can insert own firm risk_flags"
  ON public.risk_flags FOR INSERT
  WITH CHECK ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can update own firm risk_flags" ON public.risk_flags;
CREATE POLICY "Users can update own firm risk_flags"
  ON public.risk_flags FOR UPDATE
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());

DROP POLICY IF EXISTS "Users can delete own firm risk_flags" ON public.risk_flags;
CREATE POLICY "Users can delete own firm risk_flags"
  ON public.risk_flags FOR DELETE
  USING ((SELECT firm_id FROM public.contracts WHERE id = contract_id) = public.get_my_firm_id());


-- =============================================================================
-- PART T - REVIEW_DECISIONS (per risk flag)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_flag_id UUID NOT NULL REFERENCES public.risk_flags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  edited_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_decisions_action_check CHECK (action IN ('accepted', 'edited', 'rejected'))
);

CREATE INDEX IF NOT EXISTS review_decisions_risk_flag_id_idx ON public.review_decisions(risk_flag_id);
CREATE INDEX IF NOT EXISTS review_decisions_user_id_idx ON public.review_decisions(user_id);
CREATE INDEX IF NOT EXISTS review_decisions_created_at_idx ON public.review_decisions(created_at DESC);

ALTER TABLE public.review_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own firm review_decisions" ON public.review_decisions;
CREATE POLICY "Users can view own firm review_decisions"
  ON public.review_decisions FOR SELECT
  USING (
    (SELECT c.firm_id FROM public.risk_flags rf
     JOIN public.contracts c ON c.id = rf.contract_id
     WHERE rf.id = risk_flag_id) = public.get_my_firm_id()
  );

DROP POLICY IF EXISTS "Users can insert own firm review_decisions" ON public.review_decisions;
CREATE POLICY "Users can insert own firm review_decisions"
  ON public.review_decisions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT c.firm_id FROM public.risk_flags rf
         JOIN public.contracts c ON c.id = rf.contract_id
         WHERE rf.id = risk_flag_id) = public.get_my_firm_id()
  );

DROP POLICY IF EXISTS "Users can update own firm review_decisions" ON public.review_decisions;
CREATE POLICY "Users can update own firm review_decisions"
  ON public.review_decisions FOR UPDATE
  USING (
    (SELECT c.firm_id FROM public.risk_flags rf
     JOIN public.contracts c ON c.id = rf.contract_id
     WHERE rf.id = risk_flag_id) = public.get_my_firm_id()
  );

DROP POLICY IF EXISTS "Users can delete own firm review_decisions" ON public.review_decisions;
CREATE POLICY "Users can delete own firm review_decisions"
  ON public.review_decisions FOR DELETE
  USING (
    (SELECT c.firm_id FROM public.risk_flags rf
     JOIN public.contracts c ON c.id = rf.contract_id
     WHERE rf.id = risk_flag_id) = public.get_my_firm_id()
  );


-- =============================================================================
-- PART U - FLAG_COMMENTS (discussion thread per AI risk flag)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.flag_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_flag_id UUID NOT NULL REFERENCES public.risk_flags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flag_comments_risk_flag_id_idx ON public.flag_comments(risk_flag_id);
CREATE INDEX IF NOT EXISTS flag_comments_created_at_idx ON public.flag_comments(created_at);

ALTER TABLE public.flag_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own firm flag_comments" ON public.flag_comments;
CREATE POLICY "Users can view own firm flag_comments"
  ON public.flag_comments FOR SELECT
  USING (
    (SELECT c.firm_id FROM public.risk_flags rf
     JOIN public.contracts c ON c.id = rf.contract_id
     WHERE rf.id = risk_flag_id) = public.get_my_firm_id()
  );

DROP POLICY IF EXISTS "Users can insert own firm flag_comments" ON public.flag_comments;
CREATE POLICY "Users can insert own firm flag_comments"
  ON public.flag_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT c.firm_id FROM public.risk_flags rf
         JOIN public.contracts c ON c.id = rf.contract_id
         WHERE rf.id = risk_flag_id) = public.get_my_firm_id()
  );


-- =============================================================================
-- PART V - FIRM ANALYTICS (read-only RPC)
-- =============================================================================

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


-- =============================================================================
-- DONE
-- =============================================================================
