"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Clause, Contract, ReviewDecision, RiskFlag } from "@/lib/types";
import { CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/types";

export default function ContractDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [contract, setContract] = useState<Contract | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  /** Latest review_decisions per risk_flag_id (by created_at desc). */
  const [decisionByFlagId, setDecisionByFlagId] = useState<
    Record<string, ReviewDecision>
  >({});
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingFlagId, setSavingFlagId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setContract(null);
        setClauses([]);
        setLoading(false);
        return;
      }

      setContract(data);

      const { data: urlData } = await supabase.storage
        .from("contracts")
        .createSignedUrl(data.file_path, 3600);
      setDownloadUrl(urlData?.signedUrl ?? null);

      const { data: clauseRows } = await supabase
        .from("clauses")
        .select("*")
        .eq("contract_id", id)
        .order("position", { ascending: true });

      setClauses((clauseRows as Clause[] | null) ?? []);

      const { data: flagRows } = await supabase
        .from("risk_flags")
        .select("*")
        .eq("contract_id", id)
        .order("created_at", { ascending: true });

      const flags = (flagRows as RiskFlag[] | null) ?? [];
      setRiskFlags(flags);

      const flagIds = flags.map((f) => f.id);
      if (flagIds.length > 0) {
        const { data: decRows } = await supabase
          .from("review_decisions")
          .select("*")
          .in("risk_flag_id", flagIds)
          .order("created_at", { ascending: false });

        const next: Record<string, ReviewDecision> = {};
        for (const row of (decRows as ReviewDecision[] | null) ?? []) {
          if (!next[row.risk_flag_id]) {
            next[row.risk_flag_id] = row;
          }
        }
        setDecisionByFlagId(next);
      } else {
        setDecisionByFlagId({});
      }

      setLoading(false);
    }
    load();
  }, [id]);

  async function handleExtractClauses() {
    setExtractError(null);
    setExtractLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setExtractError("Please sign in again.");
        setExtractLoading(false);
        return;
      }

      const res = await fetch(`/api/contracts/${id}/extract`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        bytes?: number;
      };
      if (!res.ok) {
        const hint =
          json.bytes != null ? ` (downloaded ${json.bytes} bytes)` : "";
        setExtractError((json.error ?? "Extraction failed") + hint);
        setExtractLoading(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Extraction failed");
      setExtractLoading(false);
    }
  }

  async function handleRunAnalysis() {
    setAnalyzeError(null);
    setAnalyzeLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setAnalyzeError("Please sign in again.");
        setAnalyzeLoading(false);
        return;
      }
      const res = await fetch(`/api/contracts/${id}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAnalyzeError(json.error ?? "Analysis failed");
        setAnalyzeLoading(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
      setAnalyzeLoading(false);
    }
  }

  async function submitReview(
    riskFlagId: string,
    action: ReviewDecision["action"],
    editedText: string | null
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }
    setSavingFlagId(riskFlagId);
    try {
      const { data, error } = await supabase
        .from("review_decisions")
        .insert({
          risk_flag_id: riskFlagId,
          user_id: user.id,
          action,
          edited_text: editedText,
        })
        .select()
        .single();

      if (error) {
        console.error("review_decisions insert", error);
        return;
      }
      const row = data as ReviewDecision;
      setDecisionByFlagId((prev) => ({ ...prev, [riskFlagId]: row }));
      setEditingFlagId(null);
      setEditDraft("");
    } finally {
      setSavingFlagId(null);
    }
  }

  function startEdit(f: RiskFlag) {
    setEditingFlagId(f.id);
    setEditDraft(f.suggestion ?? "");
  }

  function decisionStatusLabel(d: ReviewDecision) {
    if (d.action === "accepted") return "Accepted";
    if (d.action === "rejected") return "Rejected";
    return "Edited";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-ink-600">Loading contract…</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-ink-600">Contract not found.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-seal hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const supportsAi =
    contract.contract_type === "nda" || contract.contract_type === "msa";
  const showAnalyzeCta = supportsAi && clauses.length > 0;

  function clauseAnchorForFlag(flag: RiskFlag): string | null {
    if (!flag.clause_id) return null;
    const c = clauses.find((x) => x.id === flag.clause_id);
    return c ? `#clause-${c.position}` : null;
  }

  function severityClass(s: RiskFlag["severity"]) {
    if (s === "high") return "bg-red-100 text-red-900";
    if (s === "medium") return "bg-amber-100 text-amber-900";
    return "bg-ink-100 text-ink-800";
  }

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-ink-600 hover:text-ink-950 inline-block"
      >
        ← Back to dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-950">
            {contract.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
              {CONTRACT_TYPE_LABELS[contract.contract_type]}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                contract.status === "completed"
                  ? "bg-green-100 text-green-800"
                  : contract.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {CONTRACT_STATUS_LABELS[contract.status]}
            </span>
          </div>
        </div>
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-ink-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 transition-colors"
          >
            Download file
          </a>
        )}
      </div>

      <div className="rounded-xl border border-ink-200/60 bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-950 mb-4">File info</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-ink-500">File name</dt>
            <dd className="font-medium text-ink-950">{contract.file_name}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Uploaded</dt>
            <dd className="font-medium text-ink-950">
              {new Date(contract.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-ink-200/60 bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink-950">Clauses</h2>
            <p className="mt-1 text-sm text-ink-600">
              Extract text from the file and split into clauses for review.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExtractClauses}
            disabled={extractLoading}
            className="shrink-0 rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-medium text-parchment hover:bg-ink-800 disabled:opacity-60"
          >
            {extractLoading ? "Extracting…" : "Extract clauses"}
          </button>
        </div>
        {extractError && (
          <p className="mb-4 text-sm text-red-700">{extractError}</p>
        )}
        {clauses.length === 0 ? (
          <p className="text-sm text-ink-500">No clauses yet. Click Extract clauses.</p>
        ) : (
          <ol className="space-y-5 border-t border-ink-100 pt-5">
            {clauses.map((c) => (
              <li
                key={c.id}
                id={`clause-${c.position}`}
                className="scroll-mt-28 border-l-2 border-seal/30 pl-4"
              >
                <div className="flex flex-wrap gap-2 items-baseline">
                  <span className="font-serif text-sm font-semibold text-ink-950">{c.position}.</span>
                  {c.heading && (
                    <span className="font-serif text-sm font-medium text-ink-800">{c.heading}</span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{c.raw_text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {contract.raw_text && (
        <div className="rounded-xl border border-ink-200/60 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-ink-950 mb-4">Extracted text</h2>
          <pre className="whitespace-pre-wrap text-sm text-ink-700 font-sans max-h-96 overflow-y-auto">
            {contract.raw_text}
          </pre>
        </div>
      )}

      <div className="rounded-xl border border-ink-200/60 bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-950 mb-1">AI analysis (beta)</h2>
        <p className="text-xs text-ink-500 mb-4">
          AI suggestions are not legal advice. A qualified lawyer must review any contract before you rely on
          it.
        </p>

        {!supportsAi && (
          <p className="text-sm text-ink-600">
            AI risk analysis is only set up for NDA and MSA contracts. Other types are not supported yet.
          </p>
        )}

        {supportsAi && clauses.length === 0 && (
          <p className="text-sm text-ink-600">Extract clauses first, then you can run AI analysis.</p>
        )}

        {showAnalyzeCta && riskFlags.length === 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={analyzeLoading}
              className="rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-medium text-parchment hover:bg-ink-800 disabled:opacity-60"
            >
              {analyzeLoading ? "Running…" : "Run AI analysis"}
            </button>
            {analyzeError && <p className="text-sm text-red-700">{analyzeError}</p>}
          </div>
        )}

        {showAnalyzeCta && riskFlags.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-ink-600">
                {riskFlags.length} issue{riskFlags.length === 1 ? "" : "s"} flagged
              </p>
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={analyzeLoading}
                className="text-sm font-medium text-seal hover:underline disabled:opacity-60"
              >
                {analyzeLoading ? "Running…" : "Run again"}
              </button>
            </div>
            {analyzeError && <p className="text-sm text-red-700">{analyzeError}</p>}
            <ul className="space-y-4">
              {riskFlags.map((f) => {
                const href = clauseAnchorForFlag(f);
                const latest = decisionByFlagId[f.id];
                const busy = savingFlagId === f.id;
                const editing = editingFlagId === f.id;
                return (
                  <li
                    key={f.id}
                    className="rounded-lg border border-ink-200/80 bg-ink-50/50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${severityClass(
                          f.severity
                        )}`}
                      >
                        {f.severity}
                      </span>
                      <span className="font-serif text-sm font-semibold text-ink-950">{f.category}</span>
                    </div>
                    <p className="text-sm text-ink-800">{f.explanation}</p>
                    {f.suggestion && (
                      <p className="mt-2 text-sm text-ink-600">
                        <span className="font-medium text-ink-700">Suggestion:</span> {f.suggestion}
                      </p>
                    )}
                    {latest && (
                      <p className="mt-2 text-xs text-ink-600">
                        <span className="font-medium text-ink-700">Status:</span>{" "}
                        {decisionStatusLabel(latest)}
                        {latest.action === "edited" && latest.edited_text && (
                          <span className="block mt-1 whitespace-pre-wrap text-ink-700">
                            {latest.edited_text}
                          </span>
                        )}
                      </p>
                    )}
                    {href && (
                      <a
                        href={href}
                        className="mt-3 inline-block text-sm font-medium text-seal hover:underline"
                      >
                        View clause
                      </a>
                    )}

                    {editing ? (
                      <div className="mt-3 space-y-2">
                        <label className="block text-xs font-medium text-ink-700">
                          Edited suggestion
                        </label>
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-950"
                          disabled={busy}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy || !editDraft.trim()}
                            onClick={() =>
                              submitReview(f.id, "edited", editDraft.trim())
                            }
                            className="rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-medium text-parchment hover:bg-ink-800 disabled:opacity-50"
                          >
                            {busy ? "Saving…" : "Save edit"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditingFlagId(null);
                              setEditDraft("");
                            }}
                            className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitReview(f.id, "accepted", null)}
                          className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-800 hover:bg-ink-100 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(f)}
                          className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-800 hover:bg-ink-100 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitReview(f.id, "rejected", null)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
