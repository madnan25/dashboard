"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import type { Profile, TaskFlowTemplate, TaskFlowTemplateStep } from "@/lib/dashboardDb";
import { isMarketingManagerProfile } from "@/components/tasks/taskModel";
import {
  createTaskFlowTemplate,
  deleteTaskFlowTemplate,
  getCurrentProfile,
  listProfiles,
  listTaskFlowTemplateSteps,
  listTaskFlowTemplates,
  replaceTaskFlowTemplateSteps
} from "@/lib/dashboardDb";

type StepDraft = {
  step_order: number;
  step_key: string;
  label: string;
  approver_kind: TaskFlowTemplateStep["approver_kind"];
  approver_user_id: string | null;
};

function slugifyStepKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export const dynamic = "force-dynamic";

export default function TaskTemplatesPage() {
  const [status, setStatus] = useState("");
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<TaskFlowTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [steps, setSteps] = useState<StepDraft[]>([]);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Allow CMO, marketing managers, and brand managers to manage templates.
  const canManage = me?.role === "brand_manager" || isMarketingManagerProfile(me);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [selectedId, templates]);
  const marketingManagers = useMemo(() => profiles.filter(isMarketingManagerProfile), [profiles]);

  async function refreshTemplates() {
    const [t, ps] = await Promise.all([listTaskFlowTemplates(), listProfiles()]);
    setTemplates(t);
    setProfiles(ps);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        setStatus("");
        const [p] = await Promise.all([getCurrentProfile()]);
        if (cancelled) return;
        setMe(p);
        await refreshTemplates();
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load templates");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSteps() {
      if (!selectedId) {
        setSteps([]);
        return;
      }
      try {
        setStatus("");
        const s = await listTaskFlowTemplateSteps(selectedId);
        if (cancelled) return;
        setSteps(
          (s ?? []).map((x) => ({
            step_order: x.step_order,
            step_key: x.step_key,
            label: x.label,
            approver_kind: x.approver_kind,
            approver_user_id: x.approver_user_id ?? null
          }))
        );
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load template steps");
      }
    }
    loadSteps();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function onCreateTemplate() {
    if (!canManage) return;
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setStatus("");
    try {
      const created = await createTaskFlowTemplate({ name, description: newDesc.trim() ? newDesc.trim() : null });
      setNewName("");
      setNewDesc("");
      await refreshTemplates();
      setSelectedId(created.id);
      setStatus("Template created.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteTemplate() {
    if (!canManage) return;
    if (!selectedTemplate) return;
    if (!confirm(`Delete template “${selectedTemplate.name}”?`)) return;
    setStatus("Deleting…");
    try {
      await deleteTaskFlowTemplate(selectedTemplate.id);
      setSelectedId("");
      setSteps([]);
      await refreshTemplates();
      setStatus("Template deleted.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to delete template");
    }
  }

  function onAddStep() {
    if (!canManage) return;
    setSteps((prev) => {
      const nextOrder = prev.length === 0 ? 1 : Math.max(...prev.map((s) => s.step_order)) + 1;
      return [
        ...prev,
        {
          step_order: nextOrder,
          step_key: `step_${nextOrder}`,
          label: "",
          approver_kind: "ticket_manager",
          approver_user_id: null
        }
      ];
    });
  }

  function onRemoveStep(idx: number) {
    if (!canManage) return;
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSaveSteps() {
    if (!canManage) return;
    if (!selectedId) return;
    setSaving(true);
    setStatus("Saving steps…");
    try {
      const normalized = steps
        .map((s) => ({
          ...s,
          label: s.label.trim(),
          step_key: s.step_key.trim() || slugifyStepKey(s.label) || "step"
        }))
        .filter((s) => s.label);

      const usedKeys = new Set<string>();
      const resolved = normalized.map((s, i) => {
        let key = slugifyStepKey(s.step_key) || `step_${i + 1}`;
        while (usedKeys.has(key)) key = `${key}_${i + 1}`;
        usedKeys.add(key);
        return { ...s, step_key: key };
      });

      await replaceTaskFlowTemplateSteps(selectedId, resolved);
      setStatus("Saved.");
      const latest = await listTaskFlowTemplateSteps(selectedId);
      setSteps(
        (latest ?? []).map((x) => ({
          step_order: x.step_order,
          step_key: x.step_key,
          label: x.label,
          approver_kind: x.approver_kind,
          approver_user_id: x.approver_user_id ?? null
        }))
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save steps");
    } finally {
      setSaving(false);
    }
  }

  if (me && !canManage) {
    return (
      <main className="min-h-screen px-4 md:px-6 pb-10">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeader title="Task Templates" subtitle="Marketing managers only." showBack backHref="/tasks" />
          <Surface>
            <div className="text-sm text-white/75">You don’t have access to manage templates.</div>
            <div className="mt-1 text-xs text-white/50">Ask a marketing manager (or CMO) to manage approval templates.</div>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader title="Task Templates" subtitle="Define approval flows and who signs off." showBack backHref="/tasks" />

        <Surface>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-white/45">Create template</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <AppInput value={newName} onValueChange={setNewName} isDisabled={creating} placeholder="Template name" />
                <AppInput value={newDesc} onValueChange={setNewDesc} isDisabled={creating} placeholder="Description (optional)" />
              </div>
            </div>
            <AppButton intent="primary" className="h-11 px-6" onPress={onCreateTemplate} isDisabled={creating || !newName.trim()}>
              {creating ? "Creating…" : "Create"}
            </AppButton>
          </div>
        </Surface>

        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-white/60">{status || " "}</div>
            <div className="flex items-center gap-2">
              <AppButton intent="secondary" className="h-10 px-4" onPress={refreshTemplates}>
                Refresh
              </AppButton>
              <AppButton intent="danger" className="h-10 px-4" onPress={onDeleteTemplate} isDisabled={!selectedTemplate}>
                Delete template
              </AppButton>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">Select template</div>
              <PillSelect value={selectedId} onChange={setSelectedId} ariaLabel="Template" className="mt-2">
                <option value="" className="bg-zinc-900">
                  Select…
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id} className="bg-zinc-900">
                    {t.name}
                  </option>
                ))}
              </PillSelect>
              {selectedTemplate?.description ? <div className="mt-2 text-xs text-white/55">{selectedTemplate.description}</div> : null}
            </div>

            <div className="flex items-end justify-end gap-2">
              <AppButton intent="secondary" className="h-10 px-4" onPress={onAddStep} isDisabled={!selectedId}>
                Add step
              </AppButton>
              <AppButton intent="primary" className="h-10 px-4" onPress={onSaveSteps} isDisabled={!selectedId || saving}>
                {saving ? "Saving…" : "Save steps"}
              </AppButton>
            </div>
          </div>

          {selectedId ? (
            <div className="mt-4 space-y-2">
              {steps.length === 0 ? <div className="text-sm text-white/50">No steps yet. Add one.</div> : null}
              {steps.map((s, idx) => (
                <div key={`${s.step_key}_${idx}`} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <div className="grid gap-2 md:grid-cols-12 md:items-center">
                    <div className="md:col-span-2">
                      <div className="text-xs text-white/45">Order</div>
                      <input
                        value={String(s.step_order)}
                        onChange={(e) =>
                          setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, step_order: Number(e.target.value) || 0 } : x)))
                        }
                        className="mt-1 w-full glass-inset rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <div className="text-xs text-white/45">Label</div>
                      <input
                        value={s.label}
                        onChange={(e) =>
                          setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                        }
                        className="mt-1 w-full glass-inset rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20"
                        placeholder="e.g. Manager approval"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <div className="text-xs text-white/45">Step key</div>
                      <input
                        value={s.step_key}
                        onChange={(e) =>
                          setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, step_key: e.target.value } : x)))
                        }
                        className="mt-1 w-full glass-inset rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20"
                        placeholder="auto-generated"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <div className="text-xs text-white/45">Approver</div>
                      <PillSelect
                        value={`${s.approver_kind}:${s.approver_user_id ?? ""}`}
                        onChange={(v) => {
                          const [kind, userId] = v.split(":");
                          setSteps((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, approver_kind: kind as StepDraft["approver_kind"], approver_user_id: userId || null } : x
                            )
                          );
                        }}
                        ariaLabel="Approver kind"
                        className="mt-1"
                      >
                        <option value="ticket_manager:" className="bg-zinc-900">
                          Ticket manager (resolved on ticket)
                        </option>
                        <option value="user:" className="bg-zinc-900">
                          Specific user…
                        </option>
                        {marketingManagers.map((p) => (
                          <option key={p.id} value={`user:${p.id}`} className="bg-zinc-900">
                            {p.full_name || p.email || p.id}
                          </option>
                        ))}
                      </PillSelect>
                    </div>
                    <div className="md:col-span-12 flex justify-end">
                      <AppButton intent="danger" size="sm" className="h-10 px-4" onPress={() => onRemoveStep(idx)}>
                        Remove
                      </AppButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Surface>
      </div>
    </main>
  );
}


