"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Contract, DashboardReviewFilter, Firm } from "@/lib/types";
import {
  CONTRACT_PRIORITY_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  REVIEW_WORKFLOW_LABELS,
} from "@/lib/types";

export default function DashboardPage() {
  const [firm, setFirm] = useState<Firm | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<DashboardReviewFilter>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

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

      let contractsData: Contract[] | null = null;
      const withAssignee = await supabase
        .from("contracts")
        .select(
          `
          *,
          assignee:profiles!contracts_assigned_to_fkey (
            id,
            name,
            email
          )
        `
        )
        .eq("firm_id", profile.firm_id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (withAssignee.error) {
        const plain = await supabase
          .from("contracts")
          .select("*")
          .eq("firm_id", profile.firm_id)
          .order("created_at", { ascending: false })
          .limit(100);
        const rows = (plain.data as Contract[] | null) ?? [];
        const ids = Array.from(
          new Set(rows.map((c) => c.assigned_to).filter((x): x is string => Boolean(x)))
        );
        let assigneeMap: Record<string, { id: string; name: string | null; email: string | null }> =
          {};
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", ids);
          assigneeMap = Object.fromEntries(
            ((profs ?? []) as { id: string; name: string | null; email: string | null }[]).map(
              (p) => [p.id, p]
            )
          );
        }
        contractsData = rows.map((c) => ({
          ...c,
          assignee: c.assigned_to ? assigneeMap[c.assigned_to] ?? null : null,
        }));
      } else {
        contractsData = (withAssignee.data as Contract[] | null) ?? [];
      }

      setContracts(contractsData || []);

      const list = contractsData || [];
      const pending = list.filter(
        (c) => c.status === "uploaded" || c.status === "processing"
      ).length;
      const completed = list.filter((c) => c.status === "completed").length;

      setCounts({
        total: list.length,
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

  const filterLabels: Record<DashboardReviewFilter, string> = {
    all: "All",
    mine: "My contracts",
    needs_review: "Needs review",
    completed: "Completed",
  };

  const filteredContracts = contracts.filter((c) => {
    const rs = c.review_status ?? "not_started";
    if (reviewFilter === "all") return true;
    if (reviewFilter === "mine") return c.assigned_to === currentUserId;
    if (reviewFilter === "needs_review")
      return rs === "not_started" || rs === "in_progress";
    if (reviewFilter === "completed") return rs === "completed";
    return true;
  });

  function assigneeLabel(c: Contract): string {
    if (!c.assigned_to) return "—";
    const a = c.assignee;
    if (a?.name?.trim()) return a.name;
    if (a?.email) return a.email;
    return "Assigned";
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
          <Link
            href="/dashboard/analytics"
            className="mt-2 inline-block text-sm font-medium text-seal hover:underline"
          >
            View firm analytics →
          </Link>
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
        {contracts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(filterLabels) as DashboardReviewFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setReviewFilter(key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  reviewFilter === key
                    ? "bg-ink-950 text-parchment"
                    : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                }`}
              >
                {filterLabels[key]}
              </button>
            ))}
          </div>
        )}
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">File status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Assignee</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Review</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60">
                {filteredContracts.length === 0 && contracts.length > 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-ink-600">
                      No contracts match this filter.
                    </td>
                  </tr>
                ) : null}
                {filteredContracts.map((c) => (
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
                    <td className="px-6 py-4 text-sm text-ink-700 max-w-[10rem] truncate" title={assigneeLabel(c)}>
                      {assigneeLabel(c)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-800">
                        {REVIEW_WORKFLOW_LABELS[c.review_status ?? "not_started"]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-600">
                      {c.priority ? CONTRACT_PRIORITY_LABELS[c.priority] : "—"}
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
