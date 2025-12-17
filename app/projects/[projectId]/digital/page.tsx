import { MonthlySnapshotReport } from "@/components/reports/MonthlySnapshotReport";

export default async function ProjectDigitalReportPage({ params }: { params?: Promise<{ projectId: string }> }) {
  const resolved = (await params) ?? { projectId: "" };
  return <MonthlySnapshotReport channel="digital" fixedProjectId={resolved.projectId} backHref={`/projects/${resolved.projectId}`} />;
}

