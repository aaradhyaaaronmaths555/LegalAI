"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MainNav } from "@/components/MainNav";
import { supabase } from "@/lib/supabase";
import type { ContractType } from "@/lib/types";
import { CONTRACT_TYPE_LABELS } from "@/lib/types";

const CONTRACT_TYPES: ContractType[] = ["nda", "msa", "employment_agreement"];
const ACCEPTED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_SIZE_MB = 10; // Matches storage bucket file_size_limit

function isAcceptedFile(file: File): boolean {
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
  if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
  if (ACCEPTED_MIMES.includes(file.type)) return true;
  if (!file.type || file.type === "application/octet-stream") {
    return ACCEPTED_EXTENSIONS.includes(ext);
  }
  return false;
}

export default function AnalyzePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState<ContractType>("nda");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!file) {
      setError("Please select a file.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (!isAcceptedFile(file)) {
      setError("Please upload a PDF or DOCX file.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_SIZE_MB}MB (storage limit).`);
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Please sign in to upload.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("firm_id")
        .eq("id", user.id)
        .single();

      if (!profile?.firm_id) {
        setError("Firm not found. Please contact support.");
        setLoading(false);
        return;
      }

      const contractId = crypto.randomUUID();
      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = `${profile.firm_id}/${contractId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(storagePath, file, {
          contentType: file.type || (ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
          upsert: false,
        });

      if (uploadError) {
        setError(uploadError.message || "Upload failed.");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from("contracts").insert({
        id: contractId,
        firm_id: profile.firm_id,
        title: title.trim(),
        contract_type: contractType,
        file_path: storagePath,
        file_name: file.name,
        status: "uploaded",
        uploaded_by: user.id,
      });

      if (insertError) {
        setError(insertError.message || "Failed to save contract.");
        await supabase.storage.from("contracts").remove([storagePath]);
        setLoading(false);
        return;
      }

      router.push(`/dashboard/contracts/${contractId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200/60 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-ink-950">
            LegalAI
          </Link>
          <MainNav />
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-serif text-3xl font-semibold text-ink-950">
          Document Analysis
        </h1>
        <p className="mt-2 text-ink-600">
          Upload a contract or legal document for AI-powered analysis.
        </p>

        <form onSubmit={handleUpload} className="mt-12 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-ink-700">
              Contract title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-ink-200 px-4 py-2.5 text-ink-950 focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal disabled:opacity-60"
              placeholder="e.g. Acme Corp NDA"
            />
          </div>

          <div>
            <label htmlFor="contractType" className="block text-sm font-medium text-ink-700">
              Contract type
            </label>
            <select
              id="contractType"
              value={contractType}
              onChange={(e) => setContractType(e.target.value as ContractType)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-ink-200 px-4 py-2.5 text-ink-950 focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal disabled:opacity-60"
            >
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700">
              File (PDF or DOCX, max {MAX_SIZE_MB}MB)
            </label>
            <label
              htmlFor="contract-file"
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 bg-ink-50/50 p-16 text-center transition-colors hover:border-ink-400 hover:bg-ink-100/50 ${loading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                id="contract-file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={loading}
                className="sr-only"
              />
              <svg
                className="mx-auto h-12 w-12 text-ink-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              {file ? (
                <p className="mt-4 text-sm text-ink-700">
                  <span className="font-medium">{file.name}</span>
                  <span className="ml-2 text-ink-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </p>
              ) : (
                <p className="mt-4 font-medium text-ink-700">
                  Drag and drop your document here, or click to browse
                </p>
              )}
              <p className="mt-1 text-sm text-ink-500">
                PDF or DOCX up to {MAX_SIZE_MB}MB
              </p>
              <span className="mt-6 inline-flex rounded-lg bg-ink-950 px-6 py-2.5 text-sm font-medium text-parchment hover:bg-ink-800 transition-colors">
                Select file
              </span>
            </label>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || !file}
              className="rounded-lg bg-ink-950 px-6 py-2.5 text-sm font-medium text-parchment hover:bg-ink-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Uploading…" : "Upload & analyze"}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-ink-300 px-6 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-ink-500">
          AI analysis coming soon. Connect your API key in .env.local to enable.
        </p>
      </main>
    </div>
  );
}
