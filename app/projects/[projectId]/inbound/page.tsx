import { MonthlySnapshotReport } from "@/components/reports/MonthlySnapshotReport";

export default async function ProjectInboundReportPage({ params }: { params?: Promise<{ projectId: string }> }) {
  const resolved = (await params) ?? { projectId: "" };
  return <MonthlySnapshotReport channel="inbound" fixedProjectId={resolved.projectId} backHref={`/projects/${resolved.projectId}`} />;
}

