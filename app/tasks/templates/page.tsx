"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import { isMarketingManagerProfile } from "@/components/tasks/taskModel";
import type { Profile, TaskTeam } from "@/lib/dashboardDb";
import { createTaskTeam, deleteTaskTeam, getCurrentProfile, listProfiles, listTaskTeams, updateTaskTeam } from "@/lib/dashboardDb";

export const dynamic = "force-dynamic";

function labelForProfile(p: Profile) {
  return p.full_name || p.email || p.id;
}

export default function TaskTeamsPage() {
  const [status, setStatus] = useState("");
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<TaskTeam[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newApproverId, setNewApproverId] = useState("");
  const [creating, setCreating] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editApproverId, setEditApproverId] = useState("");
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef<{ name: string; description: string | null; approver_user_id: string } | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canManage = me?.role === "cmo";
  const selectedTeam = useMemo(() => teams.find((t) => t.id === selectedId) ?? null, [selectedId, teams]);
  // Approver must be a marketing manager (CMO counts).
  const approverProfiles = useMemo(() => profiles.filter(isMarketingManagerProfile), [profiles]);

  function getApproverOptionProfiles(selected: string) {
    if (!selected) return approverProfiles;
    if (approverProfiles.some((p) => p.id === selected)) return approverProfiles;
    const current = profiles.find((p) => p.id === selected) ?? null;
    return current ? [current, ...approverProfiles] : approverProfiles;
  }

  async function refresh() {
    const [teamRows, profileRows] = await Promise.all([listTaskTeams(), listProfiles()]);
    setTeams(teamRows);
    setProfiles(profileRows);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        setStatus("");
        const [p] = await Promise.all([getCurrentProfile()]);
        if (cancelled) return;
        setMe(p);
        await refresh();
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load teams");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTeam) {
      setEditName("");
      setEditDesc("");
      setEditApproverId("");
      lastSavedRef.current = null;
      return;
    }
    setEditName(selectedTeam.name);
    setEditDesc(selectedTeam.description ?? "");
    setEditApproverId(selectedTeam.approver_user_id ?? "");
    lastSavedRef.current = {
      name: selectedTeam.name,
      description: selectedTeam.description ?? null,
      approver_user_id: selectedTeam.approver_user_id ?? ""
    };
  }, [selectedTeam]);

  async function onCreateTeam() {
    if (!canManage) return;
    const name = newName.trim();
    if (!name) return;
    if (!newApproverId) {
      setStatus("Select an approver (required) before creating a team.");
      return;
    }
    setCreating(true);
    setStatus("");
    try {
      const created = await createTaskTeam({
        name,
        description: newDesc.trim() ? newDesc.trim() : null,
        approver_user_id: newApproverId
      });
      setNewName("");
      setNewDesc("");
      setNewApproverId("");
      await refresh();
      setSelectedId(created.id);
      setStatus("Team created.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  // Autosave team edits (Notion-style). Debounced to avoid chatty updates.
  useEffect(() => {
    if (!canManage) return;
    if (!selectedTeam) return;
    if (!lastSavedRef.current) return;

    const name = editName.trim();
    const description = editDesc.trim() ? editDesc.trim() : null;
    const approver_user_id = editApproverId;

    // Don't persist invalid state; let user keep typing/choosing.
    if (!name) return;
    if (!approver_user_id) return;

    const prev = lastSavedRef.current;
    const changed =
      name !== prev.name || description !== prev.description || approver_user_id !== prev.approver_user_id;
    if (!changed) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      setStatus("Saving…");
      try {
        await updateTaskTeam(selectedTeam.id, { name, description, approver_user_id });
        lastSavedRef.current = { name, description, approver_user_id };
        setStatus("Team updated.");
        // Best-effort refresh so list/selection stays in sync.
        await refresh().catch(() => null);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed to update team");
      } finally {
        setSaving(false);
      }
    }, 650);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [canManage, editApproverId, editDesc, editName, selectedTeam]);

  async function onDeleteTeam() {
    if (!canManage || !selectedTeam) return;
    if (!confirm(`Delete team “${selectedTeam.name}”?`)) return;
    setStatus("Deleting…");
    try {
      await deleteTaskTeam(selectedTeam.id);
      setSelectedId("");
      await refresh();
      setStatus("Team deleted.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to delete team");
    }
  }

  if (me && !canManage) {
    return (
      <main className="min-h-screen px-4 md:px-6 pb-10">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeader title="Teams" subtitle="CMO only." showBack backHref="/tasks" />
          <Surface>
            <div className="text-sm text-white/75">You don’t have access to manage teams.</div>
            <div className="mt-1 text-xs text-white/50">Ask the CMO to configure teams and approvers.</div>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader title="Teams" subtitle="Map each team to its approver." showBack backHref="/tasks" />

        <Surface>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-white/45">Create team</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <AppInput value={newName} onValueChange={setNewName} isDisabled={creating} placeholder="Team name" />
                <AppInput value={newDesc} onValueChange={setNewDesc} isDisabled={creating} placeholder="Description (optional)" />
              </div>
              <div className="mt-2">
                <PillSelect value={newApproverId} onChange={setNewApproverId} ariaLabel="Approver" disabled={creating}>
                  <option value="" className="bg-zinc-900">
                    Select approver (required)
                  </option>
                  {getApproverOptionProfiles(newApproverId).map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {labelForProfile(p)}
                    </option>
                  ))}
                </PillSelect>
              </div>
            </div>
            <AppButton
              intent="primary"
              className="h-11 px-6"
              onPress={onCreateTeam}
              isDisabled={creating || !newName.trim() || !newApproverId}
            >
              {creating ? "Creating…" : "Create team"}
            </AppButton>
          </div>
        </Surface>

        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-white/60">{status || " "}</div>
            <div className="flex items-center gap-2">
              <AppButton intent="secondary" className="h-10 px-4" onPress={refresh}>
                Refresh
              </AppButton>
              <AppButton intent="danger" className="h-10 px-4" onPress={onDeleteTeam} isDisabled={!selectedTeam}>
                Delete team
              </AppButton>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">Select team</div>
              <PillSelect value={selectedId} onChange={setSelectedId} ariaLabel="Team" className="mt-2">
                <option value="" className="bg-zinc-900">
                  Select…
                </option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-zinc-900">
                    {t.name}
                  </option>
                ))}
              </PillSelect>
              {selectedTeam?.description ? <div className="mt-2 text-xs text-white/55">{selectedTeam.description}</div> : null}
            </div>
          </div>

          {selectedTeam ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/45">Team name</div>
                <AppInput value={editName} onValueChange={setEditName} isDisabled={saving} placeholder="Team name" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-white/45">Description</div>
                <AppInput value={editDesc} onValueChange={setEditDesc} isDisabled={saving} placeholder="Description" />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-widest text-white/45">Approver</div>
                <PillSelect value={editApproverId} onChange={setEditApproverId} ariaLabel="Approver" disabled={saving} className="mt-2">
                  <option value="" className="bg-zinc-900">
                    Select approver (required)
                  </option>
                  {getApproverOptionProfiles(editApproverId).map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {labelForProfile(p)}
                    </option>
                  ))}
                </PillSelect>
                {!editName.trim() ? <div className="mt-2 text-xs text-white/45">Team name is required.</div> : null}
                {!editApproverId ? <div className="mt-1 text-xs text-white/45">Approver is required.</div> : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-white/50">Select a team to edit its approver.</div>
          )}
        </Surface>
      </div>
    </main>
  );
}
