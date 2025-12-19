"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import type * as React from "react";
import { Surface } from "@/components/ds/Surface";
import type { Project } from "@/lib/dashboardDb";

export function PlanningProjectBar(props: {
  status: string;
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  right?: React.ReactNode;
  isDisabled?: boolean;
}) {
  const { status, projects, projectId, setProjectId, right, isDisabled } = props;

  return (
    <Surface>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-white/60">{status || " "}</div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-white/60">Project</div>
          <select
            className="glass-inset h-10 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-0 text-sm text-white/85 hover:bg-white/[0.04]"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={isDisabled}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-zinc-900">
                {p.name}
              </option>
            ))}
          </select>
          {right}
          <Button as={Link} href={projectId ? `/projects/${projectId}/digital` : "/projects"} variant="flat" className="glass-inset text-white/80">
            Open Digital Snapshot
          </Button>
        </div>
      </div>
    </Surface>
  );
}
