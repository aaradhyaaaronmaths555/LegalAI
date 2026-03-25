import { NextResponse } from "next/server";
import { createSupabaseFromBearer } from "@/lib/supabase-server";
import {
  parseIssuesJson,
  runRiskLlm,
  type ClauseInput,
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

  const ct = contract.contract_type as string;
  if (ct !== "nda" && ct !== "msa") {
    return NextResponse.json(
      { error: "AI analysis is only available for NDA and MSA contracts for now." },
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

  await supabase.from("risk_flags").delete().eq("contract_id", contractId);
  await supabase.from("ai_analyses").delete().eq("contract_id", contractId);

  let rawText: string;
  let model: string;
  try {
    const out = await runRiskLlm(ct as "nda" | "msa", clauses);
    rawText = out.rawText;
    model = out.model;
  } catch (e) {
    console.error("runRiskLlm", e);
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

  let issues: ReturnType<typeof parseIssuesJson>;
  try {
    issues = parseIssuesJson(rawText);
  } catch (e) {
    console.error("parseIssuesJson", e);
    await supabase.from("ai_analyses").insert({
      contract_id: contractId,
      model,
      status: "failed",
      raw_response: { parseError: String(e), raw: rawText } as unknown as Record<
        string,
        unknown
      >,
    });
    lastAnalyze.set(rlKey, now);
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 502 });
  }

  const { data: analysisRow, error: aInsErr } = await supabase
    .from("ai_analyses")
    .insert({
      contract_id: contractId,
      model,
      status: "succeeded",
      raw_response: JSON.parse(rawText) as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (aInsErr || !analysisRow) {
    console.error("ai_analyses insert", aInsErr);
    lastAnalyze.set(rlKey, now);
    return NextResponse.json({ error: "Could not save analysis" }, { status: 500 });
  }

  const flagRows = issues.map((issue) => {
    const pos = issue.clause_position;
    const clauseId =
      pos != null && positionToId.has(pos) ? positionToId.get(pos)! : null;
    return {
      contract_id: contractId,
      clause_id: clauseId,
      severity: issue.severity,
      category: issue.category,
      explanation: issue.explanation,
      suggestion: issue.suggestion,
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
    issueCount: issues.length,
  });
}
