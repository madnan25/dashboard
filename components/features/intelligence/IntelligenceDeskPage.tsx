"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { KpiCard } from "@/components/ds/KpiCard";
import { getCurrentProfile } from "@/lib/dashboardDb";

type Insights = {
  generated_at: string;
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
  }>;
};

type SummaryResponse = {
  summary: string;
  generated_at: string;
  cached: boolean;
  insights: Insights;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

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
      if (!res.ok || !body || "error" in body) {
        throw new Error(body && "error" in body ? body.error || "Failed to load summary" : "Failed to load summary");
      }
      setSummary(body.summary || "");
      setSummaryMeta(body);
    } catch (e) {
      setSummaryStatus(e instanceof Error ? e.message : "Failed to load summary");
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    if (profileRole === "cmo") void loadSummary();
  }, [profileRole]);

  async function sendChat(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setChatStatus("");
    setChatLoading(true);
    setChatInput("");

    const nextMessages = [...chatMessages, { role: "user", content: trimmed }];
    setChatMessages(nextMessages);

    try {
      const res = await fetch("/api/intelligence-desk/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: chatMessages
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
  const topProjects = useMemo(() => {
    const rows = summaryMeta?.insights?.by_project ?? [];
    return [...rows].sort((a, b) => b.blocked - a.blocked).slice(0, 5);
  }, [summaryMeta]);
  const blockedTasks = summaryMeta?.insights?.blocked_tasks?.slice(0, 6) ?? [];

  if (authChecked && profileRole && profileRole !== "cmo") {
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
          <div className="mt-3 whitespace-pre-wrap text-sm text-white/85">
            {summaryLoading ? "Generating summary…" : summary || "Summary will appear here."}
          </div>
          <div className="mt-2 text-xs text-white/45">
            {summaryMeta?.cached ? "Cached summary" : "Fresh summary"} • Session-only chat history
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
                    <div className="text-sm font-semibold text-white/90">{t.title}</div>
                    <div className="mt-1 text-xs text-white/60">
                      {t.team} · {t.assignee} · {t.priority} · {t.status}
                    </div>
                    {t.latest_comment_snippet || t.description_snippet ? (
                      <div className="mt-2 text-xs text-white/55">
                        {t.latest_comment_snippet || t.description_snippet}
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
                className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.05]"
                onClick={() => setChatInput(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-sm text-white/55">Ask about team activity, blockers, or project status.</div>
            ) : (
              chatMessages.map((m, idx) => (
                <div
                  key={`${m.role}-${idx}`}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm",
                    m.role === "user"
                      ? "border-white/10 bg-white/[0.03] text-white/85"
                      : "border-white/10 bg-white/[0.01] text-white/75"
                  ].join(" ")}
                >
                  <div className="text-xs uppercase tracking-widest text-white/40">{m.role === "user" ? "You" : "Desk"}</div>
                  <div className="mt-2 whitespace-pre-wrap">{m.content}</div>
                </div>
              ))
            )}
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
                {chatLoading ? "Thinking…" : "Send"}
              </AppButton>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}
