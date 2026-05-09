import { queryOptions } from "@tanstack/react-query";

import { getLeaderboard, getSceneBySlug, getSession, listScenes } from "@/lib/trpc-client";

export const sceneListQueryOptions = queryOptions({
  queryKey: ["scenes"] as const,
  queryFn: listScenes,
});

export function sceneBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["scene", slug] as const,
    queryFn: () => getSceneBySlug(slug),
  });
}

export function leaderboardQueryOptions(
  sceneId: number | undefined,
  page: number,
  pageSize: number,
) {
  return queryOptions({
    queryKey: ["leaderboard", sceneId, page, pageSize] as const,
    queryFn: () => getLeaderboard(sceneId!, page, pageSize),
    enabled: sceneId !== undefined,
  });
}

export function sessionQueryOptions(sessionId: string | undefined) {
  return queryOptions({
    queryKey: ["session", sessionId] as const,
    queryFn: () => getSession(sessionId!),
    enabled: sessionId !== undefined,
  });
}
