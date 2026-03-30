import { isSupabaseConfigured } from "@/lib/supabase-env";

const CONFIG_HINT =
  "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables (Production), then redeploy. Public env vars are baked in at build time.";

const NETWORK_HINT =
  "Could not reach Supabase. Confirm the URL and anon key in Vercel match Supabase → Project Settings → API, redeploy after any change, and check the Supabase project is not paused.";

/** Map thrown errors from supabase.auth to a clear, deploy-friendly message. */
export function formatAuthClientError(err: unknown, fallback: string): string {
  if (!isSupabaseConfigured()) {
    return `Supabase is not configured for this deployment. ${CONFIG_HINT}`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower === "failed to fetch" ||
    lower.includes("networkerror") ||
    lower.includes("load failed")
  ) {
    return `${NETWORK_HINT} (${msg})`;
  }
  return msg || fallback;
}
