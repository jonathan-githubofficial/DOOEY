import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import type { BoardPatch, Moodboard } from "./types";

export const boardKeys = {
  all: ["boards"] as const,
  list: ["boards", "list"] as const,
  detail: (id: string) => ["boards", "detail", id] as const,
};

function toBoard(r: RecordModel): Moodboard {
  return {
    id: r.id,
    title: r.title,
    items: r.items ?? [],
    doodle: r.doodle ?? [],
    photos: r.photos ?? [],
    updated: r.updated,
  };
}

export function boardPhotoUrl(id: string, filename: string): string {
  return `${pb.baseURL}/api/files/moodboards/${id}/${encodeURIComponent(filename)}`;
}

export function useBoards() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: boardKeys.list,
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("moodboards").getFullList({ sort: "-updated" });
      return records.map(toBoard);
    },
  });
}

export function useBoard(id: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: boardKeys.detail(id),
    enabled: isAuthenticated,
    queryFn: async () => toBoard(await pb.collection("moodboards").getOne(id)),
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      pb.collection("moodboards").create(
        { owner: pb.authStore.record!.id, title, items: [], doodle: [] },
        { requestKey: null },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BoardPatch }) =>
      pb.collection("moodboards").update(id, patch, { requestKey: null }),
    // Optimistic: canvas edits (drag, type) must feel instant.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: boardKeys.detail(id) });
      const prev = qc.getQueryData<Moodboard>(boardKeys.detail(id));
      qc.setQueryData<Moodboard>(boardKeys.detail(id), (b) => (b ? { ...b, ...patch } : b));
      return { prev, id };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKeys.detail(ctx.id), ctx.prev);
    },
    // No onSettled refetch: the optimistic cache is the live truth here, so
    // rapid drags don't trigger a refetch storm that flickers.
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("moodboards").delete(id, { requestKey: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
  });
}
