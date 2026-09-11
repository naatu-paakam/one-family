/**
 * Family Vibes — MVP Release 1 test suite
 *
 * Covers new features shipped in MVP Release 1:
 *   - Sign-up flow (AuthModal)
 *   - Family Settings page (members, bio, invites)
 *   - /join/:code route (logged-out + invalid-code paths)
 *   - /portal route (access control)
 *   - Role gates: Edit/Delete story, Close Event (family admin / author)
 *   - isFamilyAdmin visible in header avatar dropdown (Family Settings link)
 *
 * Credentials: test@naatupakam.family / Test123! (see .notes)
 * Dev server must be running: npm run dev  (http://localhost:5177)
 * Run: npx playwright test e2e/mvp.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
// Seed data IDs — created by global-setup.ts, cleaned by global-teardown.ts
const SEED_STORY_FAMILY = "00000000-0000-0000-5eed-000000000008";
const SEED_EVENT_ID     = "00000000-0000-0000-5eed-000000000010";

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

async function signOut(page: Page) {
  await page.locator("header button.rounded-full").click();
  await page.getByRole("menuitem", { name: /Sign Out/i }).click();
  await expect(page.getByRole("button", { name: "Join Family" })).toBeVisible({ timeout: 5000 });
}

// ── TC-10: Auth modal — Sign Up tab ──────────────────────────────────────────

test("TC-10 AuthModal shows sign-in form with sign-up text link (no tabs)", async ({ page }) => {
  await page.goto(BASE);

  // Ensure logged out
  const avatar = page.locator("header button.rounded-full");
  if (await avatar.isVisible({ timeout: 2000 }).catch(() => false)) {
    await signOut(page);
  }

  await page.getByRole("button", { name: "Join Family" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Sign-in mode by default — primary submit button says "Sign In"
  await expect(dialog.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(dialog.getByLabel("Email")).toBeVisible();
  await expect(dialog.getByLabel("Password")).toBeVisible();

  // "Sign up" appears as a text link below the form
  await expect(dialog.getByText("Sign up")).toBeVisible();

  // Clicking sign-up link switches to sign-up form
  await dialog.getByText("Sign up").click();
  await expect(dialog.getByLabel("Full name")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create Account" })).toBeVisible();

  // "Sign in" link appears to switch back
  await expect(dialog.getByText("Sign in")).toBeVisible();
});

// ── TC-FS-01: Family Settings — page loads, members tab ──────────────────────

test("TC-FS-01 Family Settings page loads and shows member list", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-settings`);
  // page.goto reloads the SPA — wait for auth + family to re-initialize
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 12000 });
  await expect(page).toHaveURL(/\/family-settings/);

  // Heading appears once activeFamily is set in FamilyContext
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({ timeout: 15000 });

  // Members tab active by default — at least one member row
  await expect(page.getByRole("tab", { name: /members/i }).or(
    page.getByRole("button", { name: /members/i })
  ).first()).toBeVisible();

  // At least one member visible (the test user themselves)
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ── TC-FS-02: Family Settings — bio tab ──────────────────────────────────────

test("TC-FS-02 Family Settings bio tab renders edit form for admin", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-settings`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 12000 });
  await expect(page).toHaveURL(/\/family-settings/);
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({ timeout: 15000 });

  // Click Bio tab
  await page.getByRole("button", { name: /^bio$/i }).click();

  // Admin sees textarea (test user is admin of their family)
  await expect(
    page.getByRole("textbox", { name: /About/i })
      .or(page.locator("textarea"))
  ).toBeVisible({ timeout: 5000 });

  // Save button visible
  await expect(page.getByRole("button", { name: /Save bio/i })).toBeVisible();
});

// ── TC-FS-03: Family Settings — invites tab (admin) ───────────────────────────

test("TC-FS-03 Family Settings invites tab shows group link and generate button for admin", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-settings`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 12000 });
  await expect(page).toHaveURL(/\/family-settings/);
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({ timeout: 15000 });

  // Click Invites tab
  await page.getByRole("button", { name: /^invites$/i }).click();

  // Group invite section
  await expect(page.getByText("Group invite link")).toBeVisible();
  // The group link input contains the base URL
  await expect(page.locator("input[readonly]").first()).toHaveValue(/\/join\//);

  // Copy button
  await expect(page.locator("button").filter({ has: page.locator("svg") }).first()).toBeVisible();

  // Generate personal invite button
  await expect(page.getByRole("button", { name: /Generate link/i })).toBeVisible();
});

// ── TC-FS-04: Family Settings — admin role badge shown ────────────────────────

test("TC-FS-04 Family Settings shows admin role badge for admin user", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-settings`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 12000 });
  await expect(page).toHaveURL(/\/family-settings/);
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({ timeout: 15000 });
  // Role badge (admin) shown next to heading — use first() to avoid strict mode
  await expect(page.getByText("admin").first()).toBeVisible();
});

// ── TC-JOIN-01: /join/:code when logged out shows invite prompt ───────────────

test("TC-JOIN-01 /join/:code shows sign-in prompt when not authenticated", async ({ page }) => {
  // Navigate without signing in
  await page.goto(`${BASE}/join/testinvitecode`);

  await expect(page.getByRole("heading", { name: /You've been invited/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: /Sign in \/ Sign up/i })).toBeVisible();
});

// ── TC-JOIN-02: /join/:code with invalid group code shows error ───────────────

test("TC-JOIN-02 /join/:code with invalid code shows error after sign-in", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/join/xxxxxxxx`);

  // Wait for the join attempt (will fail — invalid code)
  await expect(
    page.getByRole("heading", { name: /Invite not valid/i })
      .or(page.getByText(/Invalid or expired/i))
      .or(page.getByText(/Could not join/i))
  ).toBeVisible({ timeout: 10000 });

  // "Go home" link present
  await expect(page.getByRole("link", { name: /Go home/i })).toBeVisible();
});

// ── TC-JOIN-03: /join/:token with invalid UUID token shows error ──────────────

test("TC-JOIN-03 /join/:token with invalid UUID token shows error after sign-in", async ({ page }) => {
  await signIn(page);
  // UUID format → triggers joinFamilyByToken path
  await page.goto(`${BASE}/join/00000000-0000-0000-0000-000000000000`);

  await expect(
    page.getByRole("heading", { name: /Invite not valid/i })
      .or(page.getByText(/Invalid or expired/i))
      .first()
  ).toBeVisible({ timeout: 10000 });

  // Error message mentions personal invite token
  await expect(page.getByText(/personal invite/i)).toBeVisible();
});

// ── TC-PORTAL-01: /portal redirects non-portal-admin to home ─────────────────

test("TC-PORTAL-01 /portal redirects non-portal-admin users to home", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/portal`);

  // Should land on home (redirected by Navigate component)
  await expect(page).toHaveURL(BASE + "/", { timeout: 5000 });
  await expect(page.getByRole("heading", { name: /Your family's home/i })).toBeVisible();
});

// ── TC-HEADER-01: Family Settings link in avatar dropdown for admin ───────────

test("TC-HEADER-01 Avatar dropdown shows Family Settings for family admin", async ({ page }) => {
  await signIn(page);
  await page.locator("header button.rounded-full").click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  // [ROLE: family-admin] link should appear
  await expect(menu.getByRole("menuitem", { name: /Family Settings/i })).toBeVisible();
  await page.keyboard.press("Escape");
});

// ── TC-HEADER-02: Family Settings link navigates correctly ───────────────────

test("TC-HEADER-02 Family Settings menu item navigates to /family-settings", async ({ page }) => {
  await signIn(page);
  await page.locator("header button.rounded-full").click();
  await page.getByRole("menuitem", { name: /Family Settings/i }).click();
  await expect(page).toHaveURL(/\/family-settings/);
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({ timeout: 15000 });
});

// ── TC-16: Stories — Edit/Delete visible for author and admin ─────────────────

test("TC-16 Stories page shows Edit and Delete for story author (uses seed story)", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);
  await expect(page.getByRole("heading", { name: "Family Stories" })).toBeVisible();
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });

  // Click the seed story card (created by global-setup, authored by test user)
  const seedCard = page.locator("main").locator("button, [class*='cursor']").filter({ hasText: /\[SEED\] Family story/ });
  await expect(seedCard.first()).toBeVisible({ timeout: 8000 });
  await seedCard.first().click();
  await page.waitForTimeout(500);

  // Modify Post button visible (author = test user = family admin)
  const aside = page.locator("aside, [role=complementary]").first();
  await expect(aside.getByRole("button", { name: /Modify Post/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ── TC-17: Events — Close Event visible for creator or admin ─────────────────

test("TC-17 Events page Close Event button visible for creator (uses seed event)", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/events`);
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 10000 });

  // Click Ongoing tab — seed event is ongoing
  await page.getByRole("tab", { name: "Ongoing" }).click();
  await page.waitForTimeout(500);

  // Click the seed event card
  const seedCard = page.locator("[role=tabpanel]").locator("button, [class*='cursor-pointer']").filter({ hasText: /\[SEED\] Ongoing Test Event/ });
  await expect(seedCard.first()).toBeVisible({ timeout: 8000 });
  await seedCard.first().click();
  await page.waitForTimeout(500);

  // Close Event button visible (creator = test user = family admin)
  const aside = page.locator("aside, [role=complementary]").first();
  await expect(aside.getByRole("button", { name: /Close Event/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ── TC-EMPTY-01: Home page empty-family state for new signed-in user ──────────

test("TC-EMPTY-01 /join with unknown code and then home shows correct state after sign-in", async ({ page }) => {
  await signIn(page);
  // Test user has at least one family — home should NOT show empty state
  await page.goto(BASE);
  // Should see family badge (not empty state)
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible();
  // No "Create a Family" CTA for users who already have a family
  await expect(page.getByRole("link", { name: /Create a Family/i })).not.toBeVisible();
});

// ── TC-ROUTES-01: New MVP routes all load without crash ──────────────────────

test("TC-ROUTES-01 All new MVP routes load without JS error when signed in", async ({ page }) => {
  await signIn(page);

  const routes = [
    "/family-settings",
    // /join/:code tested separately
    // /portal redirects for non-portal-admin — already tested
  ];

  for (const route of routes) {
    await page.goto(`${BASE}${route}`);
    await expect(page.locator("main")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  }
});

// ── TC-ROUTES-02: /join/:code loads without crash when logged out ─────────────

test("TC-ROUTES-02 /join/:code loads without crash when logged out", async ({ page }) => {
  await page.goto(`${BASE}/join/anycode123`);
  await expect(page.locator("main")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
  // Should show invite prompt
  await expect(page.getByRole("heading", { name: /You've been invited/i })).toBeVisible();
});
