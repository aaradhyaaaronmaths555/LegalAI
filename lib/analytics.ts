/** Response shape from `get_firm_analytics_dashboard` RPC (firm-scoped). */

export type FirmAnalyticsSeverity = {
  low: number;
  medium: number;
  high: number;
};

export type FirmAnalyticsDecisions = {
  accepted: number;
  edited: number;
  rejected: number;
  not_reviewed: number;
};

export type FirmAnalyticsPayload = {
  ok: true;
  contracts_uploaded_30: number;
  contracts_uploaded_90: number;
  /** Distinct contracts with at least one AI risk flag created in window */
  contracts_with_ai_flags_30: number;
  contracts_with_ai_flags_90: number;
  /** Avg flags per contract among contracts that had ≥1 flag in last 90d */
  avg_issues_per_contract_90: number;
  severity_90d: FirmAnalyticsSeverity;
  decision_latest: FirmAnalyticsDecisions;
  total_risk_flags: number;
};

export type FirmAnalyticsErrorPayload = {
  ok: false;
  error: string;
};
