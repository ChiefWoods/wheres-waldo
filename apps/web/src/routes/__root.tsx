import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Button } from "@workspace/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";

import { useTheme } from "@/components/theme-provider";
import { defaultSceneSlug } from "@/lib/scenes";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { setTheme, theme } = useTheme();
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
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
            className="text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
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
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl p-4">
        <Outlet />
      </main>
      <Toaster theme={isDark ? "dark" : "light"} richColors closeButton />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}
