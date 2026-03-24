"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Contract } from "@/lib/types";
import { CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/types";

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setContract(null);
        setLoading(false);
        return;
      }

      setContract(data);

      const { data: urlData } = await supabase.storage
        .from("contracts")
        .createSignedUrl(data.file_path, 3600);
      setDownloadUrl(urlData?.signedUrl ?? null);
      setLoading(false);
    }
    load();
  }, [id]);

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

      {contract.raw_text && (
        <div className="rounded-xl border border-ink-200/60 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-ink-950 mb-4">Extracted text</h2>
          <pre className="whitespace-pre-wrap text-sm text-ink-700 font-sans max-h-96 overflow-y-auto">
            {contract.raw_text}
          </pre>
        </div>
      )}

      <div className="rounded-xl border border-ink-200/60 bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-950 mb-4">AI analysis</h2>
        <p className="text-sm text-ink-500 italic">
          AI-powered clause review, risk flags, and suggestions will appear here in a future update.
        </p>
      </div>
    </div>
  );
}
