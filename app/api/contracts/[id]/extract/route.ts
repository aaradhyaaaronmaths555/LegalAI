import { NextResponse } from "next/server";
import { createSupabaseFromBearer } from "@/lib/supabase-server";
import { extractPlainText } from "@/lib/extract-document-text";
import { segmentClauses } from "@/lib/segment-clauses";

export const runtime = "nodejs";

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
    .select("id, firm_id, file_path, file_name")
    .eq("id", contractId)
    .single();

  if (cErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.firm_id !== profile.firm_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from("contracts")
    .download(contract.file_path);
  if (dlErr || !blob) {
    return NextResponse.json({ error: "Could not download file" }, { status: 502 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  let text: string;
  try {
    text = await extractPlainText(buffer, contract.file_name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNSUPPORTED_FORMAT") {
      return NextResponse.json({ error: "Only PDF and DOCX are supported" }, { status: 400 });
    }
    if (msg === "DOCX_CORRUPT") {
      return NextResponse.json(
        {
          error:
            "This Word file looks incomplete or damaged in storage (~truncated .docx). Re-save from Word, export as PDF, or upload again from a fully synced local file (not a cloud placeholder).",
          bytes: buffer.length,
        },
        { status: 422 }
      );
    }
    console.error("extractPlainText", e);
    return NextResponse.json({ error: "Text extraction failed" }, { status: 422 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "No text could be extracted" }, { status: 422 });
  }

  const segments = segmentClauses(text);
  if (segments.length === 0) {
    return NextResponse.json({ error: "No clauses segmented" }, { status: 422 });
  }

  const { error: delErr } = await supabase
    .from("clauses")
    .delete()
    .eq("contract_id", contractId);
  if (delErr) {
    console.error("clauses delete", delErr);
    return NextResponse.json({ error: "Could not clear old clauses" }, { status: 500 });
  }

  const rows = segments.map((s) => ({
    contract_id: contractId,
    position: s.position,
    heading: s.heading,
    raw_text: s.raw_text,
  }));

  const { error: insErr } = await supabase.from("clauses").insert(rows);
  if (insErr) {
    console.error("clauses insert", insErr);
    return NextResponse.json({ error: "Could not save clauses" }, { status: 500 });
  }

  const { error: contractErr } = await supabase
    .from("contracts")
    .update({
      raw_text: text,
      status: "completed",
    })
    .eq("id", contractId);

  if (contractErr) {
    console.error("contracts update raw_text", contractErr);
    return NextResponse.json({ error: "Clauses saved but could not store extracted text" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: segments.length });
}
