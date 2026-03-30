/**
 * Public Supabase URL + anon key for the browser and server route handlers.
 * Vercel / CI runs `next build` without `.env.local`; `createClient` requires
 * non-empty values, so we use placeholders only when env is unset (build-time
 * prerender). Production traffic must set NEXT_PUBLIC_SUPABASE_* in Vercel env.
 */
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
/** JWT-shaped placeholder (invalid for real API calls; satisfies client ctor). */
const PLACEHOLDER_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export function getSupabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return v || PLACEHOLDER_URL;
}

export function getSupabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return v || PLACEHOLDER_ANON;
}

/** True when real project URL was set at build time (NEXT_PUBLIC_* is inlined by Next). */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
}
