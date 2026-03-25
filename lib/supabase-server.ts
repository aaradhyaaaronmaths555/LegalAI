import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Supabase client using the caller's JWT so RLS applies (get_my_firm_id). */
export function createSupabaseFromBearer(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
