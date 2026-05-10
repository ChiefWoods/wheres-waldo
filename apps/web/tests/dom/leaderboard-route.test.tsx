import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "./app-test-utils";

const mocks = vi.hoisted(() => ({
  listScenes: vi.fn(),
  startSession: vi.fn(),
  getSceneBySlug: vi.fn(),
  submitGuess: vi.fn(),
  endSession: vi.fn(),
  getSession: vi.fn(),
  getLeaderboard: vi.fn(),
  endSessionOnPageExit: vi.fn(),
}));

vi.mock("../../src/lib/trpc-client", () => ({
  listScenes: mocks.listScenes,
  startSession: mocks.startSession,
  getSceneBySlug: mocks.getSceneBySlug,
  submitGuess: mocks.submitGuess,
  endSession: mocks.endSession,
  getSession: mocks.getSession,
  getLeaderboard: mocks.getLeaderboard,
  endSessionOnPageExit: mocks.endSessionOnPageExit,
}));

describe("leaderboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listScenes.mockResolvedValue([
      {
        id: 11,
        slug: "beach",
        name: "Beach",
        width: 2560,
        height: 1644,
      },
      {
        id: 22,
        slug: "deep_sea_divers",
        name: "Deep Sea Divers",
        width: 2560,
        height: 1620,
      },
    ]);
    mocks.getLeaderboard.mockResolvedValue({
      page: 1,
      pageSize: 10,
      total: 0,
      rows: [],
    });
  });

  test("coerces invalid page/pageSize search params to defaults", async () => {
    renderApp("/leaderboard?scene=beach&page=0&pageSize=999");

    await screen.findByRole("heading", { name: "Leaderboard" });

    await waitFor(() => {
      expect(mocks.getLeaderboard).toHaveBeenCalledWith(11, 1, 10);
    });

    expect(screen.getByText(/Page 1 of 1/i)).toBeInTheDocument();
  });

  test("syncs tab and pagination controls back into URL search params", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/leaderboard?scene=beach&page=3&pageSize=10");

    await screen.findByRole("heading", { name: "Leaderboard" });
    await waitFor(() => {
      expect(mocks.getLeaderboard).toHaveBeenCalledWith(11, 3, 10);
    });

    await user.click(screen.getByRole("tab", { name: "Deep Sea Divers" }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        scene: "deep_sea_divers",
        page: 1,
        pageSize: 10,
      });
    });
    await waitFor(() => {
      expect(mocks.getLeaderboard).toHaveBeenCalledWith(22, 1, 10);
    });

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "25" }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        scene: "deep_sea_divers",
        page: 1,
        pageSize: 25,
      });
    });
    await waitFor(() => {
      expect(mocks.getLeaderboard).toHaveBeenCalledWith(22, 1, 25);
    });
  });
});
