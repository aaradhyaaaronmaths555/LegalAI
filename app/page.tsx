import Link from "next/link";
import { MainNav } from "@/components/MainNav";

const WORKFLOW_STEPS = [
  {
    title: "Upload",
    body: "Secure PDF or Word intake. Files stay under your firm’s storage policy—no shared folders or ad-hoc links.",
    span: "md:col-span-4",
  },
  {
    title: "Extract",
    body: "Structured text and clause boundaries so reviewers start from sections, not page scrolling.",
    span: "md:col-span-4",
  },
  {
    title: "Flag",
    body: "AI highlights themes and severity so first-pass risk is visible before partner time.",
    span: "md:col-span-4",
  },
  {
    title: "Review",
    body: "Accept, edit, or reject with a decision trail that stands up to internal QA.",
    span: "md:col-span-6",
  },
  {
    title: "Export",
    body: "Summaries and outcomes you can drop into file notes, board packs, or audit evidence.",
    span: "md:col-span-6",
  },
] as const;

const WHY_CARDS = [
  {
    title: "Faster review",
    body: "Less time on mechanical read-through; more time on judgment calls and client advice.",
  },
  {
    title: "Better consistency",
    body: "Same checklist and flags across matters—fewer one-off misses when the team is stretched.",
  },
  {
    title: "Human-approved final decisions",
    body: "AI proposes; your lawyers dispose. Nothing ships without your firm’s sign-off.",
  },
] as const;

function ProductPreview() {
  return (
    <div className="relative w-full max-w-xl mx-auto lg:max-w-none lg:mx-0">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-2xl bg-gradient-to-b from-emerald-950/[0.03] to-transparent blur-2xl pointer-events-none"
      />
      <div className="relative rounded-xl border border-ink-200/90 bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.12)] ring-1 ring-ink-950/[0.04]">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink-950">Acme Corp — Mutual NDA</p>
            <p className="truncate text-[11px] text-ink-500">Uploaded · PDF · Firm workspace</p>
          </div>
          <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-200/80">
            In review
          </span>
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="border-b border-ink-100 p-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Clause extraction
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-700 line-clamp-4">
              <span className="font-medium text-ink-900">§3 Confidentiality.</span> The Receiving Party
              shall hold all Confidential Information in strict confidence…
            </p>
            <div className="mt-3 flex gap-1.5">
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">
                §3
              </span>
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">
                §7
              </span>
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">
                §12
              </span>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Risk flags
            </p>
            <ul className="mt-2 space-y-2">
              <li className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                <span className="text-[11px] leading-snug text-ink-800">
                  <span className="font-semibold text-ink-950">Medium</span> · Scope of confidential
                  information
                </span>
              </li>
              <li className="flex items-start gap-2 rounded-lg border border-red-200/70 bg-red-50/70 px-2.5 py-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
                <span className="text-[11px] leading-snug text-ink-800">
                  <span className="font-semibold text-ink-950">High</span> · Survival / term unclear
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink-100 bg-ink-50/50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-ink-600">
              Review status: <span className="text-ink-950">In progress</span> · Assignee: Partner
            </p>
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-emerald-900 ring-1 ring-emerald-200/70">
              Export summary
            </span>
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="absolute -bottom-3 -right-3 -z-10 h-24 w-32 rounded-lg border border-ink-200/60 bg-white/90 shadow-sm md:h-28 md:w-36"
      />
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fafaf9] text-ink-950">
      <header className="sticky top-0 z-50 border-b border-ink-200/70 bg-[#fafaf9]/90 backdrop-blur-md">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 lg:max-w-7xl lg:px-8"
          aria-label="Primary"
        >
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight text-ink-950 transition-colors hover:text-ink-800"
          >
            LegalAI
          </Link>
          <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
            <MainNav />
            <Link
              href="/analyze"
              className="hidden shrink-0 rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-medium text-[#faf8f5] shadow-sm transition hover:bg-ink-900 sm:inline-flex"
            >
              Try Demo
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-ink-200/60">
          <div className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pb-20 md:pt-16 lg:max-w-7xl lg:px-8 lg:pb-24 lg:pt-20">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
              <div className="min-w-0">
                <h1 className="font-serif text-[2rem] font-semibold leading-[1.1] tracking-tight text-ink-950 sm:text-4xl lg:text-[2.75rem] xl:text-5xl">
                  Private AI contract review for Australian small law firms
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600 md:text-xl">
                  Review contracts 3x faster with audit-ready decisions.
                </p>
                <p className="mt-6 font-mono text-sm text-ink-500 tracking-wide">
                  Upload → Extract → Flag → Review → Export
                </p>
                <p className="mt-3 text-sm font-medium text-ink-800">
                  All private. Firm-scoped. Human-approved.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-md border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-xs font-medium text-emerald-950">
                    Firm-scoped
                  </span>
                  <span className="inline-flex rounded-md border border-ink-200/80 bg-white px-2.5 py-1 text-xs font-medium text-ink-800">
                    Audit trail
                  </span>
                  <span className="inline-flex rounded-md border border-ink-200/80 bg-white px-2.5 py-1 text-xs font-medium text-ink-800">
                    AU-focused
                  </span>
                </div>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link
                    href="/analyze"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-ink-950 px-7 text-base font-medium text-[#faf8f5] shadow-sm transition hover:bg-ink-900"
                  >
                    Try Demo
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-ink-300/90 bg-white px-7 text-base font-medium text-ink-950 shadow-sm transition hover:border-ink-400 hover:bg-ink-50"
                  >
                    See How It Works
                  </Link>
                </div>
              </div>
              <div className="min-w-0">
                <ProductPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-b border-ink-200/50 bg-white/80">
          <div className="mx-auto max-w-6xl px-6 py-6 lg:max-w-7xl lg:px-8">
            <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center sm:divide-x sm:divide-ink-200/80">
              <p className="text-center text-sm font-medium text-ink-700 sm:flex-1 sm:px-4 sm:text-left">
                Built for Australian firms
              </p>
              <p className="text-center text-sm font-medium text-ink-700 sm:flex-1 sm:px-4 sm:text-left">
                Private by design
              </p>
              <p className="text-center text-sm font-medium text-ink-700 sm:flex-1 sm:px-4 sm:text-left">
                Audit-ready review flow
              </p>
            </div>
          </div>
        </section>

        {/* How it works — bento */}
        <section id="how-it-works" className="scroll-mt-24 border-b border-ink-200/60 bg-[#fafaf9]">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:max-w-7xl lg:px-8 lg:py-28">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900/90">
                Workflow
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink-950 md:text-4xl">
                From file to firm-ready output
              </h2>
              <p className="mt-3 text-ink-600">
                One disciplined path—built for small teams that cannot afford dropped handoffs.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-12">
              {WORKFLOW_STEPS.map((item, i) => (
                <article
                  key={item.title}
                  className={`group rounded-xl border border-ink-200/80 bg-white p-6 shadow-sm transition hover:border-emerald-200/90 hover:shadow-md ${item.span}`}
                >
                  <span className="font-mono text-xs font-medium text-ink-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 font-serif text-lg font-semibold text-ink-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Why firms use it */}
        <section className="border-b border-ink-200/60 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:max-w-7xl lg:px-8 lg:py-24">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink-950 md:text-4xl">
              Why firms use LegalAI
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {WHY_CARDS.map((card) => (
                <article
                  key={card.title}
                  className="rounded-xl border border-ink-200/70 bg-[#fafaf9] p-6 transition hover:border-ink-300"
                >
                  <div className="h-px w-8 bg-emerald-700/80" />
                  <h3 className="mt-4 font-serif text-lg font-semibold text-ink-950">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-b border-ink-200/60 bg-ink-950 text-[#faf8f5]">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center lg:max-w-7xl lg:px-8 lg:py-20">
            <h2 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">
              Ready to review contracts with confidence?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-ink-300 md:text-base">
              See the full flow in your workspace—upload, extract, and run a first-pass review in minutes.
            </p>
            <div className="mt-8">
              <Link
                href="/analyze"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[#faf8f5] px-8 text-base font-semibold text-ink-950 shadow-sm transition hover:bg-white"
              >
                Try Demo
              </Link>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="border-b border-ink-200/60 bg-[#fafaf9]">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:max-w-7xl lg:px-8">
            <h2 className="font-serif text-2xl font-semibold text-ink-950 md:text-3xl">
              Security &amp; privacy for law firms
            </h2>
            <div className="mt-6 max-w-2xl space-y-4 text-sm leading-relaxed text-ink-600 md:text-base">
              <p>
                Your firm&apos;s contracts and data deserve the same care you give your clients. LegalAI is
                built on a secure, multi-tenant platform: we share infrastructure for reliability and scale,
                but your data is strictly isolated. Every record is tagged to your firm and protected by
                access controls at the database level. Other firms cannot see, modify, or export your data.
              </p>
              <p>
                All data is encrypted at rest and in transit. Every connection uses TLS (HTTPS), and we log
                sign-ins, uploads, and document reviews for transparency and audit support. You access data
                only through the LegalAI web app and exports—no direct database access.
              </p>
              <p>
                If you ever need to leave, we&apos;ll provide a structured export of your data so you can
                migrate without lock-in. Your data stays yours.
              </p>
            </div>
            <Link
              href="/security"
              className="mt-6 inline-block text-sm font-semibold text-emerald-900 transition hover:text-emerald-950"
            >
              Read more about security →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200/60 bg-[#fafaf9] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row lg:max-w-7xl lg:px-8">
          <span className="font-serif text-sm text-ink-600">
            © {new Date().getFullYear()} LegalAI. For informational purposes only.
          </span>
          <nav className="flex flex-wrap justify-center gap-8 text-sm text-ink-600" aria-label="Footer">
            <Link href="/security" className="transition hover:text-ink-950">
              Security
            </Link>
            <Link href="/privacy" className="transition hover:text-ink-950">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-ink-950">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
