import { expect, test } from "@playwright/test";

test("user can start a new game session from home", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Choose a Scene" })).toBeVisible();

  const firstSceneCard = page
    .locator("button")
    .filter({ has: page.locator("img[alt='Beach']") })
    .first();

  await expect(firstSceneCard).toBeEnabled();
  await firstSceneCard.click();

  await expect(page).toHaveURL(/\/play\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Game Session" })).toBeVisible();
  await expect(page.getByText("Find These Characters")).toBeVisible();
});

test("leaderboard scene tab and page size are reflected in URL search params", async ({ page }) => {
  await page.goto("/leaderboard?scene=beach&page=1&pageSize=10");

  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();

  await page.getByRole("tab", { name: "Deep Sea Divers" }).click();
  await expect(page).toHaveURL(/scene=deep_sea_divers/);
  await expect(page).toHaveURL(/page=1/);

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "25" }).click();

  await expect(page).toHaveURL(/pageSize=25/);
  await expect(page).toHaveURL(/page=1/);
});
