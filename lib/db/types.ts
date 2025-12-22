export type UserRole = "cmo" | "brand_manager" | "sales_ops" | "viewer";
export type PlanStatus = "draft" | "submitted" | "approved" | "rejected";
export type PlanChannel = "digital" | "activations" | "inbound";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
};

export type Project = {
  id: string;
  name: string;
  is_active: boolean;
};

export type ProjectTargets = {
  project_id: string;
  year: number;
  month: number; // 1-12
  sales_target_sqft: number;
  avg_sqft_per_deal: number;
  total_budget: number;
  // Funnel rates configured by CMO (0-100)
  qualified_to_meeting_done_percent: number;
  meeting_done_to_close_percent: number;
};

export type PlanVersion = {
  id: string;
  project_id: string;
  year: number;
  month: number; // 1-12
  created_by: string;
  status: PlanStatus;
  active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanChannelInputs = {
  plan_version_id: string;
  channel: PlanChannel;
  expected_leads: number;
  qualification_percent: number;
  target_contribution_percent: number;
  allocated_budget: number;
};

export type DigitalSource = "meta" | "web";

export type ProjectActuals = {
  project_id: string;
  year: number;
  month: number; // 1-12
  leads: number;
  qualified_leads: number;
  meetings_scheduled: number;
  meetings_done: number;
  deals_won: number;
  sqft_won: number;
  spend_digital: number;
  spend_inbound: number;
  spend_activations: number;
};

export type ProjectActualsChannel = {
  project_id: string;
  year: number;
  month: number; // 1-12
  channel: PlanChannel;
  leads: number;
  qualified_leads: number;
  meetings_scheduled: number;
  meetings_done: number;
  deals_won: number;
  sqft_won: number;
  updated_at?: string;
};

export type ProjectActualsDigitalSource = {
  project_id: string;
  year: number;
  month: number; // 1-12
  source: DigitalSource;
  leads: number;
  qualified_leads: number;
  meetings_scheduled: number;
  meetings_done: number;
  deals_won: number;
  sqft_won: number;
  updated_at?: string;
};

