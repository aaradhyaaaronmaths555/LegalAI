/**
 * Contract risk review: type-aware prompts + LLM + defensive JSON parse.
 * TODO: optional second-stage AI to merge/dedupe issues or refine clause links.
 */

export type ContractRiskType = "nda" | "msa" | "employment_agreement";

export type ClauseInput = {
  /** 1-based index; matches DB `clauses.position` */
  position: number;
  heading: string | null;
  raw_text: string;
};

export type ParsedRiskIssue = {
  severity: "low" | "medium" | "high";
  /** Checklist / theme label (e.g. scope, indemnities) */
  category: string;
  /** Short headline for the finding */
  issue: string;
  explanation: string;
  suggestion: string;
  /** Matches clause `position` / prompt `index`; null if document-level */
  clause_index: number | null;
};

const CHECKLISTS: Record<
  ContractRiskType,
  { label: string; themes: string[] }
> = {
  nda: {
    label: "NDA (Non-Disclosure Agreement)",
    themes: [
      "scope (what is confidential)",
      "duration / survival of obligations",
      "exclusions / public-domain carve-outs",
      "permitted use and disclosure (need-to-know, recipients)",
      "return or destruction of materials",
      "governing law / jurisdiction / venue",
      "remedies (injunction, liability caps, exclusions)",
    ],
  },
  msa: {
    label: "MSA (Master Service Agreement)",
    themes: [
      "scope of services / deliverables",
      "payment terms, fees, invoicing, late payment",
      "SLA / service levels / credits",
      "IP ownership, licences, background IP",
      "liability caps, exclusions, consequential damages",
      "indemnities (who indemnifies whom, for what)",
      "termination (for convenience, for cause, effect)",
      "assignment / change of control / subcontracting",
    ],
  },
  employment_agreement: {
    label: "Employment Agreement",
    themes: [
      "duties, role, reporting, location / remote work",
      "pay, benefits, superannuation / pension where relevant",
      "IP assignment and moral rights",
      "confidentiality during and after employment",
      "restraint / non-compete / non-solicit (reasonableness)",
      "termination (summary vs notice), garden leave",
      "notice periods (both sides)",
      "redundancy / severance if mentioned",
    ],
  },
};

const SYSTEM_BASE = `You are a senior commercial contracts analyst performing a first-pass review only.
Output is NOT legal advice. Be specific to the supplied clauses. Prefer actionable, negotiable points.
Flag patterns that often deserve lawyer review for this contract type.
Stay concise. Do not invent facts not supported by the text.

You MUST respond with ONLY a single JSON object — no markdown fences, no commentary before or after.
TODO: a future pipeline step may refine boundaries using embeddings or a second model pass.`;

const JSON_SHAPE = `{
  "issues": [
    {
      "clause_index": <integer matching a clause index from the input, or null if document-wide>,
      "severity": "low" | "medium" | "high",
      "category": "<one of the checklist themes below, or a close synonym>",
      "issue": "<short headline, max ~120 chars>",
      "explanation": "<1–3 sentences: what in the clause worries you and why>",
      "suggestion": "<what to negotiate, clarify, or verify with counsel>"
    }
  ]
}`;

export function buildUserPrompt(
  contractType: ContractRiskType,
  clauses: ClauseInput[],
  options?: { fallback?: boolean }
): string {
  const pack = CHECKLISTS[contractType];
  const checklist = pack.themes.map((t) => `- ${t}`).join("\n");

  const clauseBlocks = clauses.map((c) => {
    const head = c.heading?.trim() ? c.heading.trim() : "(no heading)";
    return JSON.stringify({
      index: c.position,
      heading: head,
      text: c.raw_text,
    });
  });

  const intro = options?.fallback
    ? `The previous answer was not valid JSON. Reply again with ONLY the JSON object, nothing else.

Contract type: ${pack.label}

Clauses as JSON lines (index = clause index):
${clauseBlocks.join("\n")}

Checklist themes to consider:
${checklist}

Required JSON shape (exactly):
${JSON_SHAPE}

Rules:
- 3–12 issues for a typical contract; fewer if very short.
- Every issue MUST have non-empty "issue", "explanation", and "suggestion".
- "clause_index" MUST be one of the supplied indexes, or null for cross-cutting points.
- "category" should map to the checklist where possible.`
    : `Contract type: ${pack.label}

Review priorities (use these as categories where they fit):
${checklist}

Clauses (each line is a JSON object with index, heading, text):
${clauseBlocks.join("\n")}

Return ONLY this JSON structure (no markdown, no code fences):
${JSON_SHAPE}

Rules:
- Include 3–12 issues for a typical contract; fewer if the document is short.
- Each issue MUST include: clause_index (when tied to one clause), severity, category, issue, explanation, suggestion.
- "clause_index" must match an "index" from the clauses above, or null if not tied to a single clause.
- "category" should align with the checklist themes when possible (short snake_case or Title Case label).
- "issue" is a one-line title; "explanation" expands; "suggestion" is negotiable or a verification step.
- Do not output markdown, backticks, or any text outside the JSON object.`;

  return intro;
}

/** Strip ```json / ``` wrappers and trim; also remove a leading "json" line. */
export function stripCodeFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "");
  t = t.replace(/\s*```$/i, "");
  t = t.trim();
  if (/^json\s*\n/i.test(t)) {
    t = t.replace(/^json\s*\n/i, "");
  }
  return t.trim();
}

/**
 * If the model wrapped JSON in prose, take the first top-level `{ ... }` by brace matching.
 * TODO: optional AI repair pass for severely malformed JSON.
 */
export function extractJsonObjectFromText(text: string): string | null {
  const s = stripCodeFences(text);
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

function normalizeClauseIndex(
  v: unknown,
  validPositions: Set<number>
): number | null {
  if (v === null || v === undefined) return null;
  let n: number;
  if (typeof v === "number") {
    if (!Number.isInteger(v)) return null;
    n = v;
  } else if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    n = parseInt(v.trim(), 10);
  } else {
    return null;
  }
  if (!validPositions.has(n)) return null;
  return n;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Parses model output; returns issues filtered to valid clause indices and required fields.
 * Does not throw — use `ok` to see if the payload was structurally usable.
 */
export function parseIssuesJson(
  content: string,
  validPositions: Set<number>
): { ok: boolean; issues: ParsedRiskIssue[]; data: Record<string, unknown> | null } {
  const stripped = stripCodeFences(content);
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch {
    const extracted = extractJsonObjectFromText(content);
    if (!extracted) {
      return { ok: false, issues: [], data: null };
    }
    try {
      raw = JSON.parse(extracted);
    } catch {
      return { ok: false, issues: [], data: null };
    }
  }

  if (!raw || typeof raw !== "object") {
    return { ok: false, issues: [], data: null };
  }
  const data = raw as Record<string, unknown>;
  const issuesRaw = data.issues;
  if (!Array.isArray(issuesRaw)) {
    return { ok: false, issues: [], data: null };
  }

  const issues: ParsedRiskIssue[] = [];
  for (const item of issuesRaw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const sev = o.severity;
    if (sev !== "low" && sev !== "medium" && sev !== "high") continue;

    const idx =
      normalizeClauseIndex(o.clause_index, validPositions) ??
      normalizeClauseIndex(o.clause_position, validPositions);

    if (!isNonEmptyString(o.issue) || !isNonEmptyString(o.explanation)) {
      continue;
    }

    const category = isNonEmptyString(o.category)
      ? String(o.category).trim()
      : "general";
    const suggestion = isNonEmptyString(o.suggestion)
      ? String(o.suggestion).trim()
      : "";

    issues.push({
      severity: sev,
      category,
      issue: String(o.issue).trim(),
      explanation: String(o.explanation).trim(),
      suggestion,
      clause_index: idx,
    });
  }

  return { ok: true, issues, data };
}

/** Merge headline + body for a single DB `explanation` column. */
export function formatIssueExplanation(issue: ParsedRiskIssue): string {
  return `${issue.issue}\n\n${issue.explanation}`.trim();
}

/**
 * Calls OpenAI Chat Completions if OPENAI_API_KEY is set; otherwise returns stub JSON for local dev.
 * TODO: add Anthropic, Azure, or other providers via env switch.
 */
export async function runRiskLlm(
  contractType: ContractRiskType,
  clauses: ClauseInput[],
  options?: { fallback?: boolean }
): Promise<{ model: string; rawText: string }> {
  const userPrompt = buildUserPrompt(contractType, clauses, options);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    const stub = {
      issues: [
        {
          clause_index: clauses[0]?.position ?? null,
          severity: "medium" as const,
          category: "configuration",
          issue: "API key not configured",
          explanation:
            "No OPENAI_API_KEY in environment. This is a stub result for development.",
          suggestion: "Add OPENAI_API_KEY to .env.local and run analysis again.",
        },
      ],
    };
    return { model: "stub", rawText: JSON.stringify(stub) };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_BASE },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!rawText) {
    throw new Error("Empty LLM response");
  }
  return { model, rawText };
}

/**
 * Run primary prompt, then on parse failure a stricter fallback prompt (one retry).
 */
export async function runRiskLlmWithRetry(
  contractType: ContractRiskType,
  clauses: ClauseInput[],
  validPositions: Set<number>
): Promise<{
  model: string;
  rawText: string;
  issues: ParsedRiskIssue[];
  parsed: Record<string, unknown> | null;
  usedFallback: boolean;
}> {
  const first = await runRiskLlm(contractType, clauses, { fallback: false });
  let parsed = parseIssuesJson(first.rawText, validPositions);
  if (parsed.ok) {
    return {
      model: first.model,
      rawText: first.rawText,
      issues: parsed.issues,
      parsed: parsed.data,
      usedFallback: false,
    };
  }

  const second = await runRiskLlm(contractType, clauses, { fallback: true });
  parsed = parseIssuesJson(second.rawText, validPositions);
  if (!parsed.ok) {
    throw new Error("Could not parse AI response");
  }
  return {
    model: second.model,
    rawText: second.rawText,
    issues: parsed.issues,
    parsed: parsed.data,
    usedFallback: true,
  };
}
