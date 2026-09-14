/**
 * Family Vibes — Story Comments test suite
 *
 * Tests the comments_enabled flag, CommentThread on stories,
 * author toggle, post/delete comments, and regression of event comments.
 *
 * Requires: dev server at http://localhost:5177
 * Seed story: [SEED] Comments-enabled story (00000000-0000-0000-5eed-000000000011)
 * Run: npx playwright test e2e/story-comments.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { SEED_STORY_FAM, SEED_STORY_COMMENTS, SEED_EVENT_ID } from "./global-setup";

const BASE     = "http://localhost:5177";
const EMAIL    = "test@naatupakam.family";
const PASSWORD = "Test123!";

async function signIn(page: Page) {
  await page.goto(BASE);
  const joinBtn = page.getByRole("button", { name: "Join Family" });
  if (await joinBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await joinBtn.click();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.locator("form").getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("header button.rounded-full")).toBeVisible({ timeout: 8000 });
  }
}

async function selectStory(page: Page, titleFragment: string) {
  await page.goto(`${BASE}/stories`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });
  await page.getByText(titleFragment).first().click();
  await page.waitForURL(/\/stories\/.+/, { timeout: 8000 });
}

// ── Visibility gate — comments_enabled=false ──────────────────────────────────

test("TC-SCOM-01 Story with comments disabled shows no comment thread", async ({ page }) => {
  await signIn(page);
  await selectStory(page, "[SEED] Family story");
  // Comment form should NOT appear in the detail panel
  await expect(page.getByPlaceholder("Add a comment…")).not.toBeVisible({ timeout: 3000 });
});

// ── Comments-enabled story ────────────────────────────────────────────────────

test("TC-SCOM-02 Story with comments_enabled=true shows comment thread", async ({ page }) => {
  await signIn(page);
  await selectStory(page, "[SEED] Comments-enabled story");
  // The comment form input is the clearest indicator the thread rendered
  await expect(page.getByPlaceholder("Add a comment…")).toBeVisible({ timeout: 8000 });
});

test("TC-SCOM-03 Signed-out user sees no comment form on comments-enabled story", async ({ page }) => {
  // Navigate directly without signing in
  await page.goto(`${BASE}/stories/${SEED_STORY_COMMENTS}`);
  // Public story page — no comment form (only registered users)
  await expect(page.getByPlaceholder("Add a comment…")).not.toBeVisible({ timeout: 5000 });
});

// ── Author toggle ─────────────────────────────────────────────────────────────

test("TC-SCOM-04 Author can see Allow comments toggle in edit mode", async ({ page }) => {
  await signIn(page);
  await selectStory(page, "[SEED] Family story");

  // "Modify Post" opens the edit form (navigates to /stories?edit=<id>)
  await page.getByRole("button", { name: "Modify Post" }).click();
  await page.waitForURL(/\/stories(\?|$)/, { timeout: 8000 });
  await expect(page.getByText(/Allow comments/i)).toBeVisible({ timeout: 5000 });
});

test("TC-SCOM-05 Author toggles comments on and off — comment form appears and disappears", async ({ page }) => {
  await signIn(page);
  await selectStory(page, "[SEED] Family story");

  // Verify no comment form initially (story has comments disabled)
  await expect(page.getByPlaceholder("Add a comment…")).not.toBeVisible({ timeout: 3000 });

  // Enable comments — Modify Post navigates to /stories?edit=<id>
  await page.getByRole("button", { name: "Modify Post" }).click();
  await page.waitForURL(/\/stories(\?|$)/, { timeout: 8000 });
  const toggle = page.locator("input[type=checkbox]").last();
  await expect(toggle).toBeVisible({ timeout: 5000 });
  await toggle.check();
  await page.getByRole("button", { name: /^Save/ }).click();
  // Save navigates back to the story page
  await page.waitForURL(/\/stories\/.+/, { timeout: 8000 });

  // Comment form should now appear on the story page
  await expect(page.getByPlaceholder("Add a comment…")).toBeVisible({ timeout: 8000 });

  // Disable comments again
  await page.getByRole("button", { name: "Modify Post" }).click();
  await page.waitForURL(/\/stories(\?|$)/, { timeout: 8000 });
  await page.locator("input[type=checkbox]").last().uncheck();
  await page.getByRole("button", { name: /^Save/ }).click();
  await page.waitForURL(/\/stories\/.+/, { timeout: 8000 });

  // Comment form gone
  await expect(page.getByPlaceholder("Add a comment…")).not.toBeVisible({ timeout: 5000 });
});

// ── Post a comment ────────────────────────────────────────────────────────────

test("TC-SCOM-06 Authenticated user can post a comment on comments-enabled story", async ({ page }) => {
  await signIn(page);
  await selectStory(page, "[SEED] Comments-enabled story");

  const commentBox = page.getByPlaceholder("Add a comment…");
  await expect(commentBox).toBeVisible({ timeout: 8000 });

  const text = `TC-SCOM-06 test comment ${Date.now()}`;
  await commentBox.fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();

  // Comment appears in thread
  await expect(page.getByText(text)).toBeVisible({ timeout: 8000 });
});

test("TC-SCOM-07 Comment author can delete their own comment", async ({ page }) => {
  await signIn(page);
  await selectStory(page, "[SEED] Comments-enabled story");

  const text = `TC-SCOM-07 deletable ${Date.now()}`;
  const commentBox = page.getByPlaceholder("Add a comment\u2026");
  await expect(commentBox).toBeVisible({ timeout: 8000 });
  await commentBox.fill(text);
  // Register dialog handler BEFORE click so it's ready when confirm() fires
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Post", exact: true }).click();
  // Wait for comment bubble (not textarea) to appear
  await expect(page.locator(".rounded-lg.border.bg-background").filter({ hasText: text })).toBeVisible({ timeout: 8000 });

  // Delete — find the bubble's own Delete button
  const bubble = page.locator(".rounded-lg.border.bg-background").filter({ hasText: text });
  await bubble.getByText("Delete").click();
  await expect(bubble).not.toBeVisible({ timeout: 8000 });
});
test("TC-SCOM-08 Posted comment persists after reload + count badge appears", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });

  await page.getByText("[SEED] Comments-enabled story").first().click();
  await page.waitForURL(/\/stories\/.+/, { timeout: 8000 });

  const commentBox = page.getByPlaceholder("Add a comment\u2026");
  await expect(commentBox).toBeVisible({ timeout: 8000 });
  const commentText = "TC-SCOM-08 persist";
  await commentBox.fill(commentText);
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.locator(".rounded-lg.border.bg-background").filter({ hasText: commentText })).toBeVisible({ timeout: 8000 });

  // Reload — still on the story page — comment must persist
  await page.reload();
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".rounded-lg.border.bg-background").filter({ hasText: commentText })).toBeVisible({ timeout: 12000 });

  // Navigate back to list to check count badge on card
  await page.goto(`${BASE}/stories`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/\d+ comments?/).first()).toBeVisible({ timeout: 8000 });
});

// ── Regression — event comments still work ────────────────────────────────────

test("TC-SCOM-REG-01 Event comments thread still renders after CommentThread refactor", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/events`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });

  // Click the seed event card — navigates to /events/:id
  await page.getByText("[SEED] Ongoing Test Event").first().click();
  await page.waitForURL(/\/events\/.+/, { timeout: 8000 });

  // Comment thread heading and input visible on the event detail page
  await expect(page.getByRole("heading", { name: /Comments/i })).toBeVisible({ timeout: 8000 });
  await expect(page.getByPlaceholder("Add a comment…")).toBeVisible();
});

test("TC-SCOM-REG-02 Posting a comment on an event still works", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/events`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });

  await page.getByText("[SEED] Ongoing Test Event").first().click();
  await page.waitForURL(/\/events\/.+/, { timeout: 8000 });

  const text = `TC-SCOM-REG-02 event comment ${Date.now()}`;
  const commentBox = page.getByPlaceholder("Add a comment…");
  await expect(commentBox).toBeVisible({ timeout: 8000 });
  await commentBox.fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(text)).toBeVisible({ timeout: 8000 });

  // Clean up
  page.once("dialog", (d) => d.accept());
  await page.getByText("Delete").last().click();
});

// ── Regression — visibility labels ───────────────────────────────────────────

test("TC-SCOM-REG-03 Story visibility picker shows updated labels (Family not 'to Family')", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });

  // The + button has aria-label "New Post" — clicking opens the full-page create form
  await page.getByRole("button", { name: "New Post" }).first().click();
  await expect(page.getByText("Who can see this?")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Family").first()).toBeVisible();
  // Old label must not appear
  await expect(page.getByText("to Family")).not.toBeVisible();
});
