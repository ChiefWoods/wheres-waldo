import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Button } from "@workspace/ui/components/button";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { defaultSceneSlug } from "@/lib/scenes";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const location = useRouterState({
    select: (state) => state.location,
  });
  const { setTheme, theme } = useTheme();
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);

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
              scene: defaultSceneSlug,
              page: 1,
              pageSize: 20,
            }}
            className="[&.active]:text-foreground text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "active" }}
          >
            Leaderboard
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label="Toggle color theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>
          <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
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
