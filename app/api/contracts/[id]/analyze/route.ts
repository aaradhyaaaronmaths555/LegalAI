import { NextResponse } from "next/server";
import { createSupabaseFromBearer } from "@/lib/supabase-server";
import { filterRiskIssuesForStorage } from "@/lib/filter-risk-issues";
import {
  formatIssueExplanation,
  runRiskLlmWithRetry,
  type ClauseInput,
  type ContractRiskType,
} from "@/lib/llm-nda-msa";

export const runtime = "nodejs";

/** Simple in-memory rate limit: max one run per user per contract per 45s (MVP). */
const lastAnalyze = new Map<string, number>();
const COOLDOWN_MS = 45_000;

type Ctx = { params: { id: string } };

export async function POST(_req: Request, context: Ctx) {
  const contractId = context.params.id;
  const auth = _req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseFromBearer(token);
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = `${user.id}:${contractId}`;
  const now = Date.now();
  const prev = lastAnalyze.get(rlKey);
  if (prev != null && now - prev < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Please wait before running analysis again." },
      { status: 429 }
    );
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("firm_id")
    .eq("id", user.id)
    .single();
  if (profErr || !profile?.firm_id) {
    return NextResponse.json({ error: "No firm for user" }, { status: 403 });
  }

  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("id, firm_id, contract_type, title")
    .eq("id", contractId)
    .single();

  if (cErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.firm_id !== profile.firm_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ct = contract.contract_type as ContractRiskType;
  if (ct !== "nda" && ct !== "msa" && ct !== "employment_agreement") {
    return NextResponse.json(
      { error: "Unsupported contract type for AI analysis." },
      { status: 400 }
    );
  }

  const { data: clauseRows, error: clErr } = await supabase
    .from("clauses")
    .select("id, position, heading, raw_text")
    .eq("contract_id", contractId)
    .order("position", { ascending: true });

  if (clErr) {
    console.error("clauses load", clErr);
    return NextResponse.json({ error: "Could not load clauses" }, { status: 500 });
  }
  if (!clauseRows?.length) {
    return NextResponse.json(
      { error: "No clauses found. Run “Extract clauses” first." },
      { status: 422 }
    );
  }

  const clauses: ClauseInput[] = clauseRows.map((r) => ({
    position: r.position,
    heading: r.heading,
    raw_text: r.raw_text,
  }));

  const positionToId = new Map<number, string>();
  for (const r of clauseRows) {
    positionToId.set(r.position, r.id);
  }
  const validPositions = new Set(clauseRows.map((r) => r.position));

  await supabase.from("risk_flags").delete().eq("contract_id", contractId);
  await supabase.from("ai_analyses").delete().eq("contract_id", contractId);

  let model: string;
  let issues: Awaited<ReturnType<typeof runRiskLlmWithRetry>>["issues"];
  let parsedResponse: Record<string, unknown> | null;
  try {
    const out = await runRiskLlmWithRetry(ct, clauses, validPositions);
    model = out.model;
    issues = out.issues;
    parsedResponse = out.parsed;
  } catch (e) {
    console.error("runRiskLlmWithRetry", e);
    const msg = e instanceof Error ? e.message : "LLM failed";
    await supabase.from("ai_analyses").insert({
      contract_id: contractId,
      model: process.env.OPENAI_MODEL ?? "unknown",
      status: "failed",
      raw_response: { error: msg } as unknown as Record<string, unknown>,
    });
    lastAnalyze.set(rlKey, now);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { issues: filteredIssues, meta: filterMeta } =
    filterRiskIssuesForStorage(issues, validPositions);

  const rawPayloadBase =
    parsedResponse && typeof parsedResponse === "object" && !Array.isArray(parsedResponse)
      ? { ...parsedResponse }
      : {};
  const raw_response = {
    ...rawPayloadBase,
    issues: filteredIssues,
    filter_meta: filterMeta,
  } as Record<string, unknown>;

  const { data: analysisRow, error: aInsErr } = await supabase
    .from("ai_analyses")
    .insert({
      contract_id: contractId,
      model,
      status: "succeeded",
      raw_response: raw_response as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (aInsErr || !analysisRow) {
    console.error("ai_analyses insert", aInsErr);
    lastAnalyze.set(rlKey, now);
    return NextResponse.json({ error: "Could not save analysis" }, { status: 500 });
  }

  const flagRows = filteredIssues.map((issue) => {
    const idx = issue.clause_index;
    const clauseId =
      idx != null && positionToId.has(idx) ? positionToId.get(idx)! : null;
    return {
      contract_id: contractId,
      clause_id: clauseId,
      severity: issue.severity,
      category: issue.category,
      explanation: formatIssueExplanation(issue),
      suggestion: issue.suggestion.trim() || null,
      source_start: null as number | null,
      source_end: null as number | null,
    };
  });

  if (flagRows.length > 0) {
    const { error: rfErr } = await supabase.from("risk_flags").insert(flagRows);
    if (rfErr) {
      console.error("risk_flags insert", rfErr);
      lastAnalyze.set(rlKey, now);
      return NextResponse.json({ error: "Could not save risk flags" }, { status: 500 });
    }
  }

  lastAnalyze.set(rlKey, now);
  return NextResponse.json({
    ok: true,
    analysisId: analysisRow.id,
    issueCount: filteredIssues.length,
  });
}
