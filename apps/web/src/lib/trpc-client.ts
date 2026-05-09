import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "../../../server/src/trpc/routers/app.ts";

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
const trpcUrl = `${apiBaseUrl ?? ""}/trpc`;
const terminateSessionUrl = `${apiBaseUrl ?? ""}/session/terminate`;

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
    }),
  ],
});

export type SceneListItem = Awaited<ReturnType<typeof trpcClient.scene.list.query>>[number];
export type SceneDetails = Awaited<ReturnType<typeof trpcClient.scene.getBySlug.query>>;
export type StartSessionResult = Awaited<ReturnType<typeof trpcClient.session.start.mutate>>;
export type GuessInput = Parameters<typeof trpcClient.session.guess.mutate>[0];
export type GuessResult = Awaited<ReturnType<typeof trpcClient.session.guess.mutate>>;
export type EndSessionResult = Awaited<ReturnType<typeof trpcClient.session.terminate.mutate>>;
export type SessionDetails = Awaited<ReturnType<typeof trpcClient.session.get.query>>;
export type LeaderboardResult = Awaited<ReturnType<typeof trpcClient.session.best.query>>;
export type LeaderboardRow = LeaderboardResult["rows"][number];

export async function listScenes() {
  return trpcClient.scene.list.query();
}

export async function getSceneBySlug(slug: string) {
  return trpcClient.scene.getBySlug.query({ slug });
}

export async function startSession(sceneId: number) {
  return trpcClient.session.start.mutate({ sceneId });
}

export async function submitGuess(input: GuessInput) {
  return trpcClient.session.guess.mutate(input);
}

export async function endSession(sessionId: string) {
  return trpcClient.session.terminate.mutate({ sessionId });
}

export async function getSession(sessionId: string) {
  return trpcClient.session.get.query({ sessionId });
}

export function endSessionOnPageExit(sessionId: string) {
  const payload = JSON.stringify({ sessionId });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    const sent = navigator.sendBeacon(terminateSessionUrl, blob);
    if (sent) {
      return;
    }
  }

  if (typeof fetch === "function") {
    void fetch(terminateSessionUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }
}

export async function getLeaderboard(sceneId: number, page: number, pageSize: number) {
  return trpcClient.session.best.query({
    sceneId,
    page,
    pageSize,
  });
}
