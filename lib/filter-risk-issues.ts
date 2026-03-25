import type { ParsedRiskIssue } from "./llm-nda-msa";

/** Max issues stored per analysis (after dedupe); highest severity kept first. */
export const MAX_STORED_ISSUES = 30;

export type FilterRiskIssuesMeta = {
  /** Count of issues from the model before this filter */
  model_issue_count: number;
  removed_invalid: number;
  removed_duplicate: number;
  removed_cap: number;
  /** Sum of the three removals above */
  total_removed: number;
  final_issue_count: number;
  max_stored_issues: number;
};

const SEVERITY_RANK: Record<ParsedRiskIssue["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function isValidIssue(
  issue: ParsedRiskIssue,
  validPositions: Set<number>
): boolean {
  if (!issue.issue?.trim() || !issue.explanation?.trim()) return false;
  if (
    issue.severity !== "low" &&
    issue.severity !== "medium" &&
    issue.severity !== "high"
  ) {
    return false;
  }
  if (issue.clause_index != null) {
    const n = issue.clause_index;
    if (!Number.isInteger(n) || !validPositions.has(n)) return false;
  }
  return true;
}

function dedupeKey(issue: ParsedRiskIssue): string {
  const idx =
    issue.clause_index === null ? "\0null" : String(issue.clause_index);
  return `${idx}||${issue.category.trim()}||${issue.issue.trim()}`;
}

function sortBySeverityHighFirst(issues: ParsedRiskIssue[]): ParsedRiskIssue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  );
}

/**
 * Drop invalid rows, collapse duplicates (same clause_index + category + issue),
 * then cap count keeping highest-severity instances first.
 */
export function filterRiskIssuesForStorage(
  issues: ParsedRiskIssue[],
  validPositions: Set<number>,
  options?: { maxIssues?: number }
): { issues: ParsedRiskIssue[]; meta: FilterRiskIssuesMeta } {
  const maxIssues = options?.maxIssues ?? MAX_STORED_ISSUES;
  const model_issue_count = issues.length;

  const valid: ParsedRiskIssue[] = [];
  let removed_invalid = 0;
  for (const issue of issues) {
    if (isValidIssue(issue, validPositions)) {
      valid.push(issue);
    } else {
      removed_invalid++;
    }
  }

  const sorted = sortBySeverityHighFirst(valid);
  const seen = new Set<string>();
  const deduped: ParsedRiskIssue[] = [];
  for (const issue of sorted) {
    const k = dedupeKey(issue);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(issue);
  }
  const removed_duplicate = valid.length - deduped.length;

  const capped = deduped.slice(0, maxIssues);
  const removed_cap = deduped.length - capped.length;

  const total_removed = removed_invalid + removed_duplicate + removed_cap;
  return {
    issues: capped,
    meta: {
      model_issue_count,
      removed_invalid,
      removed_duplicate,
      removed_cap,
      total_removed,
      final_issue_count: capped.length,
      max_stored_issues: maxIssues,
    },
  };
}
