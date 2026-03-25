/**
 * NDA / MSA risk review: prompt + LLM call + JSON parse.
 * Set OPENAI_API_KEY in .env.local for live calls; otherwise returns a stub JSON (dev).
 */

export type ClauseInput = {
  position: number;
  heading: string | null;
  raw_text: string;
};

export type ParsedRiskIssue = {
  severity: "low" | "medium" | "high";
  category: string;
  explanation: string;
  suggestion: string;
  /** 1-based, matches clauses.position */
  clause_position: number | null;
};

const SYSTEM = `You are a senior contracts analyst assisting with first-pass review only.
Output is NOT legal advice. Flag patterns that often deserve lawyer review for NDAs and MSAs.
Focus on: liability caps, indemnities, IP assignment, confidentiality carve-outs, non-compete,
termination, assignment, governing law, warranty disclaimers, unusual one-sided terms.
Be concise. Respond with ONLY valid JSON matching the schema in the user message.`;

export function buildUserPrompt(
  contractType: "nda" | "msa",
  clauses: ClauseInput[]
): string {
  const lines = clauses.map(
    (c) =>
      `[${c.position}]${c.heading ? ` ${c.heading}` : ""}\n${c.raw_text}`
  );
  return `Contract type: ${contractType.toUpperCase()}

Clauses (numbered by position):
${lines.join("\n\n---\n\n")}

Return a JSON object with this exact shape:
{
  "issues": [
    {
      "severity": "low" | "medium" | "high",
      "category": "short label e.g. Indemnity",
      "explanation": "why this may be risky or non-standard",
      "suggestion": "what to negotiate or verify with counsel",
      "clause_position": <integer matching the clause [n] number, or null if not tied to one clause>
    }
  ]
}

Rules:
- Include 3–12 issues for a typical contract; fewer if the document is short.
- Every issue MUST include clause_position when the issue relates to a specific clause above; otherwise null.
- Do not include markdown or prose outside the JSON.`;
}

function stripCodeFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return t.trim();
}

export function parseIssuesJson(content: string): ParsedRiskIssue[] {
  const raw = stripCodeFence(content);
  const data = JSON.parse(raw) as { issues?: unknown[] };
  if (!Array.isArray(data.issues)) {
    throw new Error("Invalid LLM response: missing issues array");
  }
  const out: ParsedRiskIssue[] = [];
  for (const item of data.issues) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const sev = o.severity;
    if (sev !== "low" && sev !== "medium" && sev !== "high") continue;
    const category = String(o.category ?? "General");
    const explanation = String(o.explanation ?? "");
    const suggestion = String(o.suggestion ?? "");
    let clause_position: number | null = null;
    if (typeof o.clause_position === "number" && Number.isFinite(o.clause_position)) {
      clause_position = Math.floor(o.clause_position);
    }
    out.push({
      severity: sev,
      category,
      explanation,
      suggestion,
      clause_position,
    });
  }
  return out;
}

/**
 * Calls OpenAI Chat Completions if OPENAI_API_KEY is set; otherwise returns stub JSON for local dev.
 * TODO: add Anthropic, Azure, or other providers via env switch.
 */
export async function runRiskLlm(
  contractType: "nda" | "msa",
  clauses: ClauseInput[]
): Promise<{ model: string; rawText: string }> {
  const userPrompt = buildUserPrompt(contractType, clauses);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    const stub = {
      issues: [
        {
          severity: "medium" as const,
          category: "Configuration",
          explanation:
            "No OPENAI_API_KEY in environment. This is a stub result for development.",
          suggestion: "Add OPENAI_API_KEY to .env.local and run analysis again.",
          clause_position: clauses[0]?.position ?? null,
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
        { role: "system", content: SYSTEM },
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
