"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeReviewSummary,
  reviewStatusChipClass,
  reviewUiStatus,
  REVIEW_STATUS_LABEL,
} from "@/lib/review-status";
import { supabase } from "@/lib/supabase";
import type {
  Clause,
  Contract,
  ContractPriority,
  ContractReviewStatus,
  FirmMemberProfile,
  ReviewDecision,
  RiskFlag,
} from "@/lib/types";
import {
  CONTRACT_PRIORITY_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  REVIEW_WORKFLOW_LABELS,
} from "@/lib/types";

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
  /** Latest succeeded run (even when zero flags after filtering). */
  const [hasSucceededAnalysis, setHasSucceededAnalysis] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  /** Latest review_decisions per risk_flag_id (by created_at desc). */
  const [decisionByFlagId, setDecisionByFlagId] = useState<
    Record<string, ReviewDecision>
  >({});
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingFlagId, setSavingFlagId] = useState<string | null>(null);
  const [savedFlagId, setSavedFlagId] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightClauseId, setHighlightClauseId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [firmMembers, setFirmMembers] = useState<FirmMemberProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const loadRiskFlagsAndDecisions = useCallback(async () => {
    const { data: flagRows } = await supabase
      .from("risk_flags")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: true });

    const flags = (flagRows as RiskFlag[] | null) ?? [];
    setRiskFlags(flags);

    const { data: succeededAnalysis } = await supabase
      .from("ai_analyses")
      .select("id")
      .eq("contract_id", id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setHasSucceededAnalysis(!!succeededAnalysis);

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
  }, [id]);

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

      setContract(data as Contract);

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setCurrentUserId(authUser?.id ?? null);

      const { data: memberRows } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("firm_id", data.firm_id)
        .order("name", { ascending: true, nullsFirst: false });
      setFirmMembers((memberRows as FirmMemberProfile[] | null) ?? []);

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

      await loadRiskFlagsAndDecisions();

      setLoading(false);
    }
    load();
  }, [id, loadRiskFlagsAndDecisions]);

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
      await loadRiskFlagsAndDecisions();
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
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
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setSavedFlagId(riskFlagId);
      savedTimerRef.current = setTimeout(() => {
        setSavedFlagId((cur) => (cur === riskFlagId ? null : cur));
        savedTimerRef.current = null;
      }, 2200);
    } finally {
      setSavingFlagId(null);
    }
  }

  function startEdit(f: RiskFlag) {
    setEditingFlagId(f.id);
    setEditDraft(f.suggestion ?? "");
  }

  function scrollToClauseForFlag(flag: RiskFlag) {
    if (!flag.clause_id) return;
    const c = clauses.find((x) => x.id === flag.clause_id);
    if (!c) return;
    const el = document.getElementById(`clause-${c.position}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightClauseId(c.id);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightClauseId(null);
      highlightTimerRef.current = null;
    }, 2400);
  }

  function reviewStatusDisplay(c: Contract): ContractReviewStatus {
    return c.review_status ?? "not_started";
  }

  async function updateWorkflow(patch: {
    assigned_to?: string | null;
    review_status?: ContractReviewStatus;
    priority?: ContractPriority | null;
  }) {
    setWorkflowError(null);
    setWorkflowSaving(true);
    try {
      const { error } = await supabase.from("contracts").update(patch).eq("id", id);
      if (error) {
        setWorkflowError(error.message);
        return;
      }
      setContract((prev) => (prev ? { ...prev, ...patch } : null));
    } finally {
      setWorkflowSaving(false);
    }
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
    contract.contract_type === "nda" ||
    contract.contract_type === "msa" ||
    contract.contract_type === "employment_agreement";
  const showAnalyzeCta = supportsAi && clauses.length > 0;
  const reviewSummary = computeReviewSummary(
    riskFlags.map((f) => f.id),
    decisionByFlagId
  );
  const twoPaneReview = supportsAi && clauses.length > 0;
  const savingAny = savingFlagId !== null;

  function severityClass(s: RiskFlag["severity"]) {
    if (s === "high") return "bg-red-100 text-red-900";
    if (s === "medium") return "bg-amber-100 text-amber-900";
    return "bg-ink-100 text-ink-800";
  }

  const clausesSection = (
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
      {extractError && <p className="mb-4 text-sm text-red-700">{extractError}</p>}
      {clauses.length === 0 ? (
        <p className="text-sm text-ink-500">No clauses yet. Click Extract clauses.</p>
      ) : (
        <ol className="space-y-6 border-t border-ink-100 pt-6">
          {clauses.map((c) => (
            <li
              key={c.id}
              id={`clause-${c.position}`}
              className={`scroll-mt-28 rounded-r-lg border-l-[3px] pl-5 pr-1 py-1 transition-colors duration-300 ${
                highlightClauseId === c.id
                  ? "border-seal bg-amber-50/60 shadow-sm"
                  : "border-seal/25 bg-transparent"
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-serif text-[15px] font-semibold text-ink-950">
                  {c.position}.
                </span>
                {c.heading && (
                  <span className="font-serif text-[15px] font-medium text-ink-800">{c.heading}</span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.65] text-ink-700">
                {c.raw_text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  const extractedSection =
    contract.raw_text ? (
      <div className="rounded-xl border border-ink-200/60 bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-950 mb-4">Extracted text</h2>
        <pre className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700 font-sans max-h-96 overflow-y-auto">
          {contract.raw_text}
        </pre>
      </div>
    ) : null;

  const aiSectionCard = (
    <div className="rounded-xl border border-ink-200/60 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-lg font-semibold text-ink-950 mb-1">AI analysis (beta)</h2>
      <p className="text-xs text-ink-500 mb-4">
        First-pass AI review of extracted clauses. Results depend on text quality.
      </p>

      {showAnalyzeCta && riskFlags.length > 0 && (
        <p className="text-sm text-ink-800 mb-4 leading-snug">
          <span className="font-medium text-ink-950">{reviewSummary.total}</span> issue
          {reviewSummary.total === 1 ? "" : "s"}
          <span className="text-ink-400"> — </span>
          <span className="text-emerald-800">{reviewSummary.accepted} accepted</span>
          <span className="text-ink-400"> — </span>
          <span className="text-amber-800">{reviewSummary.edited} edited</span>
          <span className="text-ink-400"> — </span>
          <span className="text-red-800">{reviewSummary.rejected} rejected</span>
          <span className="text-ink-400"> — </span>
          <span className="text-ink-600">{reviewSummary.notReviewed} not reviewed</span>
        </p>
      )}

      {!supportsAi && (
        <p className="text-sm text-ink-600">
          AI risk analysis is only set up for NDA, MSA, and employment agreements. Other types are not
          supported yet.
        </p>
      )}

      {supportsAi && clauses.length === 0 && (
        <p className="text-sm text-ink-600">Extract clauses first, then you can run AI analysis.</p>
      )}

      {showAnalyzeCta && riskFlags.length === 0 && (
        <div className="space-y-3">
          {hasSucceededAnalysis && (
            <p className="text-sm text-ink-600">No issues detected by AI; please review manually.</p>
          )}
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
        </div>
      )}

      {showAnalyzeCta && riskFlags.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

          <p className="text-xs text-ink-600 leading-relaxed border-l-2 border-ink-200 pl-3 py-1">
            AI suggestions assist review and do not constitute legal advice. A qualified lawyer must make
            final decisions.
          </p>

          <ul className="space-y-4">
            {riskFlags.map((f) => {
              const latest = decisionByFlagId[f.id];
              const busy = savingFlagId === f.id;
              const editing = editingFlagId === f.id;
              const uiStatus = reviewUiStatus(latest);
              const canLink = Boolean(f.clause_id);
              return (
                <li key={f.id} className="rounded-lg border border-ink-200/80 bg-ink-50/50 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${severityClass(
                        f.severity
                      )}`}
                    >
                      {f.severity}
                    </span>
                    <span className="font-serif text-sm font-semibold text-ink-950">{f.category}</span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${reviewStatusChipClass(
                        uiStatus
                      )}`}
                    >
                      {REVIEW_STATUS_LABEL[uiStatus]}
                    </span>
                  </div>
                  <p className="text-sm text-ink-800 leading-relaxed">{f.explanation}</p>
                  {f.suggestion && (
                    <p className="mt-2 text-sm text-ink-600 leading-relaxed">
                      <span className="font-medium text-ink-700">Suggestion:</span> {f.suggestion}
                    </p>
                  )}
                  {latest?.action === "edited" && latest.edited_text && (
                    <p className="mt-2 text-xs text-ink-600">
                      <span className="font-medium text-ink-700">Your edit:</span>
                      <span className="block mt-1 whitespace-pre-wrap text-ink-800 leading-relaxed">
                        {latest.edited_text}
                      </span>
                    </p>
                  )}
                  {canLink && (
                    <button
                      type="button"
                      onClick={() => scrollToClauseForFlag(f)}
                      className="mt-3 text-sm font-medium text-seal hover:underline"
                    >
                      View clause
                    </button>
                  )}

                  {editing ? (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-medium text-ink-700">Edited suggestion</label>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-950"
                        disabled={busy || savingAny}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busy || savingAny || !editDraft.trim()}
                          onClick={() => submitReview(f.id, "edited", editDraft.trim())}
                          className="rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-medium text-parchment hover:bg-ink-800 disabled:opacity-50"
                        >
                          {busy ? "Saving…" : "Save edit"}
                        </button>
                        <button
                          type="button"
                          disabled={busy || savingAny}
                          onClick={() => {
                            setEditingFlagId(null);
                            setEditDraft("");
                          }}
                          className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700"
                        >
                          Cancel
                        </button>
                        {savedFlagId === f.id && !busy && (
                          <span className="text-xs font-medium text-emerald-700">Saved</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy || savingAny}
                        onClick={() => submitReview(f.id, "accepted", null)}
                        className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-800 hover:bg-ink-100 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busy || savingAny}
                        onClick={() => startEdit(f)}
                        className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-800 hover:bg-ink-100 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy || savingAny}
                        onClick={() => submitReview(f.id, "rejected", null)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      {savedFlagId === f.id && !busy && (
                        <span className="text-xs font-medium text-emerald-700">Saved</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );

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
            <span className="inline-flex rounded-full bg-seal/10 px-2.5 py-0.5 text-xs font-medium text-ink-800">
              Review: {REVIEW_WORKFLOW_LABELS[reviewStatusDisplay(contract)]}
            </span>
            {contract.priority && (
              <span className="inline-flex rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
                Priority: {CONTRACT_PRIORITY_LABELS[contract.priority]}
              </span>
            )}
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
        <h2 className="font-serif text-lg font-semibold text-ink-950 mb-1">Review workflow</h2>
        <p className="text-sm text-ink-600 mb-4">
          Assign a reviewer and track review progress. Visible to everyone in your firm.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1.5">Assignee</label>
            <select
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950"
              disabled={workflowSaving}
              value={contract.assigned_to ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                void updateWorkflow({ assigned_to: v === "" ? null : v });
              }}
            >
              <option value="">Unassigned</option>
              {firmMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name?.trim() || m.email || m.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1.5">Review status</label>
            <select
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950"
              disabled={workflowSaving}
              value={reviewStatusDisplay(contract)}
              onChange={(e) => {
                void updateWorkflow({
                  review_status: e.target.value as ContractReviewStatus,
                });
              }}
            >
              {(Object.keys(REVIEW_WORKFLOW_LABELS) as ContractReviewStatus[]).map((k) => (
                <option key={k} value={k}>
                  {REVIEW_WORKFLOW_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1.5">Priority</label>
            <select
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950"
              disabled={workflowSaving}
              value={contract.priority ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                void updateWorkflow({
                  priority: v === "" ? null : (v as ContractPriority),
                });
              }}
            >
              <option value="">—</option>
              {(Object.keys(CONTRACT_PRIORITY_LABELS) as ContractPriority[]).map((k) => (
                <option key={k} value={k}>
                  {CONTRACT_PRIORITY_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {workflowSaving && (
          <p className="mt-3 text-xs text-ink-500">Saving…</p>
        )}
        {workflowError && (
          <p className="mt-3 text-sm text-red-700">{workflowError}</p>
        )}
      </div>

      {twoPaneReview ? (
        <div className="lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">
          <div className="space-y-8 min-w-0">
            {clausesSection}
            {extractedSection}
          </div>
          <div className="space-y-8 min-w-0 lg:sticky lg:top-8 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pl-1">
            {aiSectionCard}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {clausesSection}
          {extractedSection}
          {aiSectionCard}
        </div>
      )}
    </div>
  );
}
