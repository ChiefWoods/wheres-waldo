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

describe("home route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listScenes.mockResolvedValue([
      {
        id: 101,
        slug: "beach",
        name: "Beach",
        width: 2560,
        height: 1644,
      },
      {
        id: 202,
        slug: "deep_sea_divers",
        name: "Deep Sea Divers",
        width: 2560,
        height: 1620,
      },
    ]);
    mocks.startSession.mockResolvedValue({
      sessionId: "session-123",
      sceneId: 101,
      status: "STARTED",
      startedAt: new Date("2026-05-10T00:00:00.000Z"),
    });
    mocks.getSession.mockResolvedValue({
      sessionId: "session-123",
      status: "STARTED",
      attempts: 0,
      startedAt: new Date("2026-05-10T00:00:00.000Z"),
      endedAt: null,
      elapsedMs: null,
      foundCount: 0,
      totalTargets: 0,
      scene: {
        id: 101,
        slug: "beach",
        name: "Beach",
        width: 2560,
        height: 1644,
        characters: [],
      },
    });
  });

  test("starts a session and navigates to /play/$sessionId", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/");

    await screen.findByRole("heading", { name: "Choose a Scene" });
    await user.click(screen.getByRole("button", { name: /beach/i }));

    await waitFor(() => {
      expect(mocks.startSession).toHaveBeenCalled();
    });
    expect(mocks.startSession.mock.calls[0]?.[0]).toBe(101);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/play/session-123");
    });
  });

  test("shows mismatch error when local scene is missing from server scene list", async () => {
    const user = userEvent.setup();
    mocks.listScenes.mockResolvedValue([
      {
        id: 202,
        slug: "deep_sea_divers",
        name: "Deep Sea Divers",
        width: 2560,
        height: 1620,
      },
    ]);

    renderApp("/");

    await screen.findByRole("heading", { name: "Choose a Scene" });
    await user.click(screen.getByRole("button", { name: /beach/i }));

    expect(mocks.startSession).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Scene "beach" is not configured on the server.'),
    ).toBeInTheDocument();
  });

  test("shows start-session error when API call fails", async () => {
    const user = userEvent.setup();
    mocks.startSession.mockRejectedValueOnce(new Error("failed"));

    renderApp("/");

    await screen.findByRole("heading", { name: "Choose a Scene" });
    await user.click(screen.getByRole("button", { name: /beach/i }));

    expect(
      await screen.findByText("Failed to start session. Please try again."),
    ).toBeInTheDocument();
  });
});
