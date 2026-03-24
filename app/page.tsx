import Link from "next/link";
import { MainNav } from "@/components/MainNav";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-ink-200/60 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-ink-950">
            LegalAI
          </Link>
          <MainNav />
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold text-ink-950 leading-tight tracking-tight">
            Legal intelligence,{" "}
            <span className="text-seal">at your fingertips</span>
          </h1>
          <p className="mt-6 text-lg text-ink-600 leading-relaxed">
            Analyze contracts, extract key clauses, and conduct legal research
            with AI-powered tools built for professionals.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-lg bg-ink-950 px-6 py-3 text-base font-medium text-parchment hover:bg-ink-800 transition-colors"
            >
              Analyze a document
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
            <Link
              href="/research"
              className="inline-flex items-center gap-2 rounded-lg border border-ink-300 px-6 py-3 text-base font-medium text-ink-950 hover:bg-ink-100 transition-colors"
            >
              Start research
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-ink-200/60 bg-white/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-serif text-2xl font-semibold text-ink-950 mb-12">
            What you can do
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="rounded-xl border border-ink-200/60 bg-parchment/50 p-6">
              <div className="mb-4 inline-flex rounded-lg bg-gold/20 p-2">
                <svg
                  className="h-6 w-6 text-seal"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-lg font-semibold text-ink-950">
                Document Analysis
              </h3>
              <p className="mt-2 text-sm text-ink-600">
                Upload contracts and legal documents. Extract clauses, identify
                risks, and get structured summaries.
              </p>
            </div>
            <div className="rounded-xl border border-ink-200/60 bg-parchment/50 p-6">
              <div className="mb-4 inline-flex rounded-lg bg-gold/20 p-2">
                <svg
                  className="h-6 w-6 text-seal"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-lg font-semibold text-ink-950">
                Legal Research
              </h3>
              <p className="mt-2 text-sm text-ink-600">
                Ask questions in plain language. Get answers grounded in legal
                principles and relevant precedents.
              </p>
            </div>
            <div className="rounded-xl border border-ink-200/60 bg-parchment/50 p-6">
              <div className="mb-4 inline-flex rounded-lg bg-gold/20 p-2">
                <svg
                  className="h-6 w-6 text-seal"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-lg font-semibold text-ink-950">
                Contract Review
              </h3>
              <p className="mt-2 text-sm text-ink-600">
                Highlight non-standard terms, missing clauses, and potential
                liabilities before you sign.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Privacy */}
      <section className="border-t border-ink-200/60 bg-parchment/80">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-serif text-2xl font-semibold text-ink-950 mb-6">
            Security &amp; Privacy for Law Firms
          </h2>
          <div className="max-w-2xl space-y-4 text-ink-600">
            <p className="leading-relaxed">
              Your firm&apos;s contracts and data deserve the same care you give your clients. LegalAI is built on a secure, multi-tenant platform: we share infrastructure for reliability and scale, but your data is strictly isolated. Every record is tagged to your firm and protected by access controls at the database level. Other firms cannot see, modify, or export your data.
            </p>
            <p className="leading-relaxed">
              All data is encrypted at rest and in transit. Every connection uses TLS (HTTPS), and we log sign-ins, uploads, and document reviews for transparency and audit support. You access data only through the LegalAI web app and exports—no direct database access.
            </p>
            <p className="leading-relaxed">
              If you ever need to leave, we&apos;ll provide a structured export of your data so you can migrate without lock-in. Your data stays yours.
            </p>
          </div>
          <Link
            href="/security"
            className="mt-6 inline-block text-sm font-medium text-ink-950 hover:text-seal transition-colors"
          >
            Read more about security →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-200/60 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-serif text-sm text-ink-600">
            © {new Date().getFullYear()} LegalAI. For informational purposes only.
          </span>
          <div className="flex gap-6 text-sm text-ink-600">
            <Link href="/security" className="hover:text-ink-950">
              Security
            </Link>
            <Link href="/privacy" className="hover:text-ink-950">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink-950">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
