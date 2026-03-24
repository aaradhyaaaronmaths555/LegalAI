import Link from "next/link";
import { MainNav } from "@/components/MainNav";

export default function ResearchPage() {
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
          Legal Research
        </h1>
        <p className="mt-2 text-ink-600">
          Ask questions in plain language. Get AI-powered legal insights.
        </p>

        <div className="mt-12">
          <textarea
            placeholder="e.g. What are the key considerations for a non-compete clause in employment contracts?"
            className="w-full rounded-xl border border-ink-200 bg-white px-4 py-4 text-ink-950 placeholder:text-ink-400 focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal"
            rows={4}
          />
          <button
            type="button"
            className="mt-4 rounded-lg bg-ink-950 px-6 py-2.5 text-sm font-medium text-parchment hover:bg-ink-800 transition-colors"
          >
            Search
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-ink-500">
          Legal research AI coming soon. Connect your API key in .env.local to enable.
        </p>
      </main>
    </div>
  );
}
