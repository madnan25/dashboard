export type BrandMonthlyPlan = {
  monthIndex: number; // 0-11
  year: number;
  salesTargetSqft: number;
  averageDealSizeSqft: number;
  digitalTargetPercent: number; // 0-100 (% of target expected from digital)
  allocatedBudgetDigital: number; // PKR
  expectedLeadVolume: number;
  expectedQualifiedPercent: number; // 0-100
};

export type BrandMonthlyActuals = {
  monthIndex: number; // 0-11
  year: number;
  budgetSpentDigital?: number;
  dealsWon?: number;
  leadsGenerated?: number;
  qualifiedLeads?: number;
  meetingsScheduled?: number;
  qualifiedMeetingsCompleted?: number;
};

export type BrandComputedTargets = {
  dealsRequired: number;
  digitalDealsRequired: number;
  qualifiedMeetingsRequired: number;
  digitalQualifiedMeetingsRequired: number;
  targetLeads: number;
  targetQualifiedLeads: number;
};

export function computeBrandTargets(plan: BrandMonthlyPlan): BrandComputedTargets {
  const dealsRequired = Math.max(0, Math.ceil(plan.salesTargetSqft / Math.max(plan.averageDealSizeSqft, 1)));
  const digitalDealsRaw = dealsRequired * (plan.digitalTargetPercent / 100);
  const digitalDealsRequired = Math.max(0, Math.ceil(digitalDealsRaw));

  // "Qualified meetings required" = deals × 2 (and digital deals × 2).
  const qualifiedMeetingsRequired = Math.max(0, Math.ceil(dealsRequired * 2));
  const digitalQualifiedMeetingsRequired = Math.max(0, digitalDealsRequired * 2);

  const targetLeads = Math.max(0, Math.round(plan.expectedLeadVolume));
  const targetQualifiedLeads = Math.max(
    0,
    Math.round(targetLeads * (plan.expectedQualifiedPercent / 100))
  );

  return {
    dealsRequired,
    digitalDealsRequired,
    qualifiedMeetingsRequired,
    digitalQualifiedMeetingsRequired,
    targetLeads,
    targetQualifiedLeads
  };
}

function keyFor(monthIndex: number, year: number) {
  return `brandMonthlyPlan:v2:${year}-${monthIndex}`;
}

function actualsKeyFor(monthIndex: number, year: number) {
  return `brandMonthlyActuals:v1:${year}-${monthIndex}`;
}

export function loadBrandMonthlyPlan(monthIndex: number, year: number): BrandMonthlyPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(monthIndex, year));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrandMonthlyPlan;
    if (typeof parsed !== "object" || parsed == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBrandMonthlyPlan(input: BrandMonthlyPlan) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(input.monthIndex, input.year), JSON.stringify(input));
}

export function clearBrandMonthlyPlan(monthIndex: number, year: number) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(monthIndex, year));
}

export function loadBrandMonthlyActuals(monthIndex: number, year: number): BrandMonthlyActuals | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(actualsKeyFor(monthIndex, year));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrandMonthlyActuals;
    if (typeof parsed !== "object" || parsed == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBrandMonthlyActuals(input: BrandMonthlyActuals) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(actualsKeyFor(input.monthIndex, input.year), JSON.stringify(input));
}

export function clearBrandMonthlyActuals(monthIndex: number, year: number) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(actualsKeyFor(monthIndex, year));
}


