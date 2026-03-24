"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    const cleanEmail = email.replace(/\s/g, "").trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!cleanEmail) {
      setError("Email is required.");
      setLoading(false);
      return;
    }
    if (!trimmedPassword) {
      setError("Password is required.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: trimmedPassword,
      });

      if (error) {
        if (error.status === 429) {
          setError("Too many attempts. Please wait and try again.");
        } else {
          setError(error.message || "Invalid email or password.");
        }
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-serif text-xl font-semibold text-ink-950">
          LegalAI
        </Link>
        <h1 className="mt-8 font-serif text-2xl font-semibold text-ink-950">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-seal hover:underline">
            Register
          </Link>
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink-700">
              Email
            </label>
            <input
              id="email"
              type="text"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-ink-200 px-4 py-2.5 text-ink-950 focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal disabled:opacity-60"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-ink-200 px-4 py-2.5 text-ink-950 focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink-950 py-2.5 text-sm font-medium text-parchment hover:bg-ink-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
