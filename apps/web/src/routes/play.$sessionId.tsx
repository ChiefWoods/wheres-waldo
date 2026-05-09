import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { characters } from "@/lib/characters";
import { sessionQueryOptions } from "@/lib/query-options";
import { scenes } from "@/lib/scenes";
import { endSession, endSessionOnPageExit, submitGuess } from "@/lib/trpc-client";
import { getErrorMessage, isNotFoundTrpcError } from "@/lib/trpc-errors";

const pendingSessionTerminationTimers = new Map<string, ReturnType<typeof setTimeout>>();
const UNMOUNT_TERMINATION_DELAY_MS = 150;

type ClickAttempt = {
  actualX: number;
  actualY: number;
  normalizedX: number;
  normalizedY: number;
};

type MenuState = ClickAttempt & {
  sceneX: number;
  sceneY: number;
};

type RenderedSceneBox = {
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
};

export const Route = createFileRoute("/play/$sessionId")({
  component: PlaySessionRoute,
});

function formatElapsedMs(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function PlaySessionRoute() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasTerminatedSessionRef = useRef(false);
  const hasRedirectedAfterFinishRef = useRef(false);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const sceneButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [lastAttempt, setLastAttempt] = useState<ClickAttempt | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [asideMaxHeight, setAsideMaxHeight] = useState<number | null>(null);
  const [renderedSceneBox, setRenderedSceneBox] = useState<RenderedSceneBox | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isDev = import.meta.env.DEV;

  const sessionQuery = useQuery(sessionQueryOptions(sessionId));
  const isSessionNotFound = sessionQuery.isError && isNotFoundTrpcError(sessionQuery.error);
  const sessionData = sessionQuery.data;
  const scene = sessionData?.scene;

  const foundCharacterIds = useMemo(() => {
    if (!scene) {
      return new Set<number>();
    }

    return new Set(
      scene.characters.filter((character) => character.found).map((character) => character.id),
    );
  }, [scene]);

  const totalTargets = sessionData?.totalTargets ?? scene?.characters.length ?? 0;
  const foundCount = sessionData?.foundCount ?? foundCharacterIds.size;
  const isGameFinished =
    sessionData?.status === "FINISHED" || (totalTargets > 0 && foundCount >= totalTargets);
  const sourceWidth = scene?.width ?? naturalDimensions?.width;
  const sourceHeight = scene?.height ?? naturalDimensions?.height;

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

  const guessMutation = useMutation({
    mutationFn: submitGuess,
    onSuccess: (result, variables) => {
      queryClient.setQueryData(sessionQueryOptions(sessionId).queryKey, (previousData) => {
        if (!previousData) {
          return previousData;
        }

        return {
          ...previousData,
          status: result.status,
          attempts: result.attempts,
          elapsedMs: result.elapsedMs ?? previousData.elapsedMs,
          foundCount: result.foundCount,
          totalTargets: result.totalTargets,
          scene: {
            ...previousData.scene,
            characters: previousData.scene.characters.map((character) => {
              if (character.id !== variables.characterId) {
                return character;
              }

              return result.isCorrect ? { ...character, found: true } : character;
            }),
          },
        };
      });

      if (result.isCorrect) {
        toast.success(
          `Character is found! ${Math.max(0, result.totalTargets - result.foundCount)} more to go`,
        );
      } else {
        toast.error("No character found here...");
      }
    },
    onError: (error) => {
      setMenuState(null);

      if (isNotFoundTrpcError(error)) {
        toast.error("Session not found.");
        return;
      }

      toast.error(getErrorMessage(error) ?? "Failed to submit guess. Please try again.");
    },
  });

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

  useEffect(() => {
    const sceneButton = sceneButtonRef.current;
    if (!sceneButton || !scene?.id) {
      setRenderedSceneBox(null);
      return;
    }

    if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
      setRenderedSceneBox(null);
      return;
    }

    const updateRenderedSceneBox = () => {
      const containerWidth = sceneButton.clientWidth;
      const containerHeight = sceneButton.clientHeight;
      if (containerWidth <= 0 || containerHeight <= 0) {
        setRenderedSceneBox(null);
        return;
      }

      const scale = Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight);
      const renderedWidth = sourceWidth * scale;
      const renderedHeight = sourceHeight * scale;
      const offsetX = (containerWidth - renderedWidth) / 2;
      const offsetY = (containerHeight - renderedHeight) / 2;

      setRenderedSceneBox({
        offsetX,
        offsetY,
        renderedWidth,
        renderedHeight,
      });
    };

    updateRenderedSceneBox();

    const observer = new ResizeObserver(updateRenderedSceneBox);
    observer.observe(sceneButton);

    return () => {
      observer.disconnect();
    };
  }, [scene?.id, sourceWidth, sourceHeight]);

  useEffect(() => {
    if (isSessionNotFound || isGameFinished) {
      setMenuState(null);
    }
  }, [isSessionNotFound, isGameFinished]);

  useEffect(() => {
    if (!isGameFinished || !scene?.slug || isSessionNotFound) {
      setRedirectCountdown(3);
      hasRedirectedAfterFinishRef.current = false;
      return;
    }

    let remainingSeconds = 3;
    setRedirectCountdown(remainingSeconds);

    const intervalId = window.setInterval(() => {
      remainingSeconds -= 1;
      setRedirectCountdown(Math.max(0, remainingSeconds));

      if (remainingSeconds > 0 || hasRedirectedAfterFinishRef.current) {
        return;
      }

      hasRedirectedAfterFinishRef.current = true;
      window.clearInterval(intervalId);
      void navigate({
        to: "/leaderboard",
        search: {
          scene: scene.slug,
          page: 1,
          pageSize: 10,
        },
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isGameFinished, scene?.slug, isSessionNotFound, navigate]);

  useEffect(() => {
    if (!menuState) {
      return;
    }

    const handleOutsidePointer = (event: globalThis.MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }

      setMenuState(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuState(null);
      }
    };

    window.addEventListener("mousedown", handleOutsidePointer);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleOutsidePointer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuState]);

  useEffect(() => {
    if (sessionData?.status !== "STARTED") {
      return;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionData?.status]);

  const computeClickAttempt = (event: ReactMouseEvent<HTMLButtonElement>): ClickAttempt | null => {
    if (!scene) {
      return null;
    }

    const sourceWidth = scene.width ?? naturalDimensions?.width;
    const sourceHeight = scene.height ?? naturalDimensions?.height;
    if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
      return null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
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
      return null;
    }

    const actualX = clickXFromAnchor * (sourceWidth / renderedWidth);
    const actualY = clickYFromAnchor * (sourceHeight / renderedHeight);
    const normalizedX = actualX / sourceWidth;
    const normalizedY = actualY / sourceHeight;

    return {
      actualX,
      actualY,
      normalizedX,
      normalizedY,
    };
  };

  const handleSceneClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!scene || isSessionNotFound || isGameFinished || guessMutation.isPending) {
      return;
    }

    const clickAttempt = computeClickAttempt(event);
    if (!clickAttempt) {
      setMenuState(null);
      return;
    }

    setLastAttempt(clickAttempt);
    setMenuState({
      ...clickAttempt,
      sceneX: event.clientX - event.currentTarget.getBoundingClientRect().left,
      sceneY: event.clientY - event.currentTarget.getBoundingClientRect().top,
    });
  };

  const handleCharacterSelection = (characterId: number) => {
    if (!menuState || guessMutation.isPending) {
      return;
    }

    setMenuState(null);
    guessMutation.mutate({
      sessionId,
      characterId,
      xNorm: menuState.normalizedX,
      yNorm: menuState.normalizedY,
    });
  };

  const elapsedMs =
    sessionData?.status === "FINISHED"
      ? (sessionData.elapsedMs ??
        (sessionData.endedAt ? sessionData.endedAt.getTime() - sessionData.startedAt.getTime() : 0))
      : sessionData?.startedAt
        ? nowMs - sessionData.startedAt.getTime()
        : 0;

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
            {isSessionNotFound ? null : sessionQuery.isPending ? (
              <li className="text-muted-foreground text-sm">Loading scene targets...</li>
            ) : sceneCharactersWithAssets.length ? (
              sceneCharactersWithAssets.map((character) => {
                const isFound = foundCharacterIds.has(character.id);

                return (
                  <li
                    key={character.id}
                    className={`rounded-md border p-2 ${isFound ? "border-green-500/50 bg-green-500/10" : "bg-muted/30"}`}
                  >
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
                    <p
                      className={`mt-2 text-center text-sm font-medium ${isFound ? "text-green-500" : ""}`}
                    >
                      {character.name}
                    </p>
                  </li>
                );
              })
            ) : (
              <li className="text-muted-foreground text-sm">
                No characters configured for this scene.
              </li>
            )}
          </ul>
        </aside>

        <div ref={rightColumnRef} className="space-y-3">
          <div className="bg-card text-card-foreground border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>
              Elapsed: <span className="font-mono">{formatElapsedMs(elapsedMs)}</span>
            </span>
            <span>
              Attempts: <span className="font-mono">{sessionData?.attempts ?? 0}</span>
            </span>
          </div>

          <div className="relative">
            <button
              ref={sceneButtonRef}
              type="button"
              onClick={handleSceneClick}
              className="bg-muted relative block h-[clamp(380px,68vh,860px)] w-full min-w-0 overflow-hidden rounded-lg border text-left"
              disabled={
                !sceneAsset || sessionQuery.isPending || isSessionNotFound || isGameFinished
              }
            >
              {isSessionNotFound ? (
                <div className="text-muted-foreground flex h-full items-center justify-center text-base font-medium">
                  Session not found
                </div>
              ) : sceneAsset ? (
                <img
                  src={sceneAsset.imageUrl}
                  alt={scene?.name ?? sceneAsset.name}
                  className={`h-full w-full object-contain ${isGameFinished ? "opacity-35" : ""}`}
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

            {!isSessionNotFound && renderedSceneBox
              ? sceneCharactersWithAssets
                  .filter((character) => character.found)
                  .map((character) => {
                    const left =
                      renderedSceneBox.offsetX +
                      character.targetXNorm * renderedSceneBox.renderedWidth;
                    const top =
                      renderedSceneBox.offsetY +
                      character.targetYNorm * renderedSceneBox.renderedHeight;

                    return (
                      <div
                        key={`found-marker-${character.id}`}
                        className="pointer-events-none absolute z-10 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-green-500 bg-green-500/30 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
                        style={{
                          left: `${left}px`,
                          top: `${top}px`,
                        }}
                      />
                    );
                  })
              : null}

            {isGameFinished && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/55 p-4 text-center">
                <div className="bg-card text-card-foreground border-border w-full max-w-sm rounded-lg border p-4">
                  <p className="text-lg font-semibold">All characters found!</p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Time spent: <span className="font-mono">{formatElapsedMs(elapsedMs)}</span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Attempts: <span className="font-mono">{sessionData?.attempts ?? 0}</span>
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Redirecting to leaderboard in {redirectCountdown}s...
                  </p>
                </div>
              </div>
            )}

            {menuState && sceneCharactersWithAssets.length > 0 && (
              <div
                ref={menuRef}
                className="bg-popover text-popover-foreground border-border absolute z-20 min-w-44 rounded-md border p-1 shadow-md ring-1 ring-foreground/10"
                style={{
                  left: `${menuState.sceneX}px`,
                  top: `${menuState.sceneY + 8}px`,
                  transform: "translateX(-50%)",
                }}
              >
                <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                  Select character
                </p>
                {sceneCharactersWithAssets.map((character) => {
                  const isFound = foundCharacterIds.has(character.id);

                  return (
                    <button
                      key={character.id}
                      type="button"
                      className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleCharacterSelection(character.id)}
                      disabled={isFound || guessMutation.isPending}
                    >
                      <span className={isFound ? "text-green-500" : ""}>{character.name}</span>
                      {isFound && <span className="ml-auto text-xs text-green-500">Found</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {sessionQuery.isError && !isSessionNotFound && (
            <p className="text-destructive text-sm">Failed to load session details.</p>
          )}

          <p className="text-muted-foreground text-sm">
            Click the scene to select a character at that point.
          </p>

          {/* DEV-ONLY: remove this panel before committing production gameplay UI. */}
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
