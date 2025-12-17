import { ChannelReport } from "@/components/reports/ChannelReport";

export default async function ProjectActivationsReportPage({ params }: { params?: Promise<{ projectId: string }> }) {
  const resolved = (await params) ?? { projectId: "" };
  return <ChannelReport projectId={resolved.projectId} channel="activations" />;
}

