"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function MainNav() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) return <div className="flex gap-6" />;

  if (user) {
    return (
      <div className="flex items-center gap-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/research"
          className="text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
        >
          Legal Research
        </Link>
        <Link
          href="/analyze"
          className="text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
        >
          Document Analysis
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <Link
        href="/analyze"
        className="text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
      >
        Document Analysis
      </Link>
      <Link
        href="/research"
        className="text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
      >
        Legal Research
      </Link>
      <Link
        href="/login"
        className="text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="rounded-lg bg-ink-950 px-4 py-2 text-sm font-medium text-parchment hover:bg-ink-800 transition-colors"
      >
        Get started
      </Link>
    </div>
  );
}
