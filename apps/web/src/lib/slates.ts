import type {
  ApiErrorResponse,
  CreateSlateInput,
  InviteSlateCollaboratorResult,
  InviteSlateCollaboratorsInput,
  SlateDetail,
  SlateSummary,
} from "@slate/shared";
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toastManager } from "#/components/ui/toast";
import { api } from "#/lib/api";

export const slatesQueryOptions = queryOptions({
  queryKey: ["slates"] as const,
  queryFn: async () => {
    const { data } = await api.get<{ slates: SlateSummary[] }>("/slates");
    return data.slates;
  },
});

// Keep each shelf as its own query, so starred cards never need to be pulled
// out of the regular list in the dashboard component.
export type SlateListOptions = {
  starred?: boolean;
  scope?: "all" | "owned" | "shared";
  search?: string;
  limit?: number;
};

export function slatePagesQueryOptions(options: SlateListOptions = {}) {
  return infiniteQueryOptions({
    // Each search and filter gets separate pages, so switching filters starts a clean list.
    queryKey: ["slates", "pages", options] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<{ slates: SlateSummary[]; nextCursor: string | null }>(
        "/slates",
        {
          params: {
            limit: options.limit ?? 12,
            ...(typeof options.starred === "boolean" && { starred: options.starred }),
            ...(options.scope && { scope: options.scope }),
            ...(options.search && { search: options.search }),
            ...(pageParam && { cursor: pageParam }),
          },
        },
      );
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function slateDetailQueryOptions(slateId: string) {
  return queryOptions({
    queryKey: ["slates", slateId] as const,
    queryFn: async () => {
      const { data } = await api.get<{ slate: SlateDetail }>(`/slates/${slateId}`);
      return data.slate;
    },
  });
}

// Anyone can read a public slate, but this endpoint never grants edit access.
export function publicSlateQueryOptions(slateId: string) {
  return queryOptions({
    // Public and authenticated board reads share a cache slot so the route has one board shape.
    queryKey: ["slates", slateId] as const,
    queryFn: async () => {
      const { data } = await api.get<{ slate: SlateDetail }>(`/slates/public/${slateId}`);
      return data.slate;
    },
  });
}

export function useSlatesQuery() {
  return useQuery(slatesQueryOptions);
}

export function useSlatePagesQuery(options: SlateListOptions = {}) {
  return useInfiniteQuery(slatePagesQueryOptions(options));
}

export function useUpdateSlateTitleMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; title: string; starred: boolean; updatedAt: string },
    AxiosError<ApiErrorResponse>,
    { slateId: string; title: string }
  >({
    mutationFn: async ({ slateId, title }) => {
      const { data } = await api.patch<{
        slate: { id: string; title: string; starred: boolean; updatedAt: string };
      }>(`/slates/${slateId}`, { title });
      return data.slate;
    },
    onSuccess: (slate) => {
      queryClient.setQueryData(["slates", slate.id], (current: SlateDetail | undefined) =>
        current ? { ...current, title: slate.title, updatedAt: slate.updatedAt } : current,
      );
      queryClient.invalidateQueries({ queryKey: ["slates", "pages"] });
      queryClient.invalidateQueries({ queryKey: slatesQueryOptions.queryKey });
      toastManager.add({ type: "success", title: "Slate title saved" });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not save slate title",
        description: error.response?.data?.message ?? "Try saving again.",
      });
    },
  });
}

// Keep title and privacy changes in the same endpoint, while keeping titles in the page cache fresh.
export function useUpdateSlateMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; title: string; isPublic: boolean; starred: boolean; updatedAt: string },
    AxiosError<ApiErrorResponse>,
    { slateId: string; changes: { title?: string; isPublic?: boolean } }
  >({
    mutationFn: async ({ slateId, changes }) => {
      const { data } = await api.patch<{
        slate: {
          id: string;
          title: string;
          isPublic: boolean;
          starred: boolean;
          updatedAt: string;
        };
      }>(`/slates/${slateId}`, changes);
      return data.slate;
    },
    onSuccess: (slate, { changes }) => {
      queryClient.setQueryData(["slates", slate.id], (current: SlateDetail | undefined) =>
        current ? { ...current, ...slate } : current,
      );
      queryClient.invalidateQueries({ queryKey: ["slates", "pages"] });
      queryClient.invalidateQueries({ queryKey: slatesQueryOptions.queryKey });
      if (changes.isPublic !== undefined) {
        toastManager.add({
          type: "success",
          title: `Slate is now ${slate.isPublic ? "public" : "private"}`,
        });
      }
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not update slate",
        description: error.response?.data?.message ?? "Try again.",
      });
    },
  });
}

// Owners can remove a slate; removing it also clears its cached page data.
export function useDeleteSlateMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, AxiosError<ApiErrorResponse>, string>({
    mutationFn: async (slateId) => {
      await api.delete(`/slates/${slateId}`);
    },
    onSuccess: async (_, slateId) => {
      queryClient.removeQueries({ queryKey: ["slates", slateId] });
      await queryClient.invalidateQueries({ queryKey: ["slates"] });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not delete slate",
        description: error.response?.data?.message ?? "Try again.",
      });
    },
  });
}

// Send all invite addresses together and report individual delivery results.
export function useInviteCollaboratorsMutation(slateId: string) {
  return useMutation<
    InviteSlateCollaboratorResult[],
    AxiosError<ApiErrorResponse>,
    InviteSlateCollaboratorsInput
  >({
    mutationFn: async (input) => {
      const { data } = await api.post<{
        results: InviteSlateCollaboratorResult[];
      }>(`/slates/${slateId}/invitations`, input);
      return data.results;
    },
    onSuccess: (result) => {
      const sentCount = result.filter((item) => item.sent).length;
      if (sentCount)
        toastManager.add({
          type: "success",
          title: sentCount === 1 ? "Invitation sent" : `${sentCount} invitations sent`,
        });
    },
  });
}

export function useCreateSlateMutation() {
  const queryClient = useQueryClient();

  return useMutation<SlateSummary, AxiosError<ApiErrorResponse>, CreateSlateInput | undefined>({
    mutationFn: async (input) => {
      const { data } = await api.post<{ slate: SlateSummary }>("/slates", input ?? {});
      return data.slate;
    },
    onSuccess: (createdSlate) => {
      queryClient.setQueryData<SlateSummary[]>(slatesQueryOptions.queryKey, (prev) =>
        prev ? [createdSlate, ...prev] : [createdSlate],
      );
      queryClient.invalidateQueries({ queryKey: ["slates", "pages"] });
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not create slate",
        description: err.response?.data?.message ?? "Please try again.",
      });
    },
  });
}

export function useToggleStarredMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    AxiosError<ApiErrorResponse>,
    { slateId: string; starred: boolean },
    void
  >({
    mutationFn: async ({ slateId, starred }) => {
      if (starred) {
        await api.post(`/slates/${slateId}/star`);
      } else {
        await api.delete(`/slates/${slateId}/star`);
      }
    },
    onMutate: async () => {
      // Avoid an older in-flight page response overwriting the refreshed shelves.
      await queryClient.cancelQueries({ queryKey: ["slates", "pages"] });
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not update starred",
        description: err.response?.data?.message ?? "Please try again.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: slatesQueryOptions.queryKey });
      queryClient.invalidateQueries({ queryKey: ["slates", "pages"] });
    },
  });
}
