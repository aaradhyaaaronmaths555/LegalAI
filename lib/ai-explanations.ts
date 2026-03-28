import type { ContractType } from "@/lib/types";

/**
 * Static "playbook" blurbs: why a checklist theme tends to matter for this contract type.
 * No DB — computed in the UI from `contracts.contract_type` + `risk_flags.category`.
 * Kept in sync by convention with themes referenced in `lib/llm-nda-msa.ts` prompts.
 */

type ThemeBlurb = { themeNeedle: string; blurb: string };

const NDA_THEMES: ThemeBlurb[] = [
  {
    themeNeedle: "scope",
    blurb:
      "Ambiguous confidentiality scope is a common source of breach claims and negotiation deadlock. Partners usually want the definition tight enough to be enforceable but not so broad that day-to-day work becomes risky.",
  },
  {
    themeNeedle: "duration",
    blurb:
      "Survival periods drive how long obligations last after the relationship ends. They affect disclosure decisions and insurance tail — worth matching to how long information stays sensitive for your client.",
  },
  {
    themeNeedle: "exclusions",
    blurb:
      "Carve-outs (public domain, prior knowledge, independent development) limit overreach. Missing or vague exclusions can make NDAs hard to advise on at signing or during a dispute.",
  },
  {
    themeNeedle: "permitted use",
    blurb:
      "Need-to-know, onward disclosure, and recipient rules determine whether your client can actually collaborate. Weak language here often surfaces in diligence or when using contractors.",
  },
  {
    themeNeedle: "return or destruction",
    blurb:
      "Clear return/destruction (and what may be retained in ordinary backup or for legal hold) reduces post-close friction and records disputes.",
  },
  {
    themeNeedle: "governing law",
    blurb:
      "Venue and governing law affect cost, speed, and predictability of enforcement — especially cross-border. In-house teams often standardise this across templates.",
  },
  {
    themeNeedle: "remedies",
    blurb:
      "Injunction clauses, caps, and exclusions of consequential loss materially change risk allocation. This is where many firms want partner eyes before sign-off.",
  },
];

const MSA_THEMES: ThemeBlurb[] = [
  {
    themeNeedle: "scope of services",
    blurb:
      "Ambiguous deliverables or scope creep language drives fee disputes and SLA arguments. Aligning this with Statements of Work saves downstream fights.",
  },
  {
    themeNeedle: "payment",
    blurb:
      "Invoicing, late fees, suspension, and set-off rights affect cash flow and practical leverage. Finance and legal usually review this together.",
  },
  {
    themeNeedle: "SLA",
    blurb:
      "Service credits and remedies tied to uptime/performance define commercial teeth. Weak SLAs are hard to enforce; overly punitive ones can crater the relationship.",
  },
  {
    themeNeedle: "IP ownership",
    blurb:
      "Who owns deliverables, background IP, and improvements affects valuation, sublicensing, and exit. This is often non-negotiable for product teams.",
  },
  {
    themeNeedle: "liability caps",
    blurb:
      "Caps, carve-outs for gross negligence/fraud/IP, and super-caps for data breaches often determine whether the deal is insurable and board-acceptable.",
  },
  {
    themeNeedle: "indemnities",
    blurb:
      "Indemnity scope (third-party IP, privacy, employee claims) and survival can dwarf the commercial fee. Partners care about symmetry and baskets.",
  },
  {
    themeNeedle: "termination",
    blurb:
      "For-cause vs convenience, transition assistance, and survival of payment/IP/confidentiality shape exit risk — especially for multi-year engagements.",
  },
  {
    themeNeedle: "assignment",
    blurb:
      "Change-of-control and assignment affect what happens on M&A or outsourcing. Clients often require consent or step-in rights here.",
  },
];

const EA_THEMES: ThemeBlurb[] = [
  {
    themeNeedle: "duties",
    blurb:
      "Role clarity, location, and flexibility clauses affect day-to-day enforceability and policy alignment — and often interact with award/employment-law minima.",
  },
  {
    themeNeedle: "pay",
    blurb:
      "Salary, bonus, super/pension, and benefits language ties directly to regulatory compliance and disputes. Bonuses with vague discretion are a frequent escalation point.",
  },
  {
    themeNeedle: "IP assignment",
    blurb:
      "Assignment of inventions and moral rights affects anything the employee creates. R&D and product counsel usually want this watertight pre-boarding.",
  },
  {
    themeNeedle: "confidentiality during",
    blurb:
      "Employee confidentiality can overlap with NDA and code-of-conduct policies; inconsistency creates enforcement gaps after departure.",
  },
  {
    themeNeedle: "restraint",
    blurb:
      "Non-compete, non-solicit, and non-poach provisions vary wildly in enforceability by jurisdiction. These are classic ‘partner review’ items before sign-off.",
  },
  {
    themeNeedle: "termination",
    blurb:
      "Summary dismissal tests, notice, garden leave, and PILON interact with statutory minima; vague drafting invites wrongful dismissal exposure.",
  },
  {
    themeNeedle: "notice periods",
    blurb:
      "Symmetric or asymmetric notice affects workforce planning and garden-leave costs. Misalignment with policies or awards is a common redline.",
  },
  {
    themeNeedle: "redundancy",
    blurb:
      "If redundancy/severance is mentioned, employers need consistency with policies and statute; vague formulas often get renegotiated under pressure.",
  },
];

const BY_TYPE: Record<ContractType, ThemeBlurb[]> = {
  nda: NDA_THEMES,
  msa: MSA_THEMES,
  employment_agreement: EA_THEMES,
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(categoryNorm: string, needleNorm: string): number {
  if (!categoryNorm || !needleNorm) return 0;
  if (categoryNorm.includes(needleNorm)) return needleNorm.length + 20;
  if (needleNorm.includes(categoryNorm.slice(0, Math.min(categoryNorm.length, 24)))) return 10;
  const cTokens = categoryNorm.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const nTokens = needleNorm.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  let hit = 0;
  for (const t of nTokens) {
    if (cTokens.some((ct) => ct === t || ct.startsWith(t) || t.startsWith(ct))) hit++;
  }
  return hit;
}

/**
 * Best-effort match of model `category` to a playbook blurb (themes are phrased like the LLM checklist).
 */
export function getPracticeContextBlurb(
  contractType: ContractType,
  category: string
): string | null {
  const table = BY_TYPE[contractType];
  if (!table?.length) return null;
  const cat = normalize(category);
  let best: ThemeBlurb | null = null;
  let bestScore = 0;
  for (const row of table) {
    const needle = normalize(row.themeNeedle);
    const s = scoreMatch(cat, needle);
    if (s > bestScore) {
      bestScore = s;
      best = row;
    }
  }
  if (best && bestScore >= 4) return best.blurb;
  return null;
}

/**
 * When no theme matches, still give a short, firm-friendly line (severity-aware).
 */
export function getGenericPracticeLine(
  contractType: ContractType,
  severity: "low" | "medium" | "high"
): string {
  const typeLabel =
    contractType === "nda"
      ? "NDAs"
      : contractType === "msa"
        ? "MSAs"
        : "employment agreements";
  if (severity === "high") {
    return `This item is flagged as high severity on your review checklist for ${typeLabel}. It is worth explicit lawyer sign-off before you treat the issue as closed.`;
  }
  if (severity === "medium") {
    return `This theme is part of your standard ${typeLabel} review playbook. Use your firm’s usual escalation path for medium-risk items.`;
  }
  return `Lower-severity playbook note: still confirm against client instructions and any firm-wide policy exceptions for ${typeLabel}.`;
}
