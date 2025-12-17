export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

export function monthLabel(monthIndex: number, year: number) {
  return `${MONTHS[monthIndex] ?? "—"} ${year}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function clampPercent(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Snapshot = {
  monthLabel: string;
  budgetAllocated: number;
  budgetSpent: number;
  leadsGenerated: number;
  qualifiedLeads: number;
  meetingsScheduled: number;
  meetingsCompleted: number;
  targets: {
    leadsGenerated: number;
    qualifiedLeads: number;
    meetingsScheduled: number;
    meetingsCompleted: number;
  };
};

export type Trend = {
  labels: string[];
  spend: number[];
  qualified: number[];
  meetings: number[];
};

export function buildSnapshot(monthIndex: number, year: number): Snapshot {
  const seed = year * 100 + monthIndex;
  const rand = mulberry32(seed);

  const budgetAllocated = 10_000_000 + Math.round(rand() * 5_000_000);
  const spendPct = clamp(0.55 + rand() * 0.4, 0.35, 0.98);
  const budgetSpent = Math.round(budgetAllocated * spendPct);

  const leadsGenerated = 900 + Math.round(rand() * 900);
  const qualifiedLeads = Math.round(leadsGenerated * clamp(0.22 + rand() * 0.12, 0.15, 0.45));
  const meetingsScheduled = Math.round(qualifiedLeads * clamp(0.18 + rand() * 0.12, 0.12, 0.4));
  const meetingsCompleted = Math.round(meetingsScheduled * clamp(0.62 + rand() * 0.25, 0.35, 0.95));

  const targets = {
    leadsGenerated: 1500 + Math.round(rand() * 300),
    qualifiedLeads: 350 + Math.round(rand() * 120),
    meetingsScheduled: 85 + Math.round(rand() * 25),
    meetingsCompleted: 55 + Math.round(rand() * 25)
  };

  return {
    monthLabel: monthLabel(monthIndex, year),
    budgetAllocated,
    budgetSpent,
    leadsGenerated,
    qualifiedLeads,
    meetingsScheduled,
    meetingsCompleted,
    targets
  };
}

export function buildTrend(monthIndex: number, year: number, monthsBack = 6): Trend {
  const labels: string[] = [];
  const spend: number[] = [];
  const qualified: number[] = [];
  const meetings: number[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const m = monthIndex - i;
    const y = year + Math.floor(m / 12);
    const idx = ((m % 12) + 12) % 12;

    labels.push(MONTHS[idx] ?? "—");

    const s = y * 100 + idx;
    const rand = mulberry32(s);

    const alloc = 10_000_000 + Math.round(rand() * 5_000_000);
    const spendPct = clamp(0.55 + rand() * 0.4, 0.35, 0.98);
    const spent = Math.round(alloc * spendPct);

    const leads = 900 + Math.round(rand() * 900);
    const q = Math.round(leads * clamp(0.22 + rand() * 0.12, 0.15, 0.45));
    const ms = Math.round(q * clamp(0.18 + rand() * 0.12, 0.12, 0.4));
    const mc = Math.round(ms * clamp(0.62 + rand() * 0.25, 0.35, 0.95));

    spend.push(spent);
    qualified.push(q);
    meetings.push(mc);
  }

  return { labels, spend, qualified, meetings };
}


