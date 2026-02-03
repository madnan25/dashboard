export type UserRole = "cmo" | "brand_manager" | "sales_ops" | "viewer" | "member";
export type PlanStatus = "draft" | "submitted" | "approved" | "rejected";
export type PlanChannel = "digital" | "activations" | "inbound";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  is_marketing_team?: boolean;
  is_marketing_manager?: boolean;
};

export type Project = {
  id: string;
  name: string;
  is_active: boolean;
};

export type TaskTeam = {
  id: string;
  name: string;
  ticket_prefix?: string | null;
  description: string | null;
  approver_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  // Adjustments (entered by Sales Ops via sales_attribution_events; rolled up by trigger)
  deals_won_transfer_in: number;
  sqft_won_transfer_in: number;
  // Derived visibility: what this project's leads closed as in other projects (computed from same transfer events)
  deals_won_transfer_out: number;
  sqft_won_transfer_out: number;
  deals_won_misc: number;
  sqft_won_misc: number;
  spend_digital: number;
  spend_inbound: number;
  spend_activations: number;
};

export type SalesAttributionSourceKind = "campaign" | "project" | "unknown";
export type SalesAttributionBucket = "transfer" | "misc";

export type SalesAttributionEvent = {
  id: string;
  closed_project_id: string;
  close_year: number;
  close_month: number; // 1-12
  deals_won: number;
  sqft_won: number;
  source_kind: SalesAttributionSourceKind;
  source_campaign: string | null;
  source_project_id: string | null;
  bucket: SalesAttributionBucket;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectActualsChannel = {
  project_id: string;
  year: number;
  month: number; // 1-12
  channel: PlanChannel;
  leads: number;
  not_contacted: number;
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
  not_contacted: number;
  qualified_leads: number;
  meetings_scheduled: number;
  meetings_done: number;
  deals_won: number;
  sqft_won: number;
  updated_at?: string;
};

export type SalesOpsActualsAuditAction = "insert" | "update" | "delete";

export type SalesOpsActualsAuditEntry = {
  id: number;
  event_time: string;
  action: SalesOpsActualsAuditAction;
  table_name: string;
  project_id: string | null;
  year: number | null;
  month: number | null;
  channel: string | null;
  source: string | null;
  bucket: string | null;
  closed_project_id: string | null;
  source_project_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_email: string | null;
  actor_name: string | null;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
};

export type TaskStatus = "queued" | "in_progress" | "submitted" | "approved" | "closed" | "on_hold" | "blocked" | "dropped";
export type TaskPriority = "p0" | "p1" | "p2" | "p3";
export type TaskApprovalState = "not_required" | "pending" | "approved";
export type TaskWeightTier = "small" | "medium" | "large" | "critical";
export type TaskMasterCalendarTag = "marketing" | "sales" | "design";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  approval_state: TaskApprovalState;
  approved_by: string | null;
  approved_at: string | null;
  team_id: string | null;
  approver_user_id: string | null;
  assignee_id: string | null;
  project_id: string | null;
  due_at: string | null; // date
  master_calendar_tag?: TaskMasterCalendarTag | null;
  weight_tier?: TaskWeightTier;
  base_weight?: number;
  completed_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// View-only master calendar rows returned by RPC (keeps task table private to marketing team).
export type MasterCalendarTask = {
  id: string;
  title: string;
  due_at: string | null; // date
  master_calendar_tag: TaskMasterCalendarTag;
  priority: TaskPriority;
  status: TaskStatus;
  out_of_sync: boolean;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  uploader_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

export type TaskCommentMention = {
  comment_id: string;
  user_id: string;
  created_at: string;
};

export type TaskCommentAttachment = {
  comment_id: string;
  attachment_id: string;
  created_at: string;
};

export type TaskDependency = {
  id: string;
  blocker_task_id: string;
  blocked_task_id: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

export type TaskWeightConfig = {
  id: "global";
  small_points: number;
  medium_points: number;
  large_points: number;
  critical_points: number;
  mp_p0: string;
  mp_p1: string;
  mp_p2: string;
  mp_p3: string;
  me_3plus: string;
  me_1to2: string;
  me_ontime: string;
  ml_1to2: string;
  ml_3to5: string;
  ml_6plus: string;
  small_weekly_cap: number;
  small_overcap_multiplier: string;
  updated_by: string | null;
  updated_at: string;
};

export type TaskPointsLedgerEntry = {
  id: string;
  user_id: string;
  task_id: string;
  weight_tier: TaskWeightTier;
  points_awarded: string;
  breakdown: Record<string, unknown>;
  week_start: string; // date
  created_at: string;
};

export type TaskContributionRole = "primary" | "secondary" | "coordinator";

export type TaskContribution = {
  id: string;
  task_id: string;
  user_id: string;
  role: TaskContributionRole;
  created_at: string;
  updated_at: string;
};

// Subtasks have a simplified 4-stage model.
export type TaskSubtaskStatus = "not_done" | "done" | "blocked" | "on_hold";

export type TaskSubtask = {
  id: string;
  task_id: string;
  created_by?: string | null;
  title: string;
  description: string | null;
  status: TaskSubtaskStatus;
  assignee_id: string | null;
  linked_task_id?: string | null;
  due_at: string | null; // date
  effort_points: number;
  last_nudged_at?: string | null;
  last_nudged_by?: string | null;
  last_nudged_assignee_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskSubtaskDependency = {
  id: string;
  blocked_subtask_id: string;
  blocker_task_id: string | null;
  blocker_subtask_id: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

export type TaskFlowApproverKind = "marketing_manager" | "user" | "ticket_manager";
export type TaskFlowStepStatus = "pending" | "approved";

export type TaskFlowTemplate = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFlowTemplateStep = {
  id: string;
  template_id: string;
  step_order: number;
  step_key: string;
  label: string;
  approver_kind: TaskFlowApproverKind;
  approver_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFlowInstance = {
  id: string;
  task_id: string;
  template_id: string | null;
  current_step_order: number;
  is_overridden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFlowStepInstance = {
  id: string;
  flow_instance_id: string;
  step_order: number;
  step_key: string;
  label: string;
  approver_user_id: string | null;
  status: TaskFlowStepStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskEvent = {
  id: string;
  task_id: string;
  actor_id: string | null;
  type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
};

export type NotificationType =
  | "task_assigned"
  | "task_approval_requested"
  | "task_approved"
  | "subtask_assigned"
  | "subtask_nudge"
  | "comment_mention";

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_task_id: string | null;
  created_at: string;
  read_at: string | null;
};

export type MarketingHomeInboxTask = {
  id: string;
  // "task" (default) or "subtask" rows returned by the inbox RPC.
  item_type?: "task" | "subtask";
  // For subtasks, this points to the parent ticket id used for navigation.
  task_id?: string;
  title: string;
  // For subtasks, the actual subtask title (shown with a pill marker in UI).
  subtask_title?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  approval_state: TaskApprovalState;
  approver_user_id: string | null;
  assignee_id: string | null;
  created_by: string | null;
  due_at: string | null;
  updated_at: string;
};

export type MarketingHomeInbox = {
  assigned_count: number;
  approval_count: number;
  overdue_count: number;
  involved_count: number;
  items: MarketingHomeInboxTask[];
};

