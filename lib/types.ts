export type ContractType = "nda" | "msa" | "employment_agreement";
export type ContractStatus = "uploaded" | "processing" | "completed" | "failed";

export type Firm = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Contract = {
  id: string;
  firm_id: string;
  title: string;
  contract_type: ContractType;
  file_path: string;
  file_name: string;
  status: ContractStatus;
  raw_text: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  uploader?: { name: string | null; email: string | null };
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  nda: "NDA (Non-Disclosure Agreement)",
  msa: "MSA (Master Service Agreement)",
  employment_agreement: "Employment Agreement (EA)",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};
