/**
 * Phase 3 static playbook: checklist labels + the exact theme lines fed to the LLM.
 * Keep promptTheme strings in sync with buildUserPrompt() usage via getPlaybookForLlm().
 */

import type { ContractType, RiskFlag } from "./types";

export type PlaybookChecklistItem = {
  id: string;
  /** Short label in the UI */
  shortTitle: string;
  /**
   * Single line in the model checklist — the model should use this (or a close synonym)
   * as JSON "category" when the issue relates to this theme.
   */
  promptTheme: string;
};

type PlaybookPack = {
  label: string;
  items: PlaybookChecklistItem[];
};

const NDA_PLAYBOOK: PlaybookPack = {
  label: "NDA (Non-Disclosure Agreement)",
  items: [
    {
      id: "nda_scope",
      shortTitle: "Scope of confidential information",
      promptTheme: "scope (what is confidential)",
    },
    {
      id: "nda_term",
      shortTitle: "Term / duration",
      promptTheme: "duration / survival of obligations",
    },
    {
      id: "nda_exclusions",
      shortTitle: "Exclusions / carve-outs",
      promptTheme: "exclusions / public-domain carve-outs",
    },
    {
      id: "nda_permitted_use",
      shortTitle: "Permitted use & disclosure",
      promptTheme: "permitted use and disclosure (need-to-know, recipients)",
    },
    {
      id: "nda_return_deletion",
      shortTitle: "Return or deletion of materials",
      promptTheme: "return or destruction of materials",
    },
    {
      id: "nda_remedies",
      shortTitle: "Remedies",
      promptTheme: "remedies (injunction, liability caps, exclusions)",
    },
    {
      id: "nda_governing_law",
      shortTitle: "Governing law & jurisdiction",
      promptTheme: "governing law / jurisdiction / venue",
    },
  ],
};

const MSA_PLAYBOOK: PlaybookPack = {
  label: "MSA (Master Service Agreement)",
  items: [
    {
      id: "msa_scope",
      shortTitle: "Scope of services",
      promptTheme: "scope of services / deliverables",
    },
    {
      id: "msa_sla",
      shortTitle: "SLAs & service levels",
      promptTheme: "SLA / service levels / credits",
    },
    {
      id: "msa_ip",
      shortTitle: "IP ownership & licences",
      promptTheme: "IP ownership, licences, background IP",
    },
    {
      id: "msa_data",
      shortTitle: "Data protection & privacy",
      promptTheme: "data protection / privacy / security (subprocessors, DPA)",
    },
    {
      id: "msa_liability",
      shortTitle: "Liability caps & exclusions",
      promptTheme: "liability caps, exclusions, consequential damages",
    },
    {
      id: "msa_indemnity",
      shortTitle: "Indemnities",
      promptTheme: "indemnities (who indemnifies whom, for what)",
    },
    {
      id: "msa_termination",
      shortTitle: "Termination",
      promptTheme: "termination (for convenience, for cause, effect)",
    },
    {
      id: "msa_renewal",
      shortTitle: "Renewal & extension",
      promptTheme: "renewal, extension, auto-renewal",
    },
  ],
};

const EA_PLAYBOOK: PlaybookPack = {
  label: "Employment Agreement",
  items: [
    {
      id: "ea_role",
      shortTitle: "Duties, role & location",
      promptTheme: "duties, role, reporting, location / remote work",
    },
    {
      id: "ea_comp",
      shortTitle: "Pay & benefits",
      promptTheme: "pay, benefits, superannuation / pension where relevant",
    },
    {
      id: "ea_ip",
      shortTitle: "IP assignment",
      promptTheme: "IP assignment and moral rights",
    },
    {
      id: "ea_conf",
      shortTitle: "Confidentiality",
      promptTheme: "confidentiality during and after employment",
    },
    {
      id: "ea_restraint",
      shortTitle: "Restraint & non-solicit",
      promptTheme: "restraint / non-compete / non-solicit (reasonableness)",
    },
    {
      id: "ea_termination",
      shortTitle: "Termination & garden leave",
      promptTheme: "termination (summary vs notice), garden leave",
    },
    {
      id: "ea_notice",
      shortTitle: "Notice periods",
      promptTheme: "notice periods (both sides)",
    },
    {
      id: "ea_severance",
      shortTitle: "Redundancy / severance",
      promptTheme: "redundancy / severance if mentioned",
    },
  ],
};

export const CONTRACT_PLAYBOOKS: Record<ContractType, PlaybookPack> = {
  nda: NDA_PLAYBOOK,
  msa: MSA_PLAYBOOK,
  employment_agreement: EA_PLAYBOOK,
};

/** Label + theme lines for the risk LLM prompt (must stay aligned with UI checklist). */
export function getPlaybookForLlm(contractType: ContractType): {
  label: string;
  themes: string[];
} {
  const pack = CONTRACT_PLAYBOOKS[contractType];
  return {
    label: pack.label,
    themes: pack.items.map((i) => i.promptTheme),
  };
}

export function getPlaybookItems(contractType: ContractType): PlaybookChecklistItem[] {
  return CONTRACT_PLAYBOOKS[contractType].items;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Heuristic: at least one AI issue "touches" this checklist row if category or body text
 * overlaps the playbook line (same language as the model prompt).
 */
export function playbookItemMatchesFlag(
  item: PlaybookChecklistItem,
  flag: Pick<RiskFlag, "category" | "explanation" | "suggestion">
): boolean {
  const hay = norm(`${flag.category} ${flag.explanation} ${flag.suggestion ?? ""}`);
  if (!hay) return false;

  const themeNorm = norm(item.promptTheme);
  if (themeNorm.length >= 12 && hay.includes(themeNorm)) return true;

  const titleWords = norm(item.shortTitle)
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  for (const w of titleWords) {
    if (hay.includes(w)) return true;
  }

  const parts = item.promptTheme
    .toLowerCase()
    .split(/[/()]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    for (const w of part.split(/\s+/)) {
      const nw = norm(w);
      if (nw.length >= 4 && hay.includes(nw)) return true;
    }
  }

  const cat = norm(flag.category);
  const hint = norm(item.shortTitle).slice(0, 14);
  if (hint.length >= 6 && cat.includes(hint)) return true;

  return false;
}

export function getPlaybookCoverage(
  contractType: ContractType,
  flags: Pick<RiskFlag, "category" | "explanation" | "suggestion">[]
): { id: string; shortTitle: string; covered: boolean }[] {
  const items = getPlaybookItems(contractType);
  return items.map((item) => ({
    id: item.id,
    shortTitle: item.shortTitle,
    covered: flags.some((f) => playbookItemMatchesFlag(item, f)),
  }));
}
