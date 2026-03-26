-- Additive migration: flag_comments (run in Supabase SQL Editor if schema already applied)
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS

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
