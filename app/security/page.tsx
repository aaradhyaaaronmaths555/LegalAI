import Link from "next/link";
import { MainNav } from "@/components/MainNav";

export const metadata = {
  title: "Security & Data Isolation | LegalAI",
  description: "How LegalAI stores, isolates, and protects your firm's data.",
};

export default function SecurityPage() {
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

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-serif text-2xl font-semibold text-ink-950">
          Security &amp; Data Isolation
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          LegalAI — A one-page overview for law firms
        </p>

        <div className="mt-8 space-y-8 text-ink-700">
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink-950 mb-2">
              How Your Data Is Stored
            </h2>
            <p className="text-sm leading-relaxed">
              Your firm&apos;s data—contracts, analyses, and related records—is stored in a secure cloud environment. All data is encrypted at rest and in transit (TLS/HTTPS), and held in enterprise-grade infrastructure.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Your firm does <strong>not</strong> receive direct database access. All interaction happens only through the LegalAI web application, exports you request, and (if applicable) a future read-only API.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink-950 mb-2">
              How We Isolate Each Law Firm
            </h2>
            <p className="text-sm leading-relaxed">
              LegalAI is a multi-tenant platform: multiple law firms use the same underlying system. Every record is tagged with a unique firm identifier. Row-level security enforces that each firm can only read, update, or delete its own data. Firm A cannot view, modify, or export Firm B&apos;s data under any circumstances.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink-950 mb-2">
              Who Can Access the Database
            </h2>
            <ul className="text-sm leading-relaxed space-y-1 list-disc list-inside">
              <li><strong>You</strong> — Via the LegalAI web app only. You sign in and see only your firm&apos;s data.</li>
              <li><strong>LegalAI</strong> — Only authorized administrators, for platform operations, support, and security. Access is controlled and logged.</li>
              <li><strong>Third parties</strong> — No database access. No shared credentials or direct connections.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink-950 mb-2">
              Exports and Data Portability
            </h2>
            <p className="text-sm leading-relaxed">
              You can export your data in PDF, DOCX, or CSV through the application. If you leave the platform, we can provide a structured export so you can migrate. Your data belongs to you.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink-950 mb-2">
              Auditability and Logging
            </h2>
            <p className="text-sm leading-relaxed">
              We log user sign-ins, contract uploads, document reviews, and other sensitive operations for transparency, incident response, and audit requests.
            </p>
          </section>

          <section className="rounded-lg border border-ink-200 bg-white/50 p-4">
            <h2 className="font-serif text-lg font-semibold text-ink-950 mb-3">
              Summary
            </h2>
            <dl className="text-sm space-y-2">
              <div><dt className="font-medium text-ink-950">Access</dt><dd>Web app only — no direct database access</dd></div>
              <div><dt className="font-medium text-ink-950">Isolation</dt><dd>Tenant-level; Firm A cannot access Firm B&apos;s data</dd></div>
              <div><dt className="font-medium text-ink-950">Encryption</dt><dd>At rest and in transit</dd></div>
              <div><dt className="font-medium text-ink-950">Exports</dt><dd>PDF, DOCX, CSV</dd></div>
              <div><dt className="font-medium text-ink-950">Logging</dt><dd>Logins, uploads, reviews for auditability</dd></div>
              <div><dt className="font-medium text-ink-950">Portability</dt><dd>Full data export available on request</dd></div>
            </dl>
          </section>
        </div>

        <p className="mt-8 text-sm text-ink-500 italic">
          For questions about security or data handling, contact your LegalAI account manager or support.
        </p>
      </main>
    </div>
  );
}
