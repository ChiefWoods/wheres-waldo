import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

function createStartedSession() {
  return {
    sessionId: "session-1",
    status: "STARTED" as const,
    attempts: 1,
    startedAt: new Date("2026-05-10T00:00:00.000Z"),
    endedAt: null,
    elapsedMs: null,
    foundCount: 1,
    totalTargets: 2,
    scene: {
      id: 1,
      slug: "beach",
      name: "Beach",
      width: 1000,
      height: 500,
      characters: [
        {
          id: 1,
          name: "Waldo",
          targetXNorm: 0.5,
          targetYNorm: 0.5,
          found: true,
        },
        {
          id: 2,
          name: "Wenda",
          targetXNorm: 0.25,
          targetYNorm: 0.25,
          found: false,
        },
      ],
    },
  };
}

function createFinishedSession() {
  return {
    ...createStartedSession(),
    status: "FINISHED" as const,
    attempts: 4,
    endedAt: new Date("2026-05-10T00:05:00.000Z"),
    elapsedMs: 5 * 60 * 1000,
    foundCount: 2,
    totalTargets: 2,
    scene: {
      ...createStartedSession().scene,
      characters: createStartedSession().scene.characters.map((character) => ({
        ...character,
        found: true,
      })),
    },
  };
}

function mockSceneButtonGeometry(button: HTMLButtonElement) {
  Object.defineProperty(button, "clientWidth", {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(button, "clientHeight", {
    configurable: true,
    value: 500,
  });
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 500,
    width: 1000,
    height: 500,
    toJSON() {
      return {};
    },
  } as DOMRect);
}

describe("play route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(createStartedSession());
    mocks.submitGuess.mockResolvedValue({
      isCorrect: true,
      alreadyFound: false,
      foundCount: 2,
      totalTargets: 2,
      status: "FINISHED",
      attempts: 2,
      elapsedMs: 1234,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("shows session-not-found state and disables gameplay action button", async () => {
    mocks.getSession.mockRejectedValueOnce({
      data: { code: "NOT_FOUND" },
    });

    renderApp("/play/missing-session");

    expect(await screen.findByText("Session not found")).toBeInTheDocument();

    const sceneButton = screen.getByRole("button", { name: /session not found/i });
    expect(sceneButton).toBeDisabled();
  });

  test("opens character menu, marks found characters as disabled, and closes on escape/outside click", async () => {
    const user = userEvent.setup();

    renderApp("/play/session-1");

    await screen.findByRole("heading", { name: "Game Session" });

    const sceneButton = screen.getByRole("button", { name: /beach/i }) as HTMLButtonElement;
    mockSceneButtonGeometry(sceneButton);

    fireEvent.click(sceneButton, { clientX: 500, clientY: 250 });

    expect(await screen.findByText("Select character")).toBeInTheDocument();

    const menu = screen.getByText("Select character").closest("div");
    expect(menu).toBeTruthy();

    const waldoOption = within(menu!).getByRole("button", { name: /waldo/i });
    const wendaOption = within(menu!).getByRole("button", { name: /wenda/i });
    expect(waldoOption).toBeDisabled();
    expect(wendaOption).toBeEnabled();
    expect(within(menu!).getByText("Found")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByText("Select character")).not.toBeInTheDocument();
    });

    fireEvent.click(sceneButton, { clientX: 500, clientY: 250 });
    expect(await screen.findByText("Select character")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText("Select character")).not.toBeInTheDocument();
    });
  });

  test("counts down and redirects to leaderboard after finished state", async () => {
    mocks.getSession.mockResolvedValue(createFinishedSession());

    const { router } = renderApp("/play/session-1");

    expect(await screen.findByText("All characters found!")).toBeInTheDocument();
    expect(screen.getByText("Redirecting to leaderboard in 3s...")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText("Redirecting to leaderboard in 2s...")).toBeInTheDocument();
      },
      { timeout: 1500 },
    );

    await waitFor(
      () => {
        expect(router.state.location.pathname).toBe("/leaderboard");
      },
      { timeout: 5000 },
    );

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        scene: "beach",
        page: 1,
        pageSize: 10,
      });
    });
  });
});
