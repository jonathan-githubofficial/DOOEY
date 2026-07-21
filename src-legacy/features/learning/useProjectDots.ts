import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { pb } from "@/lib/pb";
import { nextMonth } from "@/lib/date";
import { useAuthStore } from "@/stores";
import { categoryFor } from "./categories";
import { useLearningStore } from "./store";

/** Open project-task dots per day for one month ("YYYY-MM"), each in its
 * project's category hue — feeds the planner + calendar month grids. */
export function useMonthProjectDots(month: string): Record<string, string[]> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const programs = useLearningStore((s) => s.programs);

  const { data } = useQuery({
    queryKey: ["tasks", "projectDots", month] as const,
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("tasks").getFullList({
        filter: pb.filter(
          "project != '' && done_at = '' && due_date >= {:start} && due_date < {:end}",
          {
            start: new Date(`${month}-01T00:00:00.000Z`),
            end: new Date(`${nextMonth(month)}-01T00:00:00.000Z`),
          },
        ),
        fields: "due_date,project",
      });
      return records.map((r) => ({
        date: (r.due_date as string).slice(0, 10),
        project: r.project as string,
      }));
    },
  });

  return useMemo(() => {
    const accentOf = new Map(programs.map((p) => [p.pbId, categoryFor(p.goal).accent]));
    const map: Record<string, string[]> = {};
    for (const row of data ?? []) {
      (map[row.date] ??= []).push(accentOf.get(row.project) ?? "bg-ink/40");
    }
    return map;
  }, [data, programs]);
}
