// The task route element (unit 4.2, ported from src-legacy/pages/Task.tsx). Reads the id from the
// L3 guard route (`/app/task/$id`, path `/task/$id`) and hands it to <TaskDetail>. The exported
// name matches the L3 route wiring (router.tsx: taskRoute.component = TaskPage).
import { useParams } from "@tanstack/react-router";

import { TaskDetail } from "@/features/tasks/components/TaskDetail";

export function TaskPage() {
  const { id } = useParams({ from: "/app/task/$id" });
  return <TaskDetail id={id} />;
}
