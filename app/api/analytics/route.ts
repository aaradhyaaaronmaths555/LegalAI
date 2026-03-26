import { NextResponse } from "next/server";
import { createSupabaseFromBearer } from "@/lib/supabase-server";
import type { FirmAnalyticsErrorPayload, FirmAnalyticsPayload } from "@/lib/analytics";

export const runtime = "nodejs";

function sinceDays(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" } satisfies FirmAnalyticsErrorPayload, {
      status: 401,
    });
  }

  const supabase = createSupabaseFromBearer(token);
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" } satisfies FirmAnalyticsErrorPayload, {
      status: 401,
    });
  }

  const p_since_30 = sinceDays(30).toISOString();
  const p_since_90 = sinceDays(90).toISOString();

  const { data, error } = await supabase.rpc("get_firm_analytics_dashboard", {
    p_since_30,
    p_since_90,
  });

  if (error) {
    console.error("get_firm_analytics_dashboard", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error.message?.includes("function") || error.code === "PGRST202"
            ? "Analytics is not available until the database migration is applied (run supabase-analytics.sql)."
            : error.message ?? "Analytics failed",
      } satisfies FirmAnalyticsErrorPayload,
      { status: error.code === "PGRST202" ? 503 : 500 }
    );
  }

  if (!data || typeof data !== "object") {
    return NextResponse.json(
      { ok: false, error: "Invalid analytics response" } satisfies FirmAnalyticsErrorPayload,
      { status: 500 }
    );
  }

  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return NextResponse.json(row as FirmAnalyticsErrorPayload, { status: 400 });
  }

  const payload: FirmAnalyticsPayload = {
    ok: true,
    contracts_uploaded_30: Number(row.contracts_uploaded_30 ?? 0),
    contracts_uploaded_90: Number(row.contracts_uploaded_90 ?? 0),
    contracts_with_ai_flags_30: Number(row.contracts_with_ai_flags_30 ?? 0),
    contracts_with_ai_flags_90: Number(row.contracts_with_ai_flags_90 ?? 0),
    avg_issues_per_contract_90: Number(row.avg_issues_per_contract_90 ?? 0),
    severity_90d: {
      low: Number((row.severity_90d as Record<string, unknown>)?.low ?? 0),
      medium: Number((row.severity_90d as Record<string, unknown>)?.medium ?? 0),
      high: Number((row.severity_90d as Record<string, unknown>)?.high ?? 0),
    },
    decision_latest: {
      accepted: Number((row.decision_latest as Record<string, unknown>)?.accepted ?? 0),
      edited: Number((row.decision_latest as Record<string, unknown>)?.edited ?? 0),
      rejected: Number((row.decision_latest as Record<string, unknown>)?.rejected ?? 0),
      not_reviewed: Number((row.decision_latest as Record<string, unknown>)?.not_reviewed ?? 0),
    },
    total_risk_flags: Number(row.total_risk_flags ?? 0),
  };

  return NextResponse.json(payload);
}
