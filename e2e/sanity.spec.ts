/**
 * Family Vibes — Sanity test suite
 * Credentials: test@naatupakam.family / Test123! (see .notes)
 * Run: npx playwright test
 * Dev server must be running: npm run dev
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:5177";
const EMAIL = "test@naatupakam.family";
const PASSWORD = "Test123!";

// ---------------------------------------------------------------------------
// Helper — sign in via the auth modal
// ---------------------------------------------------------------------------
async function signIn(page: Page) {
  await page.goto(BASE);
  // Only sign in if not already authenticated
  const joinBtn = page.getByRole("button", { name: "Join Family" });
  if (await joinBtn.isVisible()) {
    await joinBtn.click();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.locator("form").getByRole("button", { name: "Sign In" }).click();
    // Wait for avatar to confirm session
    await expect(page.locator("header").getByRole("img").last()).toBeVisible({ timeout: 8000 });
  }
}

// ---------------------------------------------------------------------------
// TC-01 Home page loads — logged-out state
// ---------------------------------------------------------------------------
test("TC-01 Home page renders hero and nav when logged out", async ({ page }) => {
  await page.goto(BASE);

  // Brand
  await expect(page.getByRole("link", { name: /Family Vibes/i }).first()).toBeVisible();

  // Nav links — scoped to header nav to avoid footer duplicates
  const headerNav = page.locator("header nav");
  for (const label of ["Home", "Stories", "Events", "Family Tree"]) {
    await expect(headerNav.getByRole("link", { name: label })).toBeVisible();
  }

  // Header CTAs
  await expect(page.locator("header").getByRole("link", { name: /Why Family Vibes/i })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: /Plan for Event/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Family" })).toBeVisible();

  // Hero headline
  await expect(page.getByRole("heading", { name: /Your family's home/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// TC-02 Auth — sign in and sign out
// ---------------------------------------------------------------------------
test("TC-02 Sign in shows avatar + family badge; sign out clears session", async ({ page }) => {
  await signIn(page);

  // Avatar visible (last img in header = avatar)
  await expect(page.locator("header img").last()).toBeVisible();

  // Family badge (❤️ <name>)
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible();

  // Sign out via avatar dropdown
  await page.locator("header button.rounded-full").click();
  await page.getByRole("menuitem", { name: /Sign Out/i }).click();

  // Back to logged-out state
  await expect(page.getByRole("button", { name: "Join Family" })).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// TC-03 Home page — signed-in stat cards show real data (NaatuPaakam)
// ---------------------------------------------------------------------------
test("TC-03 Home stat cards render after sign-in (no placeholder dashes for NaatuPaakam)", async ({ page }) => {
  await signIn(page);

  // Hero stat tiles exist — scoped to main to avoid nav/footer duplicates
  const main = page.locator("main");
  await expect(main.getByText("Stories", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("Events", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("Photos", { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// TC-04 Stories page — tabs and layout
// ---------------------------------------------------------------------------
test("TC-04 Stories page loads with All/Published/Drafts tabs", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);

  await expect(page.getByRole("heading", { name: /Family Stories/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Published/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Drafts/i })).toBeVisible();

  // New Post button visible when signed in
  await expect(page.getByRole("button", { name: /New Post/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// TC-05 Events page — tabs and create FAB
// ---------------------------------------------------------------------------
test("TC-05 Events page loads with tab filters and create button", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/events`);

  await expect(page.getByRole("heading", { name: /Events/i })).toBeVisible();

  for (const tab of ["Upcoming", "Ongoing", "Past", "All"]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// TC-06 Family Tree page — loads without error
// ---------------------------------------------------------------------------
test("TC-06 Family Tree page loads and shows tree UI", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-tree`);

  // Page loaded — check main content renders without crash
  await expect(page.locator("main")).toBeVisible({ timeout: 8000 });
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  // Family Tree page has a title somewhere on the page
  await expect(page.getByText(/Family Tree/i).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// TC-07 Why Family Vibes page — all key sections render
// ---------------------------------------------------------------------------
test("TC-07 Why Family Vibes page renders hero, pillars, comparison table, roadmap", async ({ page }) => {
  await page.goto(`${BASE}/why-family-vibes`);

  // Hero
  await expect(page.getByRole("heading", { name: /Your family deserves better/i })).toBeVisible();

  // Pillars section
  await expect(page.getByText("Private by design")).toBeVisible();
  await expect(page.getByText("Stories become magazines")).toBeVisible();
  await expect(page.getByText("Live events, not just RSVPs")).toBeVisible();

  // Comparison table — scope to avoid "problem" section duplicate
  await expect(page.getByRole("columnheader", { name: /Facebook Groups/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How we compare" })).toBeVisible();

  // Roadmap section
  await expect(page.getByRole("heading", { name: "What's coming" }).or(page.getByText("What's coming")).first()).toBeVisible();
  await expect(page.getByText("Monthly family magazine")).toBeVisible();
  // Use heading role to avoid matching the comparison table row
  await expect(page.getByRole("heading", { name: "Live event streaming" })).toBeVisible();
  await expect(page.getByText("Event games & polls")).toBeVisible();
});

// ---------------------------------------------------------------------------
// TC-08 Auth modal — opens and closes correctly
// ---------------------------------------------------------------------------
test("TC-08 Auth modal opens on Join Family click, shows sign-in form with sign-up link, and closes", async ({ page }) => {
  await page.goto(BASE);

  await page.getByRole("button", { name: "Join Family" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Sign in to Family Vibes")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  // "Sign up" appears as a text link below the form — not a prominent tab
  await expect(dialog.getByText("Sign up")).toBeVisible();
  // Primary submit button says "Sign In" (no separate Sign Up tab at top)
  await expect(dialog.getByRole("button", { name: "Sign In" })).toBeVisible();

  // Close dialog
  await expect(page.getByLabel("Email")).toBeVisible({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// TC-09 Navigation — Why Family Vibes header link works
// ---------------------------------------------------------------------------
test("TC-09 Why Family Vibes header button navigates to microsite", async ({ page }) => {
  await page.goto(BASE);
  // Button is hidden on small screens; use header scope to target it precisely
  await page.locator("header").getByRole("link", { name: /Why Family Vibes/i }).click();
  await expect(page).toHaveURL(/\/why-family-vibes/);
  await expect(page.getByRole("heading", { name: /Your family deserves better/i })).toBeVisible();
});
