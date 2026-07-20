import { useParams } from "@tanstack/react-router";
import { TaskDetail } from "@/features/tasks";

export function TaskPage() {
  const { id } = useParams({ from: "/app/task/$id" });
  return <TaskDetail id={id} />;
}
