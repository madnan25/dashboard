"use client";

import { Button, Input } from "@heroui/react";
import { Surface } from "@/components/ds/Surface";
import type { Project } from "@/lib/dashboardDb";

export function CmoProjectsPanel(props: {
  projects: Project[];
  projectId: string;
  onSelectProject: (projectId: string) => void;
  onToggleActive: (projectId: string, next: boolean) => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  onCreateProject: () => void;
}) {
  const { projects, projectId, onSelectProject, onToggleActive, newProjectName, setNewProjectName, onCreateProject } = props;

  return (
    <Surface className="md:col-span-5">
      <div className="text-lg font-semibold text-white/90">Projects</div>
      <div className="mt-1 text-sm text-white/55">Only active projects should be used for planning/reporting.</div>

      <div className="mt-4 flex gap-2">
        <Input
          value={newProjectName}
          onValueChange={setNewProjectName}
          placeholder="New project name"
          variant="bordered"
          classNames={{
            inputWrapper: "glass-inset rounded-2xl border-white/10 bg-white/[0.02]",
            input: "text-white/90 placeholder:text-white/25"
          }}
        />
        <Button color="primary" onPress={onCreateProject} isDisabled={!newProjectName.trim()}>
          Create
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {projects.length === 0 ? (
          <div className="text-sm text-white/60">No projects yet.</div>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              className={[
                "group relative w-full overflow-hidden rounded-2xl border text-left transition",
                "hover:-translate-y-[1px] hover:border-white/15 hover:bg-white/[0.03]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0",
                p.id === projectId
                  ? "border-white/25 bg-white/[0.035] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_14px_50px_rgba(59,130,246,0.12)]"
                  : "border-white/5 bg-white/[0.02]"
              ].join(" ")}
              role="option"
              tabIndex={0}
              aria-selected={p.id === projectId}
              onClick={() => onSelectProject(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectProject(p.id);
                }
              }}
            >
              <div
                aria-hidden="true"
                className={["pointer-events-none absolute inset-0 opacity-0 transition-opacity", p.id === projectId ? "opacity-100" : "group-hover:opacity-60"].join(
                  " "
                )}
                style={{
                  background:
                    "radial-gradient(600px 120px at 20% 0%, rgba(59,130,246,0.22), transparent 60%), radial-gradient(600px 120px at 85% 100%, rgba(124,58,237,0.18), transparent 60%)"
                }}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="relative p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white/90">{p.name}</div>
                    {p.id === projectId ? (
                      <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/75">Selected</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-white/45">ID: {p.id.slice(0, 8)}…</div>
                </div>

                <div className="relative flex items-center gap-2 pr-3">
                  <div
                    className={[
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      p.is_active ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-white/50"
                    ].join(" ")}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    className="glass-inset text-white/80"
                    onPress={(ev) => {
                      // don't change selection when toggling
                      // @ts-expect-error heroui event type
                      ev?.stopPropagation?.();
                      onToggleActive(p.id, !p.is_active);
                    }}
                  >
                    {p.is_active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Surface>
  );
}
