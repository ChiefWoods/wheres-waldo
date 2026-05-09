import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/play/$sessionId")({
  component: PlaySessionRoute,
});

function PlaySessionRoute() {
  const { sessionId } = Route.useParams();

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Game Session</h1>
      <p className="text-muted-foreground text-sm">
        Session ID: <span className="font-mono">{sessionId}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        The image board, marker selection, timer, and terminate-on-exit behavior will be implemented
        in the next steps.
      </p>
    </section>
  );
}
