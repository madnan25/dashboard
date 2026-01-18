"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
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

  const canManage = me?.role === "cmo";
  const selectedTeam = useMemo(() => teams.find((t) => t.id === selectedId) ?? null, [selectedId, teams]);

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
      return;
    }
    setEditName(selectedTeam.name);
    setEditDesc(selectedTeam.description ?? "");
    setEditApproverId(selectedTeam.approver_user_id ?? "");
  }, [selectedTeam]);

  async function onCreateTeam() {
    if (!canManage) return;
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setStatus("");
    try {
      const created = await createTaskTeam({
        name,
        description: newDesc.trim() ? newDesc.trim() : null,
        approver_user_id: newApproverId || null
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

  async function onSaveTeam() {
    if (!canManage || !selectedTeam) return;
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    setStatus("");
    try {
      await updateTaskTeam(selectedTeam.id, {
        name,
        description: editDesc.trim() ? editDesc.trim() : null,
        approver_user_id: editApproverId || null
      });
      await refresh();
      setStatus("Team updated.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to update team");
    } finally {
      setSaving(false);
    }
  }

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
                    Select approver (optional)
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {labelForProfile(p)}
                    </option>
                  ))}
                </PillSelect>
              </div>
            </div>
            <AppButton intent="primary" className="h-11 px-6" onPress={onCreateTeam} isDisabled={creating || !newName.trim()}>
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

            <div className="flex items-end justify-end gap-2">
              <AppButton intent="primary" className="h-10 px-4" onPress={onSaveTeam} isDisabled={!selectedTeam || saving}>
                {saving ? "Saving…" : "Save changes"}
              </AppButton>
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
                    Select approver (optional)
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {labelForProfile(p)}
                    </option>
                  ))}
                </PillSelect>
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
