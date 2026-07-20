// The tasks feature's public surface (unit 5.1). The legacy tree carried this barrel
// (src-legacy/features/tasks/index.ts); the L1-L4 migration wired pages via subpath imports and
// never re-created it, so it lands here alongside the WeekGrid/WeekStrip/MonthView ports that the
// Calendar + Today pages consume through it. Shape mirrors the legacy barrel.
export { AgendaSheet } from "./components/AgendaSheet";
export { TimeboxSheet } from "./components/TimeboxSheet";
export { WeekGrid } from "./components/WeekGrid";
export { WeekStrip } from "./components/WeekStrip";
export { MonthView } from "./components/MonthView";
export { TaskComposer } from "./components/TaskComposer";
export { ComposerSheet } from "./components/ComposerSheet";
export { PlannerBook } from "./components/PlannerBook";
export { TaskDetail } from "./components/TaskDetail";
export { useTasksLive, localDate, useProjectTasks, useCreateTask, useUpdateTask } from "./api";
export type { Task } from "./types";
