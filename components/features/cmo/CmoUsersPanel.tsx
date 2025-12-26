"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import { Surface } from "@/components/ds/Surface";
import type { Profile, UserRole } from "@/lib/dashboardDb";
import { cmoCreateUser, listProfiles, updateUserCanManageTasks, updateUserIsMarketingTeam, updateUserRole } from "@/lib/dashboardDb";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "brand_manager", label: "Brand" },
  { value: "sales_ops", label: "Sales Ops" },
  { value: "viewer", label: "Viewer" },
  { value: "cmo", label: "CMO" }
];

export function CmoUsersPanel(props: { onStatus: (msg: string) => void }) {
  const { onStatus } = props;

  const [localStatus, setLocalStatus] = useState<string>("");

  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("brand_manager");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listProfiles();
      setRows(data);
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

  async function onToggleTaskAdmin(userId: string, canManage: boolean) {
    onStatus("");
    try {
      onStatus("Saving permissions…");
      await updateUserCanManageTasks(userId, canManage);
      await refresh();
      onStatus("Permissions updated.");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Failed to update permissions");
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
          <div className="text-sm text-white/65">{loading ? "Loading users…" : `${filtered.length} user(s)`}</div>
          <div className="mt-3 space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-[220px]">
                    <div className="text-sm font-semibold text-white/90">{r.full_name?.trim() || "—"}</div>
                    <div className="mt-1 text-xs text-white/55">{r.email ?? "No email yet (backfill needed)"}</div>
                    <div className="mt-1 text-[11px] text-white/35">ID: {r.id.slice(0, 8)}…</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-[160px]">
                      <PillSelect
                        value={r.role}
                        onChange={(next) => onChangeRole(r.id, next as UserRole)}
                        ariaLabel="User role"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </PillSelect>
                    </div>
                    <div className="w-[180px]">
                      <PillSelect
                        value={(r.is_marketing_team ?? false) ? "yes" : "no"}
                        onChange={(next) => onToggleMarketingTeam(r.id, next === "yes")}
                        ariaLabel="Marketing team membership"
                      >
                        <option value="no">Marketing: Off</option>
                        <option value="yes">Marketing: On</option>
                      </PillSelect>
                    </div>
                    <div className="w-[180px]">
                      <PillSelect
                        value={(r.can_manage_tasks ?? false) ? "yes" : "no"}
                        onChange={(next) => onToggleTaskAdmin(r.id, next === "yes")}
                        ariaLabel="Task admin permission"
                      >
                        <option value="no">Tasks: No delete</option>
                        <option value="yes">Tasks: Can delete</option>
                      </PillSelect>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!loading && filtered.length === 0 ? <div className="text-sm text-white/60">No users found.</div> : null}
          </div>
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


