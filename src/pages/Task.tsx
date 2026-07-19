import { useParams } from "@tanstack/react-router";
import { TaskDetail } from "@/features/tasks";

export function TaskPage() {
  const { id } = useParams({ from: "/task/$id" });
  return <TaskDetail id={id} />;
}
