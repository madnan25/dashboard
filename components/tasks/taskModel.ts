import type { Profile, Task, TaskApprovalState, TaskPriority, TaskStatus } from "@/lib/dashboardDb";

export const TASK_STATUSES: TaskStatus[] = [
  "queued",
  "in_progress",
  "submitted",
  "approved",
  "closed",
  "on_hold",
  "blocked",
  "dropped"
];

export const PRIMARY_FLOW: TaskStatus[] = ["queued", "in_progress", "submitted", "approved", "closed"];
export const SIDE_LANE: TaskStatus[] = ["on_hold", "blocked", "dropped"];

export function statusLabel(s: TaskStatus) {
  switch (s) {
    case "queued":
      return "Queued";
    case "in_progress":
      return "In Progress";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "closed":
      return "Closed";
    case "on_hold":
      return "On Hold";
    case "blocked":
      return "Blocked";
    case "dropped":
      return "Dropped";
  }
}

export function priorityLabel(p: TaskPriority) {
  return p.toUpperCase();
}

export function approvalLabel(a: TaskApprovalState) {
  switch (a) {
    case "not_required":
      return "Approval not required";
    case "pending":
      return "Pending approval";
    case "approved":
      return "Approved";
  }
}

export function taskIsOpen(t: Task) {
  return t.status !== "closed" && t.status !== "dropped";
}

export function isMarketingTeamProfile(p: Profile | null | undefined): p is Profile {
  // Marketing team membership is primarily driven by role (member/brand_manager/cmo),
  // with `is_marketing_team` used as an override for special cases (e.g. viewer read-only).
  return Boolean(
    p &&
      p.role !== "sales_ops" &&
      p.role !== "viewer" &&
      p.role !== "admin_viewer" &&
      (p.role === "cmo" || p.role === "brand_manager" || p.role === "member" || p.is_marketing_team === true)
  );
}

export function isMarketingManagerProfile(p: Profile | null | undefined): boolean {
  if (!p) return false;
  if (p.role === "cmo") return true;
  if (p.role === "brand_manager") return true;
  return isMarketingTeamProfile(p) && p.is_marketing_manager === true;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // Monday=0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

/**
 * Generates a team prefix from a team name.
 * Uses the first word if multiple words, or first 3-4 letters if single word.
 * Examples: "Graphic Vision" -> "GV", "Design" -> "DES", "Production" -> "PROD"
 */
export function getTeamPrefix(teamName: string): string {
  const trimmed = teamName.trim();
  if (!trimmed) return "TKT";
  
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    // Multiple words: use first letter of each word (up to 4 words)
    return words
      .slice(0, 4)
      .map((w) => w.charAt(0).toUpperCase())
      .join("");
  } else {
    // Single word: use first 3-4 letters
    const firstWord = words[0];
    if (firstWord.length <= 4) {
      return firstWord.toUpperCase();
    }
    return firstWord.substring(0, 4).toUpperCase();
  }
}

