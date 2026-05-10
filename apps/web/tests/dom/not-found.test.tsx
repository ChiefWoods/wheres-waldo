import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

const backSpy = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");

  return {
    ...actual,
    useRouter: () => ({
      history: {
        back: backSpy,
      },
    }),
  };
});

import { NotFoundPage } from "../../src/components/not-found";

beforeEach(() => {
  backSpy.mockReset();
});

test("renders not found message and navigates back when button is clicked", async () => {
  const user = userEvent.setup();

  render(<NotFoundPage />);

  expect(screen.getByText("Page not found.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /go back/i }));

  expect(backSpy).toHaveBeenCalledTimes(1);
});
