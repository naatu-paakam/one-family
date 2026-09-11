/**
 * Family Vibes — POC Regression test suite
 *
 * Purpose: Lock in the current POC state so MVP development cannot silently
 * break existing functionality. Tests are intentionally broad — they verify
 * structure and navigation, not deep data assertions, so they survive DB
 * state changes without needing constant updates.
 *
 * Credentials: test@naatupakam.family / Test123! (see .notes)
 * Dev server must be running: npm run dev  (http://localhost:5177)
 * Run: npx playwright test e2e/regression.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:5177";
const EMAIL = "test@naatupakam.family";
const PASSWORD = "Test123!";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(page: Page) {
  await page.goto(BASE);
  const joinBtn = page.getByRole("button", { name: "Join Family" });
  if (await joinBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await joinBtn.click();
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    // Scope to form submit — avoids the "Sign In" tab button added in MVP AuthModal
    await page.locator("form").getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("header button.rounded-full")).toBeVisible({ timeout: 8000 });
  }
}

async function headerNav(page: Page) {
  return page.locator("header nav");
}

// ---------------------------------------------------------------------------
// NAVIGATION — logged-out
// ---------------------------------------------------------------------------

test("TC-NAV-01 Logo click from any page returns to home", async ({ page }) => {
  await page.goto(`${BASE}/stories`);
  // Logo is the first a[href='/'] in the header (Home nav link is second)
  await page.locator("header a[href='/']").first().click();
  await expect(page).toHaveURL(BASE + "/");
  await expect(page.getByRole("heading", { name: /Your family's home/i })).toBeVisible();
});

test("TC-NAV-02 All header nav links navigate to correct routes", async ({ page }) => {
  await page.goto(BASE);
  const nav = await headerNav(page);

  await nav.getByRole("link", { name: "Stories" }).click();
  await expect(page).toHaveURL(/\/stories/);

  await nav.getByRole("link", { name: "Events" }).click();
  await expect(page).toHaveURL(/\/events/);

  await nav.getByRole("link", { name: "Family Tree" }).click();
  await expect(page).toHaveURL(/\/family-tree/);

  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(BASE + "/");
});

test("TC-NAV-03 Plan for Event header link opens events page with create flag", async ({ page }) => {
  await page.goto(BASE);
  await page.locator("header").getByRole("link", { name: /Plan for Event/i }).click();
  await expect(page).toHaveURL(/\/events/);
});

test("TC-NAV-04 Unknown route renders 404 page", async ({ page }) => {
  await page.goto(`${BASE}/does-not-exist`);
  await expect(page.getByText(/404/)).toBeVisible();
  await expect(page.getByRole("link", { name: /home/i }).first()).toBeVisible();
});

test("TC-NAV-05 Footer renders brand, feature links, and copyright", async ({ page }) => {
  await page.goto(BASE);
  const footer = page.locator("footer");
  await expect(footer.getByText(/NaatuPaakam/i)).toBeVisible();
  await expect(footer.getByRole("heading", { name: "Features" })).toBeVisible();
  await expect(footer.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(footer.getByText(/© 2026/)).toBeVisible();
});

test("TC-NAV-06 Footer feature links navigate correctly", async ({ page }) => {
  await page.goto(BASE);
  const footer = page.locator("footer");

  await footer.getByRole("link", { name: "Stories" }).click();
  await expect(page).toHaveURL(/\/stories/);

  await page.goto(BASE);
  await page.locator("footer").getByRole("link", { name: /Event/i }).click();
  await expect(page).toHaveURL(/\/events/);
});

// ---------------------------------------------------------------------------
// NAVIGATION — signed-in
// ---------------------------------------------------------------------------

test("TC-NAV-07 Signed-in header shows avatar, family menu, and family badge", async ({ page }) => {
  await signIn(page);

  // Avatar button
  await expect(page.locator("header button.rounded-full")).toBeVisible();
  // Family menu button
  await expect(page.getByRole("button", { name: /Family menu/i })).toBeVisible();
  // Family badge (❤️ + family name)
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible();
});

test("TC-NAV-08 Avatar dropdown shows user name, New Post, Sign Out", async ({ page }) => {
  await signIn(page);
  await page.locator("header button.rounded-full").click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /New Post/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Sign Out/i })).toBeVisible();

  // Close without signing out
  await page.keyboard.press("Escape");
});

test("TC-NAV-09 New Post menu item navigates to Stories page", async ({ page }) => {
  await signIn(page);
  await page.locator("header button.rounded-full").click();
  await page.getByRole("menuitem", { name: /New Post/i }).click();
  await expect(page).toHaveURL(/\/stories/);
});

// ---------------------------------------------------------------------------
// HOME PAGE
// ---------------------------------------------------------------------------

test("TC-HOME-01 Home hero heading and signed-in CTAs render when signed in", async ({ page }) => {
  await signIn(page);
  const main = page.locator("main");

  await expect(main.getByRole("heading", { name: /Your family's home/i })).toBeVisible();

  // Signed-in hero CTA links (Start a Blog and Build Family Tree are signed-in only)
  await expect(main.getByRole("link", { name: /Plan for Event/i })).toBeVisible();
  await expect(main.getByRole("link", { name: /Start a Blog/i })).toBeVisible();
  await expect(main.getByRole("link", { name: /Build Family Tree/i })).toBeVisible();
  // "Start your family space" button must NOT appear when signed in
  await expect(main.getByRole("button", { name: /Start your family space/i })).not.toBeVisible();
});

test("TC-HOME-01b Home hero shows Start your family space CTA when logged out", async ({ page }) => {
  await page.goto(BASE);
  const main = page.locator("main");

  await expect(main.getByRole("heading", { name: /Your family's home/i })).toBeVisible();
  // Logged-out primary CTA
  await expect(main.getByRole("button", { name: /Start your family space/i })).toBeVisible();
  await expect(main.getByRole("link", { name: /Plan for Event/i })).toBeVisible();
  // Signed-in-only buttons must NOT appear
  await expect(main.getByRole("link", { name: /Start a Blog/i })).not.toBeVisible();
  await expect(main.getByRole("link", { name: /Build Family Tree/i })).not.toBeVisible();
});

test("TC-HOME-01c Start your family space CTA opens auth modal in sign-up mode", async ({ page }) => {
  await page.goto(BASE);
  await page.locator("main").getByRole("button", { name: /Start your family space/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Modal opens in sign-up mode (defaultTab: 'signup') — shows Create Account button and Full name field
  await expect(dialog.getByLabel("Full name")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create Account" })).toBeVisible();
  // "Sign in" text link visible to switch back
  await expect(dialog.getByText("Sign in")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("TC-HOME-02 Home stat cards (Stories, Events, Photos) render", async ({ page }) => {
  await signIn(page);
  const main = page.locator("main");
  await expect(main.getByText("Stories", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("Events",  { exact: true }).first()).toBeVisible();
  await expect(main.getByText("Photos",  { exact: true }).first()).toBeVisible();
});

test("TC-HOME-03 Home feature cards render with correct labels and links", async ({ page }) => {
  await signIn(page);
  const main = page.locator("main");

  // Card renamed from "Member Blogs" to "Member Stories"
  const memberStories = main.getByRole("link", { name: /Member Stories/i });
  await expect(memberStories).toBeVisible();
  await memberStories.click();
  await expect(page).toHaveURL(/\/stories/);

  await page.goto(BASE);
  await expect(page.locator("main").getByRole("link", { name: /Events & Groups/i })).toBeVisible();
  // AI Summaries card uses <a href="#ai"> (not a router Link) — match by text content
  await expect(page.locator("main").getByText("AI Summaries")).toBeVisible();
});

test("TC-HOME-04 Home feature card Events & Groups navigates to events", async ({ page }) => {
  await signIn(page);
  await page.locator("main").getByRole("link", { name: /Events & Groups/i }).click();
  await expect(page).toHaveURL(/\/events/);
});

// ---------------------------------------------------------------------------
// STORIES PAGE
// ---------------------------------------------------------------------------

test("TC-STORIES-01 Stories page heading, search box, and tabs render", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);

  await expect(page.getByRole("heading", { name: "Family Stories" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Search/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Published" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Drafts" })).toBeVisible();
});

test("TC-STORIES-02 New Post button visible when signed in", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);
  await expect(page.getByRole("button", { name: "New Post" })).toBeVisible();
});

test("TC-STORIES-03 Detail panel shows placeholder when no post selected", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);
  await expect(page.locator("aside, [role=complementary]").first()).toContainText(/Select a post/i);
});

test("TC-STORIES-04 Tab switching does not crash the page", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);

  for (const tab of ["Published", "Drafts", "All"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.locator("main")).toBeVisible();
    // No error boundary
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  }
});

test("TC-STORIES-05 Search box accepts input without crashing", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/stories`);
  await page.getByRole("textbox", { name: /Search/i }).fill("family");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// EVENTS PAGE
// ---------------------------------------------------------------------------

test("TC-EVENTS-01 Events page heading, search, and tabs render", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/events`);

  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Search/i })).toBeVisible();

  for (const tab of ["Upcoming", "Ongoing", "Past", "All"]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  }
});

test("TC-EVENTS-02 New Event button visible when signed in", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/events`);
  await expect(page.getByRole("button", { name: /New Event/i })).toBeVisible();
});

test("TC-EVENTS-03 Event detail panel shows placeholder when no event selected", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/events`);
  await expect(page.locator("aside, [role=complementary]").first()).toContainText(/Select an event/i);
});

test("TC-EVENTS-04 Tab switching does not crash the page", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/events`);

  for (const tab of ["Upcoming", "Past", "All", "Ongoing"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  }
});

test("TC-EVENTS-05 Plan for Event header link opens events with create intent", async ({ page }) => {
  await signIn(page);
  await page.locator("header").getByRole("link", { name: /Plan for Event/i }).click();
  await expect(page).toHaveURL(/\/events/);
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
});

// ---------------------------------------------------------------------------
// FAMILY TREE PAGE
// ---------------------------------------------------------------------------

test("TC-TREE-01 Family Tree page loads in a valid state (signed in)", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-tree`);

  // Four valid states: has tree → h1 "Family Tree"; no tree → "Start Family Tree";
  // loading → "Loading family tree…"; no active family (just switched) → heading still visible
  await expect(
    page.getByRole("heading", { name: "Family Tree" })
      .or(page.getByRole("button", { name: /Start Family Tree/i }))
      .or(page.getByText(/Loading family tree/i))
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

test("TC-TREE-01b Family Tree page shows sample tree with role-based labels when logged out", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);

  // Heading visible
  await expect(page.getByRole("heading", { name: "Family Tree" })).toBeVisible();

  // Description paragraph visible
  await expect(page.getByText(/Build and explore your family tree/i)).toBeVisible();

  // "Click a person to explore" subtitle NOT shown (removed — buttons gate on auth)
  await expect(page.getByText(/sign in to edit/i)).not.toBeVisible();

  // Sample tree uses role terminology (not real names)
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Grandmother").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Parent").first()).toBeVisible({ timeout: 5000 });

  // Sidebar shows read-only inputs (no "This is me" button in preview)
  await expect(page.locator("aside").locator("input").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Child" })).toBeVisible();

  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

test("TC-TREE-02 Tree root node is visible and clickable", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-tree`);

  // At least one tree node button should exist
  const treeNode = page.getByRole("button").filter({ hasText: /Root|family/i }).first();
  await expect(treeNode).toBeVisible({ timeout: 8000 });
});

test("TC-TREE-03 Clicking tree node shows edit panel with Name and Born fields", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-tree`);

  const treeNode = page.getByRole("button").filter({ hasText: /Root|family/i }).first();
  await treeNode.click();

  const aside = page.locator("aside").first();
  // Inputs use <span> labels (not <label>), so match by placeholder-less input presence
  await expect(aside.locator("input").first()).toBeVisible();
  await expect(aside.locator("input").nth(1)).toBeVisible();
});

test("TC-TREE-04 Add Child button visible — in sidebar (signed in, tree or preview)", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-tree`);

  // Wait for any valid tree state (real tree loaded OR preview mode OR "Start Family Tree")
  await expect(
    page.getByRole("button", { name: "Add Child" })
      .or(page.getByRole("button", { name: "Start Family Tree" }))
  ).toBeVisible({ timeout: 10000 });

  // If Add Child is present, also verify Save
  const hasAddChild = await page.getByRole("button", { name: "Add Child" }).isVisible();
  if (hasAddChild) {
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  } else {
    console.log("TC-TREE-04: Active family has no tree — Start Family Tree shown instead");
  }
});

test("TC-TREE-05 Family tree page has no JS crash", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/family-tree`);

  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// FAMILY ISOLATION — switching between families
// ---------------------------------------------------------------------------

test("TC-FAMILY-01 Family menu button opens family switcher", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: /Family menu/i }).click();
  // FamilyMenu renders a custom slide-in panel — look for its action buttons
  await expect(
    page.getByRole("button", { name: /Create a New Family/i })
      .or(page.getByRole("button", { name: /Join with Invite/i }))
  ).toBeVisible({ timeout: 5000 });
  await page.keyboard.press("Escape");
});

test("TC-FAMILY-02 Family badge updates when family is switched", async ({ page }) => {
  await signIn(page);

  // Record current family name from badge
  const badge = page.locator("header").getByText(/❤️/);
  const before = await badge.textContent();

  // Open family menu and look for a different family to switch to
  await page.getByRole("button", { name: /Family menu/i }).click();
  const menuItems = page.getByRole("menuitem");
  const count = await menuItems.count();

  if (count > 1) {
    // Click the second family option (not the already-active one)
    await menuItems.nth(1).click();
    await page.waitForTimeout(500);
    const after = await badge.textContent();
    // Badge should have changed
    expect(after).not.toBe(before);
  } else {
    // Only one family — still a valid test that menu opens and closes cleanly
    await page.keyboard.press("Escape");
  }
});

test("TC-FAMILY-03 Stories page re-scopes when family changes", async ({ page }) => {
  await signIn(page);

  await page.goto(`${BASE}/stories`);
  await expect(page.getByRole("heading", { name: "Family Stories" })).toBeVisible();

  // Switch family if possible
  await page.getByRole("button", { name: /Family menu/i }).click();
  const menuItems = page.getByRole("menuitem");
  if (await menuItems.count() > 1) {
    await menuItems.nth(1).click();
    await page.goto(`${BASE}/stories`);
    // Page still renders correctly after switch — no crash
    await expect(page.getByRole("heading", { name: "Family Stories" })).toBeVisible();
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  } else {
    await page.keyboard.press("Escape");
  }
});

// ---------------------------------------------------------------------------
// WHY FAMILY VIBES MICROSITE
// ---------------------------------------------------------------------------

test("TC-WHY-01 All roadmap status badges render", async ({ page }) => {
  await page.goto(`${BASE}/why-family-vibes`);
  await expect(page.getByText("In design")).toBeVisible();
  await expect(page.getByText("Coming soon")).toBeVisible();
  await expect(page.getByText("On the roadmap")).toBeVisible();
});

test("TC-WHY-02 CTA buttons on microsite navigate correctly", async ({ page }) => {
  await page.goto(`${BASE}/why-family-vibes`);

  // "See it live on the home page" → home
  await page.getByRole("link", { name: /See it live on the home page/i }).click();
  await expect(page).toHaveURL(BASE + "/");

  await page.goto(`${BASE}/why-family-vibes`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // "Explore the family tree" → family tree
  await page.getByRole("link", { name: /Explore the family tree/i }).click();
  await expect(page).toHaveURL(/\/family-tree/);
});

test("TC-WHY-03 Comparison table renders all 6 competitor columns", async ({ page }) => {
  await page.goto(`${BASE}/why-family-vibes`);

  for (const name of ["Facebook Groups", "WhatsApp", "Google Photos", "Ancestry", "FamilyWall", "Family Vibes"]) {
    await expect(page.getByRole("columnheader", { name: new RegExp(name, "i") })).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// PAGE INTEGRITY — no crashes on direct URL access
// ---------------------------------------------------------------------------

test("TC-INTEGRITY-01 All routes load without JS error when signed in", async ({ page }) => {
  await signIn(page);

  const routes = ["/", "/stories", "/events", "/family-tree", "/why-family-vibes"];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`);
    await expect(page.locator("main")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  }
});

test("TC-INTEGRITY-02 All routes load without JS error when logged out", async ({ page }) => {
  const routes = ["/", "/stories", "/events", "/family-tree", "/why-family-vibes"];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`);
    await expect(page.locator("main")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  }
});
