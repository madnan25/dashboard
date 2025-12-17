import { ProjectHub } from "@/components/projects/ProjectHub";

export default async function ProjectHubPage({ params }: { params?: Promise<{ projectId: string }> }) {
  const resolved = (await params) ?? { projectId: "" };
  return <ProjectHub projectId={resolved.projectId} />;
}

