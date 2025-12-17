import { MonthlySnapshotReport } from "@/components/reports/MonthlySnapshotReport";

export default async function ProjectActivationsReportPage({ params }: { params?: Promise<{ projectId: string }> }) {
  const resolved = (await params) ?? { projectId: "" };
  return <MonthlySnapshotReport channel="activations" fixedProjectId={resolved.projectId} backHref={`/projects/${resolved.projectId}`} />;
}

