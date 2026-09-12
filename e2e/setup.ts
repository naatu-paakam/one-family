/**
 * Playwright global setup — authenticates once and saves session state.
 *
 * This runs before all test projects (see playwright.config.ts).
 * All tests that use storageState load from .playwright/auth.json instead of
 * calling signIn() at the start of every test — eliminating the auth loading
 * race that caused "flakiness from auth/family loading patterns".
 *
 * ROOT CAUSE of the flakiness (documented here for future reference):
 *   - page.goto() in Playwright triggers a full SPA reload
 *   - After reload, Supabase restores session from localStorage asynchronously
 *   - FamilyContext also loads family data asynchronously after session loads
 *   - Tests checking for content that depends on BOTH session AND family data
 *     (e.g., "❤️ FamilyName" badge, "Family Settings" page heading) would
 *     sometimes find these before data was ready → "element not found" flakiness
 *
 * SOLUTION: storageState persists the full browser localStorage (including
 *   Supabase auth tokens) into .playwright/auth.json. On test start, Playwright
 *   loads this state before the first navigation, so the SPA sees an immediately
 *   valid session and Supabase doesn't need the async restore cycle.
 *
 * WHAT STILL NEEDS signIn() IN TESTS:
 *   - Tests that explicitly test the logged-out state (TC-NAV-01, TC-HOME-01b, etc.)
 *   - Tests in auth.spec.ts that test the sign-in/sign-up flow itself
 *   - The storageState means "start with this user signed in" — tests that
 *     signOut() and then signIn() still need to call signIn() after the signOut.
 */

import { test as setup, expect } from "@playwright/test";
const AUTH_FILE = ".playwright/auth.json";

const EMAIL    = "test@naatupakam.family";
const PASSWORD = "Test123!"; // safe in setup — not a production secret, see .notes

setup("authenticate test user and save session", async ({ page }) => {
  await page.goto("http://localhost:5177");

  // Open auth modal
  const joinBtn = page.getByRole("button", { name: "Join Family" });
  if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await joinBtn.click();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.locator("form").getByRole("button", { name: "Sign In" }).click();
  }

  // Wait for auth + family context to fully load (avatar + family badge)
  await expect(page.locator("header button.rounded-full")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });

  // Switch active family to the Test Family (all seed data lives there)
  // This keeps tests isolated from real production families (NaatuPaakam etc.)
  const TEST_FAMILY_ID = "00000000-0000-0000-test-000000000001";
  await page.evaluate((id) => {
    localStorage.setItem("activeFamilyId", id);
  }, TEST_FAMILY_ID);
  // Reload so FamilyContext picks up the new active family before saving state
  await page.reload();
  await expect(page.locator("header").getByText(/Test Family A/)).toBeVisible({ timeout: 10000 });

  // Save the full browser state (localStorage, cookies, sessionStorage)
  // All tests will start with NaatuPaakam as active family and a valid session
  await page.context().storageState({ path: AUTH_FILE });
});
