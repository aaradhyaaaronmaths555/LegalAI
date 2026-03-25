import type { ReviewDecision } from "@/lib/types";

export type ReviewUiStatus = "not_reviewed" | "accepted" | "edited" | "rejected";

export function reviewUiStatus(
  decision: ReviewDecision | undefined
): ReviewUiStatus {
  if (!decision) return "not_reviewed";
  if (decision.action === "accepted") return "accepted";
  if (decision.action === "rejected") return "rejected";
  return "edited";
}

export const REVIEW_STATUS_LABEL: Record<ReviewUiStatus, string> = {
  not_reviewed: "Not reviewed",
  accepted: "Accepted",
  edited: "Edited",
  rejected: "Rejected",
};

export function reviewStatusChipClass(status: ReviewUiStatus): string {
  switch (status) {
    case "not_reviewed":
      return "border border-ink-200/90 bg-ink-50 text-ink-800";
    case "accepted":
      return "border border-emerald-200/90 bg-emerald-50 text-emerald-900";
    case "edited":
      return "border border-amber-200/90 bg-amber-50 text-amber-900";
    case "rejected":
      return "border border-red-200/90 bg-red-50 text-red-900";
    default:
      return "border border-ink-200/90 bg-ink-50 text-ink-800";
  }
}

export type ReviewSummaryCounts = {
  total: number;
  accepted: number;
  edited: number;
  rejected: number;
  notReviewed: number;
};

export function computeReviewSummary(
  flagIds: string[],
  decisionByFlagId: Record<string, ReviewDecision>
): ReviewSummaryCounts {
  let accepted = 0;
  let edited = 0;
  let rejected = 0;
  let notReviewed = 0;
  for (const id of flagIds) {
    const d = decisionByFlagId[id];
    if (!d) {
      notReviewed++;
      continue;
    }
    if (d.action === "accepted") accepted++;
    else if (d.action === "rejected") rejected++;
    else edited++;
  }
  return {
    total: flagIds.length,
    accepted,
    edited,
    rejected,
    notReviewed,
  };
}
