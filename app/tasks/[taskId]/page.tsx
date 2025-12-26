import { TaskPage } from "@/components/tasks/TaskPage";

export const dynamic = "force-dynamic";

export default async function TaskRoutePage(props: { params?: Promise<{ taskId: string }> }) {
  const params = (await props.params) ?? { taskId: "" };
  return <TaskPage taskId={params.taskId} />;
}

