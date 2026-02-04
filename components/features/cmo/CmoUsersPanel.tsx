"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import { Surface } from "@/components/ds/Surface";
import type { Profile, UserRole } from "@/lib/dashboardDb";
import {
  cmoCreateUser,
  cmoDeleteUser,
  getCurrentProfile,
  listProfiles,
  updateUserIsMarketingManager,
  updateUserIsMarketingTeam,
  updateUserRole
} from "@/lib/dashboardDb";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "brand_manager", label: "Brand" },
  { value: "member", label: "Member" },
  { value: "sales_ops", label: "Sales Ops" },
  { value: "viewer", label: "Viewer" },
  { value: "admin_viewer", label: "Admin Viewer" },
  { value: "cmo", label: "CMO" }
];

export function CmoUsersPanel(props: { onStatus: (msg: string) => void }) {
  const { onStatus } = props;

  const [localStatus, setLocalStatus] = useState<string>("");

  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showNonMarketing, setShowNonMarketing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("brand_manager");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [data, me] = await Promise.all([listProfiles(), getCurrentProfile().catch(() => null)]);
      setRows(data);
      setCurrentUserId(me?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {
      // ignore; status is shown by parent surfaces elsewhere
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const email = (r.email ?? "").toLowerCase();
      const name = (r.full_name ?? "").toLowerCase();
      const id = r.id.toLowerCase();
      return email.includes(q) || name.includes(q) || id.includes(q);
    });
  }, [rows, search]);

  async function onChangeRole(userId: string, role: UserRole) {
    onStatus("");
    try {
      onStatus("Saving role…");
      await updateUserRole(userId, role);
      await refresh();
      onStatus("Role updated.");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Failed to update role");
    }
  }

  async function onToggleMarketingTeam(userId: string, isMarketing: boolean) {
    onStatus("");
    try {
      onStatus("Saving team…");
      await updateUserIsMarketingTeam(userId, isMarketing);
      await refresh();
      onStatus("Marketing team updated.");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Failed to update marketing team");
    }
  }

  async function onToggleManager(userId: string, next: boolean) {
    onStatus("");
    try {
      onStatus("Saving manager access…");
      // Approvers must be marketing team + marketing manager. If manager is enabled,
      // ensure the user is also part of the marketing team so they can be selected.
      if (next) {
        await updateUserIsMarketingTeam(userId, true);
      }
      await updateUserIsMarketingManager(userId, next);
      await refresh();
      onStatus("Manager access updated.");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Failed to update manager access");
    }
  }

  async function onAddToMarketing(userId: string) {
    onStatus("");
    try {
      onStatus("Adding to marketing…");
      await updateUserIsMarketingTeam(userId, true);
      // default: manager access off (brand_manager/CMO are handled by role defaults)
      await updateUserIsMarketingManager(userId, false);
      await refresh();
      onStatus("Added to marketing team.");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Failed to add to marketing");
    }
  }

  async function onRemoveFromMarketing(userId: string) {
    onStatus("");
    try {
      onStatus("Removing from marketing…");
      await updateUserIsMarketingTeam(userId, false);
      await refresh();
      onStatus("Removed from marketing team.");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Failed to remove from marketing");
    }
  }

  async function onCreate() {
    const email = createEmail.trim();
    if (!email) return;
    onStatus("");
    setLocalStatus("");
    setCreating(true);
    try {
      onStatus("Creating user…");
      setLocalStatus("Creating user…");
      await cmoCreateUser({ email, role: createRole, full_name: createName.trim() || null });
      setCreateEmail("");
      setCreateName("");
      setCreateRole("brand_manager");
      await refresh();
      onStatus("User created. They can now sign in via magic link.");
      setLocalStatus("User created. They can now sign in via magic link.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create user";
      onStatus(msg);
      setLocalStatus(msg);
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteUser(row: Profile) {
    if (!row.id) return;
    if (row.id === currentUserId) {
      onStatus("You cannot delete your own account.");
      return;
    }
    const label = row.full_name?.trim() || row.email || row.id;
    const confirmed = window.confirm(`Delete ${label}? This removes the account and cannot be undone.`);
    if (!confirmed) return;
    onStatus("");
    setLocalStatus("");
    setDeletingUserId(row.id);
    try {
      onStatus("Deleting user…");
      const res = await cmoDeleteUser(row.id);
      await refresh();
      if (res.warnings && res.warnings.length > 0) {
        onStatus("User deleted with warnings. Check server logs if needed.");
      } else {
        onStatus("User deleted.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete user";
      onStatus(msg);
      setLocalStatus(msg);
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white/90">Account management</div>
          <div className="mt-1 text-sm text-white/55">Assign roles for existing users, or create new users by email (magic-link login).</div>
        </div>
        <div className="w-full max-w-[280px]">
          <AppInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search by email, name, or ID…"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-7">
          {(() => {
            const marketing = filtered.filter((r) => r.role === "cmo" || r.role === "brand_manager" || r.role === "member" || r.is_marketing_team);
            const nonMarketing = filtered.filter((r) => !(r.role === "cmo" || r.role === "brand_manager" || r.role === "member" || r.is_marketing_team));

            return (
              <div className="space-y-4">
                <div className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white/85">Marketing team</div>
                      <div className="mt-1 text-xs text-white/55">
                        Members who can access Tasks. Managers can delete tasks.
                      </div>
                    </div>
                    <div className="text-xs text-white/55 tabular-nums">
                      {loading ? "Loading…" : `${marketing.length} member(s)`}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {marketing.map((r) => {
                      const isCmo = r.role === "cmo";
                      const isSelf = currentUserId != null && r.id === currentUserId;
                      const tasksBlocked = r.role === "sales_ops";
                      const planningBlocked = r.role === "viewer" || r.role === "admin_viewer";
                      const readOnlyTasks = r.role === "viewer" || r.role === "admin_viewer";
                      const canToggleManager = !isCmo && !readOnlyTasks && r.role !== "sales_ops";
                      return (
                        <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-[220px]">
                              <div className="text-sm font-semibold text-white/90">{r.full_name?.trim() || "—"}</div>
                              <div className="mt-1 text-xs text-white/55">{r.email ?? "No email yet (backfill needed)"}</div>
                              <div className="mt-1 text-[11px] text-white/35">ID: {r.id.slice(0, 8)}…</div>
                              {tasksBlocked ? (
                                <div className="mt-2 text-[11px] text-amber-200/80">
                                  Note: Sales Ops can’t access Tasks. Change role to Viewer (recommended) or Brand/CMO.
                                </div>
                              ) : null}
                              {planningBlocked ? (
                                <div className="mt-1 text-[11px] text-white/45">Planning & Actuals is disabled for view-only roles (Viewer/Admin Viewer).</div>
                              ) : null}
                              {readOnlyTasks ? (
                                <div className="mt-1 text-[11px] text-white/45">
                                  View-only roles can see Tasks but cannot edit. Set role to Member to work on Tasks.
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="w-[160px]">
                                <PillSelect value={r.role} onChange={(next) => onChangeRole(r.id, next as UserRole)} ariaLabel="User role">
                                  {ROLE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </PillSelect>
                              </div>

                              <div className="w-[180px]">
                                <PillSelect
                                  value={(isCmo || r.role === "brand_manager") ? "yes" : (r.is_marketing_manager ? "yes" : "no")}
                                  onChange={(next) => onToggleManager(r.id, next === "yes")}
                                  ariaLabel="Manager capabilities"
                                  disabled={!canToggleManager}
                                >
                                  <option value="no">Manager: Off</option>
                                  <option value="yes">Manager: On</option>
                                </PillSelect>
                              </div>

                              <AppButton
                                intent={isCmo ? "secondary" : "danger"}
                                size="sm"
                                className="h-10 px-4 whitespace-nowrap"
                                onPress={() => onRemoveFromMarketing(r.id)}
                                isDisabled={isCmo}
                              >
                                Remove
                              </AppButton>
                              <AppButton
                                intent="danger"
                                size="sm"
                                className="h-10 px-4 whitespace-nowrap"
                                onPress={() => onDeleteUser(r)}
                                isDisabled={isSelf || deletingUserId === r.id}
                              >
                                {deletingUserId === r.id ? "Deleting…" : "Delete"}
                              </AppButton>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!loading && marketing.length === 0 ? (
                      <div className="text-sm text-white/60">No marketing members found.</div>
                    ) : null}
                  </div>
                </div>

                <div className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white/85">Not in marketing</div>
                      <div className="mt-1 text-xs text-white/55">Collapsed by default to keep this screen focused.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-white/55 tabular-nums">{loading ? "Loading…" : `${nonMarketing.length} user(s)`}</div>
                      <AppButton
                        intent="secondary"
                        size="sm"
                        className="h-10 px-4 whitespace-nowrap"
                        onPress={() => setShowNonMarketing((v) => !v)}
                        isDisabled={loading}
                      >
                        {showNonMarketing ? "Hide" : "Show"}
                      </AppButton>
                    </div>
                  </div>

                  {showNonMarketing ? (
                    <div className="mt-3 space-y-2">
                      {nonMarketing.map((r) => (
                        <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-[220px]">
                              <div className="text-sm font-semibold text-white/90">{r.full_name?.trim() || "—"}</div>
                              <div className="mt-1 text-xs text-white/55">{r.email ?? "No email yet (backfill needed)"}</div>
                              <div className="mt-1 text-[11px] text-white/35">ID: {r.id.slice(0, 8)}…</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="w-[160px]">
                                <PillSelect value={r.role} onChange={(next) => onChangeRole(r.id, next as UserRole)} ariaLabel="User role">
                                  {ROLE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </PillSelect>
                              </div>
                              <AppButton
                                intent="primary"
                                size="sm"
                                className="h-10 px-4 whitespace-nowrap"
                                onPress={() => onAddToMarketing(r.id)}
                              >
                                Add to marketing
                              </AppButton>
                              <AppButton
                                intent="danger"
                                size="sm"
                                className="h-10 px-4 whitespace-nowrap"
                                onPress={() => onDeleteUser(r)}
                                isDisabled={deletingUserId === r.id}
                              >
                                {deletingUserId === r.id ? "Deleting…" : "Delete"}
                              </AppButton>
                            </div>
                          </div>
                        </div>
                      ))}

                      {!loading && nonMarketing.length === 0 ? <div className="text-sm text-white/60">No users found.</div> : null}
                    </div>
                  ) : null}
                </div>

                {!loading && filtered.length === 0 ? <div className="text-sm text-white/60">No users found.</div> : null}
              </div>
            );
          })()}
        </div>

        <div className="md:col-span-5">
          <div className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-sm font-semibold text-white/85">Create user</div>
            <div className="mt-1 text-xs text-white/55">Creates an Auth user (no password). They will sign in via magic link like everyone else.</div>

            <div className="mt-4 space-y-3">
              <AppInput
                value={createEmail}
                onValueChange={setCreateEmail}
                placeholder="email@company.com"
              />

              <AppInput
                value={createName}
                onValueChange={setCreateName}
                placeholder="Full name (optional)"
              />

              <PillSelect value={createRole} onChange={(v) => setCreateRole(v as UserRole)} ariaLabel="New user role">
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </PillSelect>

              <AppButton
                intent="primary"
                className="w-full"
                onPress={onCreate}
                isDisabled={!createEmail.trim() || creating}
              >
                {creating ? "Creating…" : "Create user"}
              </AppButton>

              {localStatus ? (
                <div
                  className={[
                    "rounded-2xl border px-4 py-3 text-xs",
                    localStatus.toLowerCase().includes("created")
                      ? "border-emerald-400/15 bg-emerald-500/10 text-emerald-200"
                      : localStatus.toLowerCase().includes("missing") || localStatus.toLowerCase().includes("failed") || localStatus.toLowerCase().includes("error")
                        ? "border-rose-400/20 bg-rose-500/10 text-rose-200"
                        : "border-white/10 bg-white/[0.03] text-white/70"
                  ].join(" ")}
                >
                  {localStatus}
                </div>
              ) : null}

              <div className="text-[11px] text-white/45">
                Note: your Vercel project must have <code>SUPABASE_SERVICE_ROLE_KEY</code> set (server-only) for user creation.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}


