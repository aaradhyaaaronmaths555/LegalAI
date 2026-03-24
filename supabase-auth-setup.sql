-- ============================================
-- LegalAI: Auth setup for Login & Register
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (idempotent)
-- ============================================

-- --------------------------------------------
-- 1. PROFILES TABLE
-- --------------------------------------------
-- Extends auth.users with display name and synced email.
-- Linked to auth.users via id (UUID).
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users. Auto-created on signup.';

-- --------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS)
-- --------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for re-runnable script)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (e.g. change name)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- --------------------------------------------
-- 3. AUTO-CONFIRM EMAIL (no confirmation required)
-- --------------------------------------------
-- Sets email_confirmed_at on signup so users can sign in immediately.
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

-- --------------------------------------------
-- 4. SIGNUP TRIGGER (profiles)
-- --------------------------------------------
-- Auto-creates a profile row when a new user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      ''
    ),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------
-- 5. UPDATED_AT TRIGGER
-- --------------------------------------------
-- Keeps updated_at in sync when profile is modified.
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

-- --------------------------------------------
-- 6. INDEXES (optional, for performance)
-- --------------------------------------------
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- --------------------------------------------
-- 7. CONFIRM EXISTING USERS (fix "Invalid login credentials")
-- --------------------------------------------
-- Users who signed up before auto-confirm need email_confirmed_at set.
-- Run with service role or as superuser (Supabase SQL Editor uses postgres).
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- --------------------------------------------
-- 8. BACKFILL EXISTING USERS (profiles)
-- --------------------------------------------
INSERT INTO public.profiles (id, name, email)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'full_name',
    ''
  ),
  email
FROM auth.users
ON CONFLICT (id) DO NOTHING;
