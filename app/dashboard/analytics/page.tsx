"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FirmAnalyticsPayload } from "@/lib/analytics";
import { REVIEW_STATUS_LABEL } from "@/lib/review-status";

export default function AnalyticsPage() {
  const [data, setData] = useState<FirmAnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const res = await fetch("/api/analytics", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json()) as FirmAnalyticsPayload | { ok: false; error: string };
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        setError("error" in json ? json.error : "Could not load analytics.");
        setLoading(false);
        return;
      }
      setData(json);
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-ink-600">Loading analytics…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-ink-600 hover:text-ink-950 inline-block"
        >
          ← Back to dashboard
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-6 text-sm text-red-900">
          {error ?? "No data."}
        </div>
      </div>
    );
  }

  const sev = data.severity_90d;
  const sevTotal = sev.low + sev.medium + sev.high;
  const dec = data.decision_latest;
  const decTotal = dec.accepted + dec.edited + dec.rejected + dec.not_reviewed;

  function barPct(n: number, total: number) {
    if (total <= 0) return 0;
    return Math.round((n / total) * 100);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-ink-600 hover:text-ink-950 inline-block mb-2"
          >
            ← Back to dashboard
          </Link>
          <h1 className="font-serif text-2xl font-semibold text-ink-950">Analytics</h1>
          <p className="mt-1 text-sm text-ink-600 max-w-xl">
            High-level metrics for your firm. AI issue counts use the last 90 days; review status
            reflects the latest decision on each issue (all time).
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-ink-200/60 bg-white overflow-hidden shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200/60 bg-ink-50/80">
              <th className="px-5 py-3 text-left font-medium text-ink-700">Metric</th>
              <th className="px-5 py-3 text-right font-medium text-ink-700 w-28">Last 30 days</th>
              <th className="px-5 py-3 text-right font-medium text-ink-700 w-28">Last 90 days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            <tr>
              <td className="px-5 py-3 text-ink-800">Contracts uploaded</td>
              <td className="px-5 py-3 text-right font-medium text-ink-950 tabular-nums">
                {data.contracts_uploaded_30}
              </td>
              <td className="px-5 py-3 text-right font-medium text-ink-950 tabular-nums">
                {data.contracts_uploaded_90}
              </td>
            </tr>
            <tr>
              <td className="px-5 py-3 text-ink-800">
                Contracts with AI issues{" "}
                <span className="font-normal text-ink-500">(at least one flag in period)</span>
              </td>
              <td className="px-5 py-3 text-right font-medium text-ink-950 tabular-nums">
                {data.contracts_with_ai_flags_30}
              </td>
              <td className="px-5 py-3 text-right font-medium text-ink-950 tabular-nums">
                {data.contracts_with_ai_flags_90}
              </td>
            </tr>
            <tr>
              <td className="px-5 py-3 text-ink-800">
                Avg AI issues per contract (90d, among contracts with ≥1 flag in 90d)
              </td>
              <td className="px-5 py-3 text-right text-ink-400">—</td>
              <td className="px-5 py-3 text-right font-medium text-ink-950 tabular-nums">
                {data.avg_issues_per_contract_90}
              </td>
            </tr>
            <tr>
              <td className="px-5 py-3 text-ink-800">Total AI issues on record (all time)</td>
              <td className="px-5 py-3 text-right text-ink-400">—</td>
              <td className="px-5 py-3 text-right font-medium text-ink-950 tabular-nums">
                {data.total_risk_flags}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-ink-200/60 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-semibold text-ink-950 mb-1">AI issue severity</h2>
          <p className="text-xs text-ink-500 mb-4">Flags created in the last 90 days</p>
          <div className="space-y-4">
            {(
              [
                { key: "low" as const, label: "Low", className: "bg-ink-400" },
                { key: "medium" as const, label: "Medium", className: "bg-amber-500" },
                { key: "high" as const, label: "High", className: "bg-red-500" },
              ] as const
            ).map(({ key, label, className }) => {
              const n = sev[key];
              const pct = barPct(n, sevTotal);
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm text-ink-700 mb-1">
                    <span>{label}</span>
                    <span className="tabular-nums font-medium text-ink-950">{n}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${className} transition-[width] duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-ink-200/60 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-semibold text-ink-950 mb-1">Review status</h2>
          <p className="text-xs text-ink-500 mb-4">Latest decision per issue (all issues)</p>
          <div className="space-y-4">
            {(
              [
                { key: "accepted" as const, label: REVIEW_STATUS_LABEL.accepted, className: "bg-emerald-500" },
                { key: "edited" as const, label: REVIEW_STATUS_LABEL.edited, className: "bg-amber-500" },
                { key: "rejected" as const, label: REVIEW_STATUS_LABEL.rejected, className: "bg-red-500" },
                { key: "not_reviewed" as const, label: REVIEW_STATUS_LABEL.not_reviewed, className: "bg-ink-300" },
              ] as const
            ).map(({ key, label, className }) => {
              const n = dec[key];
              const pct = barPct(n, decTotal);
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm text-ink-700 mb-1">
                    <span>{label}</span>
                    <span className="tabular-nums font-medium text-ink-950">{n}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${className} transition-[width] duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
