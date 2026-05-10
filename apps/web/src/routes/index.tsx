import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { sceneListQueryOptions } from "@/lib/query-options";
import { scenes } from "@/lib/scenes";
import { startSession } from "@/lib/trpc-client";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  const navigate = useNavigate({ from: "/" });
  const [startError, setStartError] = useState<string | null>(null);
  const sceneListQuery = useQuery(sceneListQueryOptions);

  const serverSceneBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const scene of sceneListQuery.data ?? []) {
      map.set(scene.slug, scene.id);
    }
    return map;
  }, [sceneListQuery.data]);

  const startSessionMutation = useMutation({
    mutationFn: startSession,
  });

  const handleStartSession = async (sceneSlug: string) => {
    const sceneId = serverSceneBySlug.get(sceneSlug);
    if (!sceneId) {
      setStartError(`Scene "${sceneSlug}" is not configured on the server.`);
      return;
    }

    setStartError(null);

    try {
      const session = await startSessionMutation.mutateAsync(sceneId);
      navigate({
        to: "/play/$sessionId",
        params: { sessionId: session.sessionId },
      });
    } catch {
      setStartError("Failed to start session. Please try again.");
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a Scene</h1>
        <p className="text-sm text-muted-foreground">Pick a scene to start playing.</p>
        {sceneListQuery.isError ? (
          <p className="text-sm text-destructive" role="alert">
            Failed to load scenes from server.
          </p>
        ) : null}
        {startError ? (
          <p className="text-sm text-destructive" role="alert">
            {startError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene) => (
          <button
            type="button"
            key={scene.slug}
            disabled={sceneListQuery.isPending || startSessionMutation.isPending}
            onClick={() => void handleStartSession(scene.slug)}
            className="rounded-lg border border-border bg-card p-4 text-left text-card-foreground transition-colors outline-none hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <h2 className="font-medium">{scene.name}</h2>
            <img
              src={scene.imageUrl}
              alt={scene.name}
              className="mt-3 aspect-[4/3] w-full rounded object-cover"
              loading="lazy"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {startSessionMutation.isPending
                ? "Starting session..."
                : sceneListQuery.isPending
                  ? "Loading scenes..."
                  : "Click to start game"}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
