"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import type * as React from "react";
import { Surface } from "@/components/ds/Surface";
import { PillSelect } from "@/components/ds/PillSelect";
import type { Project } from "@/lib/dashboardDb";

export function PlanningProjectBar(props: {
  status: string;
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  right?: React.ReactNode;
  snapshotHref?: string;
  isDisabled?: boolean;
}) {
  const { status, projects, projectId, setProjectId, right, snapshotHref, isDisabled } = props;

  return (
    <Surface>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-white/60">{status || " "}</div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-white/60">Project</div>
          <PillSelect value={projectId} onChange={setProjectId} disabled={isDisabled} ariaLabel="Project">
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-zinc-900">
                {p.name}
              </option>
            ))}
          </PillSelect>
          {right}
          <Button
            as={Link}
            href={snapshotHref ?? (projectId ? `/projects/${projectId}` : "/projects")}
            variant="flat"
            className="glass-inset text-white/80"
          >
            Open Project Snapshot
          </Button>
        </div>
      </div>
    </Surface>
  );
}
