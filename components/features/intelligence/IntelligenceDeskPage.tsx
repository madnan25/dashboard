"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { PillSelect } from "@/components/ds/PillSelect";
import { KpiCard } from "@/components/ds/KpiCard";
import { getCurrentProfile } from "@/lib/dashboardDb";

type Insights = {
  generated_at: string;
  window?: {
    today: string;
  };
  counts: {
    total: number;
    open: number;
    closed: number;
    dropped: number;
    blocked: number;
    on_hold: number;
    overdue: number;
    due_soon: number;
    updated_recent: number;
  };
  by_team: Array<{ id: string | null; name: string; total: number; open: number; blocked: number; overdue: number }>;
  by_assignee: Array<{ id: string | null; name: string; total: number; open: number; blocked: number; overdue: number }>;
  by_project: Array<{ id: string | null; name: string; total: number; open: number; blocked: number; overdue: number }>;
  blocked_tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignee: string;
    team: string;
    project: string;
    due_at: string | null;
    updated_at: string;
    description_snippet: string | null;
    latest_comment_snippet: string | null;
    dependency_summary?: Array<{ type: "task" | "subtask"; id: string; label: string; reason: string | null }>;
    subtask_summary?: {
      total: number;
      not_done: number;
      done: number;
      blocked: number;
      on_hold: number;
      overdue: number;
      due_soon: number;
      blocked_by_dependencies: number;
      top_blocked: string[];
    } | null;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
  }>;
  recent_comments: Array<{
    task_id: string;
    title: string;
    created_at: string;
    snippet: string;
    assignee: string;
    team: string;
    project: string;
  }>;
};

type SummaryResponse = {
  summary: string;
  generated_at: string;
  cached: boolean;
  insights: Insights | null;
};

type SummaryPayload = {
  headline?: string;
  snapshot?: string[];
  blockers?: Array<string | { task?: string; reason?: string; dependency?: string }>;
  priorities?: string[];
  risks?: string[];
  next_actions?: string[];
  what_im_noticing?: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SummaryTone = "sky" | "rose" | "amber" | "emerald" | "slate";

const SUGGESTED_QUESTIONS = [
  "What is blocking the team right now?",
  "Which projects are at risk this week?",
  "Who has the biggest workload in Marketing?",
  "Summarize Design & Production progress.",
  "What should I follow up on today?"
];

function formatWhen(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function stripCodeFence(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function sanitizeJsonText(raw: string) {
  return raw
    .replace(/^[\uFEFF\u200B\u200C\u200D]+/, "")
    .replace(/\u0000/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function extractJsonBlock(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function parseSummaryPayload(raw: string): SummaryPayload | null {
  if (!raw) return null;
  const cleaned = sanitizeJsonText(stripCodeFence(raw));
  try {
    const parsed = JSON.parse(cleaned) as SummaryPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    const block = extractJsonBlock(cleaned);
    if (!block) return null;
    try {
      const parsed = JSON.parse(sanitizeJsonText(block)) as SummaryPayload;
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

function normalizeList(list: unknown, max = 3): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => (typeof item === "string" ? stripIdsFromText(item).trim() : ""))
    .filter(Boolean)
    .slice(0, max);
}

function formatBlockerItem(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  const obj = item as { task?: unknown; reason?: unknown; dependency?: unknown };
  const task = typeof obj.task === "string" ? stripIdsFromText(obj.task).trim() : "";
  const reason = typeof obj.reason === "string" ? stripIdsFromText(obj.reason).trim() : "";
  const dependency = typeof obj.dependency === "string" ? stripIdsFromText(obj.dependency).trim() : "";
  const base = [task, reason ? `— ${reason}` : ""].filter(Boolean).join(" ");
  if (!dependency) return base;
  if (!base) return dependency;
  const baseLower = base.toLowerCase();
  const depLower = dependency.toLowerCase();
  if (baseLower.includes(depLower)) return base;
  return `${base} (${dependency})`;
}

function normalizeBlockers(list: unknown, max = 3): string[] {
  if (!Array.isArray(list)) return [];
  return list.map(formatBlockerItem).filter(Boolean).slice(0, max);
}

function SummaryCard({
  title,
  tone,
  items,
  empty,
  linkMap,
  referenceDate
}: {
  title: string;
  tone: SummaryTone;
  items: string[];
  empty: string;
  linkMap?: Map<string, string>;
  referenceDate?: string;
}) {
  const toneClass =
    tone === "rose"
      ? "border-rose-400/30 text-rose-100"
      : tone === "amber"
        ? "border-amber-400/30 text-amber-100"
        : tone === "emerald"
          ? "border-emerald-400/30 text-emerald-100"
          : tone === "sky"
            ? "border-sky-400/30 text-sky-100"
            : "border-white/10 text-white/80";
  const dotClass =
    tone === "rose"
      ? "bg-rose-300"
      : tone === "amber"
        ? "bg-amber-300"
        : tone === "emerald"
          ? "bg-emerald-300"
          : tone === "sky"
            ? "bg-sky-300"
            : "bg-white/50";

  return (
    <motion.div
      className={`glow-card rounded-2xl border ${toneClass} bg-white/[0.02] px-4 py-3`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        <span>{title}</span>
      </div>
      {items.length === 0 ? (
        <div className="mt-2 text-xs text-white/55">{empty}</div>
      ) : (
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-white/85">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`}>
              {linkMap ? renderTextWithLinks(item, linkMap, referenceDate) : item}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

const TICKET_CODE_REGEX = /\b[A-Z0-9]{2,8}-\d+\b/g;

function stripIdsFromText(value: string) {
  return value
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "")
    .replace(/\(\s*id\s*:\s*[^)]+\)/gi, "")
    .replace(/\bid\s*:\s*[^)\s,]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();
}

function renderMentions(text: string, keyPrefix: string) {
  const pattern = /(^|\s)@([A-Za-z][A-Za-z0-9._-]*)(?:\s+([A-Za-z][A-Za-z0-9._-]*))?/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let tokenIndex = 0;
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    const leading = match[1] ?? "";
    if (leading) nodes.push(leading);
    const first = match[2] ?? "";
    const last = match[3] ?? "";
    const label = last ? `${first} ${last}` : first;
    if (label) {
      nodes.push(
        <span key={`${keyPrefix}-mention-${match.index}-${tokenIndex++}`} className="font-medium text-sky-200">
          {label}
        </span>
      );
    } else {
      nodes.push(match[0]);
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : [text];
}

function renderSnippetWithMentions(raw: string) {
  return renderMentions(stripIdsFromText(raw), "snippet");
}

function getTicketCode(title: string) {
  const match = title.match(/^([A-Z0-9]{2,8}-\d+)\b/);
  return match ? match[1] : null;
}

function renderTextWithLinks(text: string, ticketMap: Map<string, string>, referenceDate?: string) {
  const cleaned = stripIdsFromText(text);
  const normalized = replaceIsoDatesWithRelative(cleaned, referenceDate);
  const parts: Array<string | { code: string }> = [];
  let lastIndex = 0;
  for (const match of normalized.matchAll(TICKET_CODE_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(normalized.slice(lastIndex, start));
    parts.push({ code: match[0] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < normalized.length) parts.push(normalized.slice(lastIndex));

  return parts.map((part, idx) => {
    if (typeof part === "string") {
      return <span key={`text-${idx}`}>{renderMentions(part, `text-${idx}`)}</span>;
    }
    const href = ticketMap.get(part.code);
    if (!href) return <span key={`code-${idx}`}>{part.code}</span>;
    return (
      <Link
        key={`code-${idx}`}
        href={href}
        className="underline underline-offset-2 decoration-sky-400/70 text-sky-200 hover:text-sky-100"
      >
        {part.code}
      </Link>
    );
  });
}

function isoToDayNumber(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function relativeDateLabel(iso: string, todayIso: string) {
  const due = isoToDayNumber(iso);
  const today = isoToDayNumber(todayIso);
  if (!due || !today) return iso;
  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  if (diffDays <= 6) return `in ${diffDays} days`;
  if (diffDays <= 8) return "in about a week";
  if (diffDays <= 13) return "in about two weeks";
  const weeks = Math.max(2, Math.round(diffDays / 7));
  return `in about ${weeks} weeks`;
}

function replaceIsoDatesWithRelative(text: string, todayIso?: string) {
  if (!todayIso) return text;
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (match) => relativeDateLabel(match, todayIso));
}

function renderMultilineText(text: string, ticketMap: Map<string, string>) {
  const lines = stripIdsFromText(text).split("\n");
  return lines.map((line, idx) => (
    <span key={`line-${idx}`}>
      {renderTextWithLinks(line, ticketMap)}
      {idx < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

export function IntelligenceDeskPage() {
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [summary, setSummary] = useState("");
  const [summaryMeta, setSummaryMeta] = useState<SummaryResponse | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatScopeType, setChatScopeType] = useState<"" | "team" | "project" | "assignee" | "task">("");
  const [chatScopeValue, setChatScopeValue] = useState("");
  const [chatDeepDive, setChatDeepDive] = useState(false);
  const parsedSummary = useMemo(() => parseSummaryPayload(summary), [summary]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const summaryReferenceDate = summaryMeta?.insights?.window?.today;
  const ticketLinkMap = useMemo(() => {
    const map = new Map<string, string>();
    const tasks = summaryMeta?.insights?.tasks ?? [];
    const blocked = summaryMeta?.insights?.blocked_tasks ?? [];
    for (const t of [...tasks, ...blocked]) {
      if (!t?.id || !t?.title) continue;
      const code = getTicketCode(t.title);
      if (code && !map.has(code)) {
        map.set(code, `/tasks/${t.id}`);
      }
    }
    return map;
  }, [summaryMeta]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const profile = await getCurrentProfile();
        if (cancelled) return;
        setProfileRole(profile?.role ?? null);
      } catch {
        if (cancelled) return;
        setProfileRole(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadSummary(force = false) {
    setSummaryLoading(true);
    setSummaryStatus("");
    try {
      const res = await fetch(`/api/intelligence-desk/summary${force ? "?force=1" : ""}`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as SummaryResponse | { error?: string } | null;
      if (!res.ok || !body || "error" in body || typeof (body as SummaryResponse).summary !== "string") {
        throw new Error(body && "error" in body ? body.error || "Failed to load summary" : "Failed to load summary");
      }
      const summaryBody = body as SummaryResponse;
      setSummary(summaryBody.summary || "");
      setSummaryMeta(summaryBody);
    } catch (e) {
      setSummaryStatus(e instanceof Error ? e.message : "Failed to load summary");
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    if (profileRole === "cmo" || profileRole === "admin_viewer") void loadSummary();
  }, [profileRole]);

  useEffect(() => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, chatLoading]);

  async function sendChat(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setChatStatus("");
    setChatLoading(true);
    setChatInput("");

    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: trimmed }];
    setChatMessages(nextMessages);

    try {
      const res = await fetch("/api/intelligence-desk/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: chatMessages,
          scope:
            chatScopeType && chatScopeValue
              ? { type: chatScopeType, id: chatScopeValue, deep: chatDeepDive }
              : null
        })
      });
      const body = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
      if (!res.ok || !body || !body.reply) {
        throw new Error(body?.error || "Failed to get response");
      }
      setChatMessages([...nextMessages, { role: "assistant", content: body.reply }]);
    } catch (e) {
      setChatStatus(e instanceof Error ? e.message : "Failed to get response");
    } finally {
      setChatLoading(false);
    }
  }

  const insightCounts = summaryMeta?.insights?.counts ?? null;
  const topTeams = useMemo(() => {
    const rows = summaryMeta?.insights?.by_team ?? [];
    return [...rows].sort((a, b) => b.open - a.open).slice(0, 5);
  }, [summaryMeta]);
  const topAssignees = useMemo(() => {
    const rows = summaryMeta?.insights?.by_assignee ?? [];
    return [...rows].sort((a, b) => b.open - a.open).slice(0, 5);
  }, [summaryMeta]);
  const topProjects = useMemo(() => {
    const rows = summaryMeta?.insights?.by_project ?? [];
    return [...rows].sort((a, b) => b.blocked - a.blocked).slice(0, 5);
  }, [summaryMeta]);
  const blockedTasks = summaryMeta?.insights?.blocked_tasks?.slice(0, 6) ?? [];
  const recentComments = summaryMeta?.insights?.recent_comments?.slice(0, 6) ?? [];

  const scopeOptions = useMemo(() => {
    if (chatScopeType === "team") {
      return (summaryMeta?.insights?.by_team ?? []).map((t) => ({ value: t.name, label: t.name }));
    }
    if (chatScopeType === "project") {
      return (summaryMeta?.insights?.by_project ?? []).map((t) => ({ value: t.name, label: t.name }));
    }
    if (chatScopeType === "assignee") {
      return (summaryMeta?.insights?.by_assignee ?? []).map((t) => ({ value: t.name, label: t.name }));
    }
    if (chatScopeType === "task") {
      return (summaryMeta?.insights?.blocked_tasks ?? []).map((t) => ({ value: t.id, label: t.title }));
    }
    return [];
  }, [chatScopeType, summaryMeta]);

  if (authChecked && profileRole && profileRole !== "cmo" && profileRole !== "admin_viewer") {
    return (
      <main className="min-h-screen px-4 md:px-6 pb-10">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <PageHeader title="Intelligence Desk" subtitle="CMO-only insights." showBack backHref="/" />
          <Surface>
            <div className="text-sm text-white/70">Access denied. This page is available to the CMO only.</div>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Intelligence Desk"
          subtitle="AI-driven executive overview of task activity, blockers, and team focus."
          showBack
          backHref="/"
          right={
            <div className="flex items-center gap-2">
              <div className="text-xs text-white/45">
                Last updated: {summaryMeta ? formatWhen(summaryMeta.generated_at) : "—"}
              </div>
              <AppButton intent="secondary" className="h-9 px-4" onPress={() => void loadSummary(true)} isDisabled={summaryLoading}>
                {summaryLoading ? "Refreshing…" : "Refresh"}
              </AppButton>
            </div>
          }
        />

        {summaryStatus ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{summaryStatus}</div>
          </Surface>
        ) : null}

        {insightCounts ? (
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Open tickets" value={String(insightCounts.open)} helper="Active work across teams." />
            <KpiCard label="Blocked / On hold" value={String(insightCounts.blocked + insightCounts.on_hold)} helper="Requires attention." />
            <KpiCard label="Overdue" value={String(insightCounts.overdue)} helper="Past due, not closed." />
            <KpiCard label="Due soon" value={String(insightCounts.due_soon)} helper="Due within 7 days." />
          </div>
        ) : (
          <Surface>
            <div className="text-sm text-white/55">{summaryLoading ? "Loading insights…" : "No insights yet."}</div>
          </Surface>
        )}

        <Surface>
          <div className="text-xs uppercase tracking-widest text-white/45">Executive Summary</div>
          {summaryLoading ? (
            <div className="mt-3 space-y-3">
              <div className="h-4 w-2/3 rounded-full shimmer" />
              <div className="grid gap-3 md:grid-cols-3">
                {[0, 1, 2].map((idx) => (
                  <div key={`summary-skeleton-top-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="h-3 w-24 rounded-full shimmer" />
                    <div className="mt-3 space-y-2">
                      <div className="h-3 w-4/5 rounded-full shimmer" />
                      <div className="h-3 w-3/5 rounded-full shimmer" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[0, 1].map((idx) => (
                  <div key={`summary-skeleton-bottom-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="h-3 w-24 rounded-full shimmer" />
                    <div className="mt-3 space-y-2">
                      <div className="h-3 w-4/5 rounded-full shimmer" />
                      <div className="h-3 w-3/5 rounded-full shimmer" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="h-3 w-32 rounded-full shimmer" />
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-4/5 rounded-full shimmer" />
                  <div className="h-3 w-3/5 rounded-full shimmer" />
                </div>
              </div>
            </div>
          ) : parsedSummary ? (
            <motion.div
              className="mt-3 space-y-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {parsedSummary.headline ? (
                <div className="text-sm font-semibold text-white/90">
                  {renderTextWithLinks(parsedSummary.headline, ticketLinkMap, summaryReferenceDate)}
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard
                  title="Snapshot"
                  tone="sky"
                  items={normalizeList(parsedSummary.snapshot)}
                  empty="No snapshot yet."
                  linkMap={ticketLinkMap}
                  referenceDate={summaryReferenceDate}
                />
                <SummaryCard
                  title="Blockers"
                  tone="rose"
                  items={normalizeBlockers(parsedSummary.blockers)}
                  empty="No blockers noted."
                  linkMap={ticketLinkMap}
                  referenceDate={summaryReferenceDate}
                />
                <SummaryCard
                  title="Next actions"
                  tone="emerald"
                  items={normalizeList(parsedSummary.next_actions)}
                  empty="No next actions yet."
                  linkMap={ticketLinkMap}
                  referenceDate={summaryReferenceDate}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <SummaryCard
                  title="Priorities"
                  tone="amber"
                  items={normalizeList(parsedSummary.priorities)}
                  empty="No priorities noted."
                  linkMap={ticketLinkMap}
                  referenceDate={summaryReferenceDate}
                />
                <SummaryCard
                  title="Risks"
                  tone="slate"
                  items={normalizeList(parsedSummary.risks)}
                  empty="No risks noted."
                  linkMap={ticketLinkMap}
                  referenceDate={summaryReferenceDate}
                />
              </div>
              <SummaryCard
                title="What I'm noticing"
                tone="sky"
                items={normalizeList(parsedSummary.what_im_noticing)}
                empty="No observations yet."
                linkMap={ticketLinkMap}
                referenceDate={summaryReferenceDate}
              />
            </motion.div>
          ) : (
            <div className="mt-3 whitespace-pre-wrap text-sm text-white/85">
              {summary ||
                (summaryMeta
                  ? "Summary will appear here."
                  : "No cached summary yet. Use Refresh or wait for the 12 PM PKT sync.")}
            </div>
          )}
          <div className="mt-2 text-xs text-white/45">
            {summaryMeta?.cached ? "Cached summary (12 PM PKT sync)" : "Manual refresh"} • Session-only chat history
          </div>
        </Surface>

        <div className="grid gap-4 md:grid-cols-3">
          <Surface className="md:col-span-2">
            <div className="text-xs uppercase tracking-widest text-white/45">Blocked tasks</div>
            <div className="mt-3 space-y-2">
              {blockedTasks.length === 0 ? (
                <div className="text-sm text-white/55">No blocked items right now.</div>
              ) : (
                blockedTasks.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="text-sm font-semibold text-white/90">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="underline underline-offset-2 decoration-white/20 hover:decoration-white/60"
                      >
                        {stripIdsFromText(t.title)}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {t.team} · {t.assignee} · {t.priority} · {t.status}
                    </div>
                    {t.dependency_summary && t.dependency_summary.length > 0 ? (
                      <div className="mt-2 text-xs text-rose-200/90">
                        Blocked by:{" "}
                        {t.dependency_summary
                          .slice(0, 3)
                          .map((d) => stripIdsFromText(d.label))
                          .join(", ")}
                      </div>
                    ) : null}
                    {t.subtask_summary?.total ? (
                      <div className="mt-1 text-xs text-white/55">
                        Subtasks: {t.subtask_summary.total} · Blocked {t.subtask_summary.blocked} · Overdue{" "}
                        {t.subtask_summary.overdue}
                      </div>
                    ) : null}
                    {t.latest_comment_snippet || t.description_snippet ? (
                      <div className="mt-2 text-xs text-white/55">
                        {stripIdsFromText(t.latest_comment_snippet || t.description_snippet || "")}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Surface>

          <div className="space-y-4">
            <Surface>
              <div className="text-xs uppercase tracking-widest text-white/45">Teams with most open work</div>
              <div className="mt-3 space-y-2">
                {topTeams.length === 0 ? (
                  <div className="text-sm text-white/55">No team data yet.</div>
                ) : (
                  topTeams.map((t) => (
                    <div key={t.id ?? t.name} className="flex items-center justify-between text-sm text-white/80">
                      <span>{t.name}</span>
                      <span className="text-white/55 tabular-nums">{t.open}</span>
                    </div>
                  ))
                )}
              </div>
            </Surface>

            <Surface>
              <div className="text-xs uppercase tracking-widest text-white/45">Assignees with most open work</div>
              <div className="mt-3 space-y-2">
                {topAssignees.length === 0 ? (
                  <div className="text-sm text-white/55">No assignee data yet.</div>
                ) : (
                  topAssignees.map((t) => (
                    <div key={t.id ?? t.name} className="flex items-center justify-between text-sm text-white/80">
                      <span>{t.name}</span>
                      <span className="text-white/55 tabular-nums">{t.open}</span>
                    </div>
                  ))
                )}
              </div>
            </Surface>

            <Surface>
              <div className="text-xs uppercase tracking-widest text-white/45">Projects at risk</div>
              <div className="mt-3 space-y-2">
                {topProjects.length === 0 ? (
                  <div className="text-sm text-white/55">No project data yet.</div>
                ) : (
                  topProjects.map((p) => (
                    <div key={p.id ?? p.name} className="flex items-center justify-between text-sm text-white/80">
                      <span>{p.name}</span>
                      <span className="text-white/55 tabular-nums">{p.blocked}</span>
                    </div>
                  ))
                )}
              </div>
            </Surface>

            <Surface>
              <div className="text-xs uppercase tracking-widest text-white/45">Recent comment highlights</div>
              <div className="mt-3 space-y-2">
                {recentComments.length === 0 ? (
                  <div className="text-sm text-white/55">No recent comments yet.</div>
                ) : (
                  recentComments.map((c) => (
                    <div key={`${c.task_id}-${c.created_at}`} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <div className="text-xs text-white/60">{c.project} · {c.team}</div>
                    <div className="mt-1 text-sm text-white/85">
                      <Link
                        href={`/tasks/${c.task_id}`}
                        className="underline underline-offset-2 decoration-white/20 hover:decoration-white/60"
                      >
                        {stripIdsFromText(c.title)}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-white/55">{renderSnippetWithMentions(c.snippet)}</div>
                    </div>
                  ))
                )}
              </div>
            </Surface>
          </div>
        </div>

        <Surface>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-widest text-white/45">Ask Intelligence Desk</div>
            <AppButton
              intent="ghost"
              className="h-9 px-3"
              onPress={() => setChatMessages([])}
              isDisabled={chatLoading || chatMessages.length === 0}
            >
              Clear chat
            </AppButton>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
                onClick={() => setChatInput(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[140px,1fr] md:items-center">
            <div className="text-xs uppercase tracking-widest text-white/45">Scope</div>
            <div className="flex flex-wrap items-center gap-2">
              <PillSelect
                value={chatScopeType}
                onChange={(v) => {
                  const next = (v as "" | "team" | "project" | "assignee" | "task") ?? "";
                  setChatScopeType(next);
                  setChatScopeValue("");
                  setChatDeepDive(false);
                }}
                ariaLabel="Scope type"
              >
                <option value="" className="bg-zinc-900">
                  No scope (cached summary)
                </option>
                <option value="team" className="bg-zinc-900">
                  Team
                </option>
                <option value="project" className="bg-zinc-900">
                  Project
                </option>
                <option value="assignee" className="bg-zinc-900">
                  Assignee
                </option>
                <option value="task" className="bg-zinc-900">
                  Blocked task
                </option>
              </PillSelect>

              {chatScopeType ? (
                <PillSelect
                  value={chatScopeValue}
                  onChange={(v) => setChatScopeValue((v as string) || "")}
                  ariaLabel="Scope value"
                  disabled={scopeOptions.length === 0}
                >
                  <option value="" className="bg-zinc-900">
                    {scopeOptions.length === 0 ? "No cached options yet" : "Select…"}
                  </option>
                  {scopeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-zinc-900">
                      {opt.label}
                    </option>
                  ))}
                </PillSelect>
              ) : null}

              {chatScopeType ? (
                <label className="inline-flex items-center gap-2 text-xs text-white/60">
                  <input
                    type="checkbox"
                    checked={chatDeepDive}
                    onChange={(e) => setChatDeepDive(e.target.checked)}
                    className="h-4 w-4 rounded border border-white/20 bg-transparent"
                  />
                  Deep dive (fetch extra context)
                </label>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-sm text-white/55">Ask about team activity, blockers, or project status.</div>
            ) : (
              <AnimatePresence initial={false}>
                {chatMessages.map((m, idx) => (
                  <motion.div
                    key={`${m.role}-${idx}`}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={[
                      "rounded-2xl border px-4 py-3 text-sm",
                      m.role === "user"
                        ? "border-white/10 bg-white/[0.03] text-white/85"
                        : "border-white/10 bg-white/[0.01] text-white/75"
                    ].join(" ")}
                  >
                    <div className="text-xs uppercase tracking-widest text-white/40">{m.role === "user" ? "You" : "Desk"}</div>
                    <div className="mt-2 whitespace-pre-wrap">
                      {renderMultilineText(m.content, ticketLinkMap)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {chatLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.01] px-4 py-3 text-sm text-white/75">
                <div className="text-xs uppercase tracking-widest text-white/40">Desk</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="typing-dots inline-flex items-center gap-1">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="text-xs text-white/55">Thinking…</span>
                </div>
                <div className="mt-3 h-2 w-2/3 rounded-full shimmer" />
              </div>
            ) : null}
          </div>

          {chatStatus ? <div className="mt-3 text-xs text-amber-200/90">{chatStatus}</div> : null}

          <div className="mt-4">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              rows={2}
              placeholder="Ask about tasks, blockers, or team focus…"
              className="w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-white/45">Session-only chat (not saved).</div>
              <AppButton
                intent="primary"
                className="h-10 px-5"
                onPress={() => void sendChat(chatInput)}
                isDisabled={chatLoading || !chatInput.trim()}
              >
                {chatLoading ? (
                  <span className="inline-flex items-center gap-2">
                    Thinking
                    <span className="typing-dots inline-flex items-center gap-1">
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>
                ) : (
                  "Send"
                )}
              </AppButton>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}
