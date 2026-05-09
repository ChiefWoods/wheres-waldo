import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { characters } from "@/lib/characters";
import { sessionQueryOptions } from "@/lib/query-options";
import { scenes } from "@/lib/scenes";
import { endSession, endSessionOnPageExit } from "@/lib/trpc-client";
import { isNotFoundTrpcError } from "@/lib/trpc-errors";

const pendingSessionTerminationTimers = new Map<string, ReturnType<typeof setTimeout>>();
const UNMOUNT_TERMINATION_DELAY_MS = 150;

type ClickAttempt = {
  actualX: number;
  actualY: number;
  normalizedX: number;
  normalizedY: number;
};

export const Route = createFileRoute("/play/$sessionId")({
  component: PlaySessionRoute,
});

function PlaySessionRoute() {
  const { sessionId } = Route.useParams();
  const hasTerminatedSessionRef = useRef(false);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [lastAttempt, setLastAttempt] = useState<ClickAttempt | null>(null);
  const [asideMaxHeight, setAsideMaxHeight] = useState<number | null>(null);
  const isDev = import.meta.env.DEV;
  const sessionQuery = useQuery(sessionQueryOptions(sessionId));
  const isSessionNotFound = sessionQuery.isError && isNotFoundTrpcError(sessionQuery.error);

  const scene = sessionQuery.data?.scene;
  const sceneAsset = useMemo(() => {
    if (!scene) {
      return undefined;
    }

    return scenes.find((asset) => asset.slug === scene.slug);
  }, [scene]);

  const sceneCharactersWithAssets = useMemo(() => {
    if (!scene) {
      return [];
    }

    return scene.characters.map((sceneCharacter) => {
      const characterAsset = characters.find((asset) => asset.name === sceneCharacter.name);
      return {
        ...sceneCharacter,
        imageUrl: characterAsset?.imageUrl,
      };
    });
  }, [scene]);

  useEffect(() => {
    const pendingTerminationTimer = pendingSessionTerminationTimers.get(sessionId);
    if (pendingTerminationTimer) {
      clearTimeout(pendingTerminationTimer);
      pendingSessionTerminationTimers.delete(sessionId);
    }

    const terminateSession = () => {
      if (hasTerminatedSessionRef.current) {
        return;
      }

      hasTerminatedSessionRef.current = true;
      void endSession(sessionId);
    };

    const scheduleTerminateSession = () => {
      const timer = setTimeout(() => {
        pendingSessionTerminationTimers.delete(sessionId);
        terminateSession();
      }, UNMOUNT_TERMINATION_DELAY_MS);

      pendingSessionTerminationTimers.set(sessionId, timer);
    };

    const handlePageHide = () => {
      if (hasTerminatedSessionRef.current) {
        return;
      }

      hasTerminatedSessionRef.current = true;
      endSessionOnPageExit(sessionId);
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      scheduleTerminateSession();
    };
  }, [sessionId]);

  useEffect(() => {
    const rightColumn = rightColumnRef.current;
    if (!rightColumn) {
      return;
    }

    const updateAsideHeight = () => {
      setAsideMaxHeight(rightColumn.getBoundingClientRect().height);
    };

    updateAsideHeight();

    const observer = new ResizeObserver(updateAsideHeight);
    observer.observe(rightColumn);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleSceneClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!scene) {
      return;
    }

    const sourceWidth = scene.width ?? naturalDimensions?.width;
    const sourceHeight = scene.height ?? naturalDimensions?.height;
    if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const scale = Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const clickXFromAnchor = event.clientX - rect.left - offsetX;
    const clickYFromAnchor = event.clientY - rect.top - offsetY;

    if (
      clickXFromAnchor < 0 ||
      clickYFromAnchor < 0 ||
      clickXFromAnchor > renderedWidth ||
      clickYFromAnchor > renderedHeight
    ) {
      return;
    }

    const actualX = clickXFromAnchor * (sourceWidth / renderedWidth);
    const actualY = clickYFromAnchor * (sourceHeight / renderedHeight);
    const normalizedX = actualX / sourceWidth;
    const normalizedY = actualY / sourceHeight;

    setLastAttempt({
      actualX,
      actualY,
      normalizedX,
      normalizedY,
    });
  };

  return (
    <section className="relative left-1/2 w-[min(1600px,calc(100vw-1.5rem))] -translate-x-1/2 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Game Session</h1>
        <p className="text-muted-foreground text-sm">
          Scene: <span className="font-medium">{scene?.name ?? "Loading..."}</span>
        </p>
      </header>

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          className="bg-card text-card-foreground border-border flex h-full min-h-0 flex-col rounded-lg border p-4"
          style={asideMaxHeight ? { maxHeight: `${Math.max(0, asideMaxHeight)}px` } : undefined}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide">Find These Characters</h2>
          <ul className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {!isSessionNotFound && sessionQuery.isPending ? (
              <li className="text-muted-foreground text-sm">Loading scene targets...</li>
            ) : sceneCharactersWithAssets.length ? (
              sceneCharactersWithAssets.map((character) => (
                <li key={character.id} className="bg-muted/30 rounded-md border p-2">
                  {character.imageUrl ? (
                    <img
                      src={character.imageUrl}
                      alt={character.name}
                      className="bg-muted aspect-square w-full rounded-md border object-contain p-1"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground grid aspect-square w-full place-items-center rounded-md border text-[10px]">
                      N/A
                    </div>
                  )}
                  <p className="mt-2 text-center text-sm font-medium">{character.name}</p>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground text-sm">
                No characters configured for this scene.
              </li>
            )}
          </ul>
        </aside>

        <div ref={rightColumnRef} className="space-y-3">
          <button
            type="button"
            onClick={handleSceneClick}
            className="bg-muted relative block h-[clamp(380px,68vh,860px)] w-full min-w-0 overflow-hidden rounded-lg border text-left"
            disabled={!sceneAsset || sessionQuery.isPending || isSessionNotFound}
          >
            {isSessionNotFound ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-base font-medium">
                Session not found
              </div>
            ) : sceneAsset ? (
              <img
                src={sceneAsset.imageUrl}
                alt={scene?.name ?? sceneAsset.name}
                className="h-full w-full object-contain"
                onLoad={(event) => {
                  setNaturalDimensions({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                }}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Scene asset not found.
              </div>
            )}
          </button>

          {sessionQuery.isError && !isSessionNotFound ? (
            <p className="text-destructive text-sm">Failed to load session details.</p>
          ) : null}

          <p className="text-muted-foreground text-sm">
            Click the scene to register an attempt coordinate.
          </p>

          {isDev && (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-xs font-semibold tracking-wide">Dev Click Coordinates</p>
              {lastAttempt ? (
                <p className="text-muted-foreground mt-1 text-sm font-mono">
                  actual=({lastAttempt.actualX.toFixed(1)}, {lastAttempt.actualY.toFixed(1)}) norm=(
                  {lastAttempt.normalizedX.toFixed(4)}, {lastAttempt.normalizedY.toFixed(4)})
                </p>
              ) : (
                <p className="text-muted-foreground mt-1 text-sm">No click recorded yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
