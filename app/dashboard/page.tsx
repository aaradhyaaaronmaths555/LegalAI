"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Contract, Firm } from "@/lib/types";
import { CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/types";

export default function DashboardPage() {
  const [firm, setFirm] = useState<Firm | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("firm_id")
        .eq("id", user.id)
        .single();

      if (!profile?.firm_id) {
        setLoading(false);
        return;
      }

      const { data: firmData } = await supabase
        .from("firms")
        .select("*")
        .eq("id", profile.firm_id)
        .single();

      setFirm(firmData);

      const { data: contractsData } = await supabase
        .from("contracts")
        .select("*")
        .eq("firm_id", profile.firm_id)
        .order("created_at", { ascending: false })
        .limit(20);

      setContracts(contractsData || []);

      const pending = (contractsData || []).filter(
        (c) => c.status === "uploaded" || c.status === "processing"
      ).length;
      const completed = (contractsData || []).filter(
        (c) => c.status === "completed"
      ).length;

      setCounts({
        total: contractsData?.length ?? 0,
        pending,
        completed,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-ink-600">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-950">
            Dashboard
          </h1>
          <p className="mt-1 text-ink-600">
            {firm?.name ?? "Your Practice"}
          </p>
        </div>
        <Link
          href="/analyze"
          className="inline-flex items-center gap-2 rounded-lg bg-ink-950 px-5 py-2.5 text-sm font-medium text-parchment hover:bg-ink-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Document Analysis
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-ink-200/60 bg-white p-5">
          <p className="text-sm font-medium text-ink-600">Total contracts</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink-950">{counts.total}</p>
        </div>
        <div className="rounded-xl border border-ink-200/60 bg-white p-5">
          <p className="text-sm font-medium text-ink-600">Pending</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink-950">{counts.pending}</p>
        </div>
        <div className="rounded-xl border border-ink-200/60 bg-white p-5">
          <p className="text-sm font-medium text-ink-600">Completed</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink-950">{counts.completed}</p>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg font-semibold text-ink-950 mb-4">Recent contracts</h2>
        {contracts.length === 0 ? (
          <div className="rounded-xl border border-ink-200/60 bg-white p-12 text-center">
            <p className="text-ink-600">No contracts yet.</p>
            <Link
              href="/analyze"
              className="mt-4 inline-block text-sm font-medium text-seal hover:underline"
            >
              Analyze your first document
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-ink-200/60 bg-white">
            <table className="min-w-full divide-y divide-ink-200/60">
              <thead>
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/contracts/${c.id}`}
                        className="font-medium text-ink-950 hover:text-seal"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-600">
                      {CONTRACT_TYPE_LABELS[c.contract_type]}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : c.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {CONTRACT_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-600">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
