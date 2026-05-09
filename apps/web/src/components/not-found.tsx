import { useRouter } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";

export function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-3 p-6 text-sm">
      <p>Page not found.</p>
      <Button type="button" variant="secondary" size="sm" onClick={() => router.history.back()}>
        Go back
      </Button>
    </div>
  );
}
