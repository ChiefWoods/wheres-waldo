import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { endSession } from "@/lib/trpc-client";

const pendingSessionTerminationTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const Route = createFileRoute("/play/$sessionId")({
  component: PlaySessionRoute,
});

function PlaySessionRoute() {
  const { sessionId } = Route.useParams();
  const hasTerminatedSessionRef = useRef(false);

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
      }, 150);

      pendingSessionTerminationTimers.set(sessionId, timer);
    };

    const handlePageHide = () => {
      terminateSession();
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      scheduleTerminateSession();
    };
  }, [sessionId]);

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Game Session</h1>
      <p className="text-muted-foreground text-sm">
        Session ID: <span className="font-mono">{sessionId}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        Leave this route and the active session will be terminated immediately.
      </p>
    </section>
  );
}
