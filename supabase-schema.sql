-- ============================================
-- LegalAI: Complete Database Schema (A to Z)
-- Run this in Supabase SQL Editor
-- Combines: Auth, Profiles, Firms, Contracts, Storage
-- Safe to run multiple times (idempotent)
-- ============================================

-- ===========================================
-- PART A: PROFILES
-- ===========================================

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
  ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- ===========================================
-- PART B: AUTO-CONFIRM EMAIL
-- ===========================================

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

-- ===========================================
-- PART C: FIRMS (must exist before firm_id on profiles)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- PART D: ADD FIRM_ID TO PROFILES
-- ===========================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL;

-- ===========================================
-- PART E: HELPER + FIRMS RLS
-- ===========================================

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

-- ===========================================
-- PART F: SIGNUP TRIGGER (creates firm + profile)
-- ===========================================

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

-- ===========================================
-- PART G: UPDATED_AT TRIGGER
-- ===========================================

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

-- ===========================================
-- PART H: BACKFILL PROFILES FROM AUTH USERS
-- ===========================================

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

-- ===========================================
-- PART I: BACKFILL FIRMS FOR EXISTING PROFILES
-- ===========================================

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

-- ===========================================
-- PART J: CONFIRM EXISTING AUTH USERS
-- ===========================================

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ===========================================
-- PART K: CONTRACT TYPES (ENUMS)
-- ===========================================

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

-- ===========================================
-- PART L: CONTRACTS TABLE
-- ===========================================

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

-- ===========================================
-- PART M: STORAGE BUCKET
-- ===========================================

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'contracts',
    'contracts',
    false,
    10485760,  -- 10MB
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  );
EXCEPTION
  WHEN unique_violation THEN NULL;
END;
$$;

-- ===========================================
-- PART N: STORAGE POLICIES
-- ===========================================

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

-- ===========================================
-- DONE
-- ===========================================
