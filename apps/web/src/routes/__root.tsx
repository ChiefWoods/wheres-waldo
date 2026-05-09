import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="border-border border-b">
        <nav className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 text-sm">
          <Link to="/" className="font-medium">
            Where&apos;s Waldo
          </Link>
          <Link
            to="/leaderboard"
            search={{
              scene: undefined,
              page: 1,
              pageSize: 20,
            }}
            className="[&.active]:text-foreground text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "active" }}
          >
            Leaderboard
          </Link>
          <span className="text-muted-foreground ml-auto hidden font-mono text-xs sm:inline">
            {location.pathname}
          </span>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl p-4">
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}
