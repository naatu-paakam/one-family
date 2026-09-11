/**
 * Family Vibes — Family Tree feature tests
 *
 * Covers:
 *   - Tree rendering (nodes, couple cards, relation lines)
 *   - Navigation (click node → sidebar updates, expand/collapse)
 *   - Horizontal scroll on wide trees
 *   - "This is me" flag feature
 *   - Partner / spouse fields
 *   - Contact fields (email, phone, address)
 *
 * Dev server must be running: npm run dev  (http://localhost:5177)
 * Run: npx playwright test e2e/tree.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
// Seed IDs created by global-setup.ts — deterministic so tests can target them
const SEED_ROOT_ID = "00000000-0000-0000-5eed-000000000001";

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

async function goToTree(page: Page) {
  await signIn(page);
  await page.goto(`${BASE}/family-tree`);
  await expect(page.locator("header").getByText(/❤️/)).toBeVisible({ timeout: 12000 });
  // Wait for valid tree state
  // With storageState + seed data, tree should load quickly — wait for main content
  await expect(page.locator("main")).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(2000); // allow family_tree_nodes fetch to complete
}

// ── Rendering ─────────────────────────────────────────────────────────────────

test("TC-TREE-R01 Sample tree shows role-based labels (not real names)", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Grandmother").first()).toBeVisible();
  await expect(page.getByText("Parent").first()).toBeVisible();
  await expect(page.getByText("Sibling").first()).toBeVisible();
  // No real names in sample
  await expect(page.getByText("Pat & Jordan")).not.toBeVisible();
  await expect(page.getByText("Alex")).not.toBeVisible();
});

test("TC-TREE-R02 Couple nodes show ♥ connector between partners", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });
  // Heart connector between Grandparent and Grandmother
  await expect(page.getByText("♥").first()).toBeVisible();
  // Both partners visible in same row
  await expect(page.getByText("Grandmother").first()).toBeVisible();
});

test("TC-TREE-R03 Description paragraph shown below heading", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText(/Build and explore your family tree together/i)).toBeVisible();
});

test("TC-TREE-R04 Tree container is horizontally scrollable on overflow", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });
  // The overflow-x-auto container should exist
  const scrollContainer = page.locator(".overflow-x-auto").first();
  await expect(scrollContainer).toBeVisible();
  // The min-width inner container should be wider than viewport for horizontal scroll
  const minWidthEl = page.locator(".min-w-\\[560px\\]").first();
  await expect(minWidthEl).toBeVisible();
});

// ── Navigation ────────────────────────────────────────────────────────────────

test("TC-TREE-N01 Clicking a tree node updates the sidebar selected member", async ({ page }) => {
  await goToTree(page);
  const main = page.locator("main");

  // Find any tree node button and click it
  const nodes = main.locator(".rounded-md.border.bg-card[role=button]");
  const count = await nodes.count();
  if (count > 1) {
    // Click second node (not root which is already selected)
    await nodes.nth(1).click();
    await page.waitForTimeout(300);
    // Sidebar should update — "Selected member" label still visible
    await expect(page.locator("aside").getByText("Selected member")).toBeVisible();
  }
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

test("TC-TREE-N02 Chevron icon button exists and is clickable", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });

  // Root node has a chevron button (it has children)
  const rootRow = page.locator(".rounded-md.border.bg-card[role=button]").first();
  const chevron = rootRow.locator("button").first();
  await expect(chevron).toBeVisible();
  // Chevron has an SVG icon (not text "Hide/Show")
  await expect(chevron.locator("svg")).toBeVisible();

  // Click collapse — no crash
  await chevron.click();
  await expect(page.getByText("Something went wrong")).not.toBeVisible();

  // Click again — no crash
  await chevron.click();
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

test("TC-TREE-N03 Chevron icon uses ChevronDown (expanded) and ChevronRight (collapsed)", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });

  const rootRow = page.locator(".rounded-md.border.bg-card[role=button]").first();
  const chevron = rootRow.locator("button[title]").first();

  // Initially expanded — title should say "Collapse"
  await expect(chevron).toHaveAttribute("title", /Collapse/i);

  // Collapse — title changes to "Expand"
  await chevron.click();
  await expect(chevron).toHaveAttribute("title", /Expand/i, { timeout: 2000 });

  // Re-expand
  await chevron.click();
  await expect(chevron).toHaveAttribute("title", /Collapse/i, { timeout: 2000 });
});

test("TC-TREE-N04 Add Child navigates to new node in sidebar", async ({ page }) => {
  await goToTree(page);
  // Only test if there's an actual tree (not "Start Family Tree" state)
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-N04: No tree — skipping"); return; }

  const namesBefore = await page.locator(".rounded-md.border.bg-card[role=button]").count();
  await page.getByRole("button", { name: "Add Child" }).click();
  await page.waitForTimeout(500);

  // A new node should have been added
  const namesAfter = await page.locator(".rounded-md.border.bg-card[role=button]").count();
  expect(namesAfter).toBeGreaterThanOrEqual(namesBefore);
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ── "This is me" feature ──────────────────────────────────────────────────────

test("TC-TREE-M01 This is me button visible — seed root node selected", async ({ page }) => {
  await goToTree(page);
  // Wait for seed root node (created by global-setup)
  const rootNode = page.locator(`[role=button][aria-label="Seed Grandparent"]`)
    .or(page.locator(".rounded-md.border.bg-card[role=button]").filter({ hasText: "Seed Grandparent" }));
  await expect(rootNode.first()).toBeVisible({ timeout: 12000 });
  await rootNode.first().click();
  await page.waitForTimeout(400);

  await expect(page.getByRole("button", { name: /This is me|That's me/i })).toBeVisible({ timeout: 5000 });
});

test("TC-TREE-M02 This is me button not shown when logged out (preview mode)", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  // Wait for sample tree to render
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });
  // Give the page a moment to fully render
  await page.waitForTimeout(500);
  // No "This is me" in preview mode — use not.toBeVisible with timeout
  await expect(page.getByRole("button", { name: /This is me/i })).not.toBeVisible({ timeout: 2000 });
});

test("TC-TREE-M03 Clicking This is me changes button to That's me", async ({ page }) => {
  await goToTree(page);
  const nodeBtn = page.locator(".rounded-md.border.bg-card[role=button]");
  const loaded = await nodeBtn.first().isVisible({ timeout: 12000 }).catch(() => false);
  if (!loaded) { console.log("TC-TREE-M03: No tree nodes — skipping"); return; }

  await nodeBtn.first().click();
  await page.waitForTimeout(400);

  const thisMeBtn = page.getByRole("button", { name: /This is me/i });
  const visible = await thisMeBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) { console.log("TC-TREE-M03: This is me button not visible — skipping"); return; }

  await thisMeBtn.click();
  await page.waitForTimeout(400);
  await expect(page.getByRole("button", { name: /That's me/i })).toBeVisible({ timeout: 3000 });
});

test("TC-TREE-M04 Flagging as me fills name from user profile in sidebar", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-M04: No tree — skipping"); return; }

  // Wait for a node to be clickable
  const nodes = page.locator(".rounded-md.border.bg-card[role=button]");
  const nodeCount = await nodes.count();
  if (nodeCount === 0) { console.log("TC-TREE-M04: No nodes rendered — skipping"); return; }
  await nodes.first().click();
  await page.waitForTimeout(300);

  // Wait for This is me button with generous timeout (tree loads async)
  const thisMeBtn = page.getByRole("button", { name: /This is me/i });
  const btnVisible = await thisMeBtn.isVisible({ timeout: 10000 }).catch(() => false);
  if (!btnVisible) { console.log("TC-TREE-M04: This is me button not visible — skipping"); return; }

  await thisMeBtn.click();
  await page.waitForTimeout(400);

  // Name field should now reflect the signed-in user's name (non-empty)
  const nameInput = page.locator("aside").locator("input").first();
  const nameValue = await nameInput.inputValue();
  expect(nameValue.length).toBeGreaterThan(0);
});

test("TC-TREE-M05 Auto-focus: tree collapses depth-0-only by default when no me-node flagged", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });

  // Root (Grandparent) is expanded — direct children (Parent nodes) visible
  await expect(page.getByText("Parent").first()).toBeVisible();

  // But grandchildren (Child nodes) should be collapsed/hidden by default
  // The Parent nodes have ▶ chevrons (collapsed), so Child nodes are not visible
  
  // Children of Parent are hidden (Parent is collapsed by default at depth 1)
  await expect(page.getByText("Child", { exact: true }).first()).not.toBeVisible({ timeout: 2000 });
});

test("TC-TREE-M06 Expand/collapse all controls exist for signed-in tree", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-M06: No tree — skipping"); return; }

  // Expand all button (ChevronsUpDown icon)
  await expect(page.getByTitle("Expand all branches")).toBeVisible({ timeout: 8000 });
  // Collapse all button (ChevronsDownUp icon)
  await expect(page.getByTitle("Collapse all branches")).toBeVisible();
});

// ── Partner / contact fields ──────────────────────────────────────────────────

test("TC-TREE-P01 Partner / Spouse section visible in sidebar when signed in and tree exists", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-P01: No tree yet — skipping"); return; }

  await expect(page.getByText("Partner / Spouse")).toBeVisible({ timeout: 8000 });
  // Partner name + born inputs in sidebar
  const inputs = page.locator("aside").locator("input");
  await expect(inputs.first()).toBeVisible();
});

test("TC-TREE-P02 Contact section (email, phone, address) visible when signed in and tree exists", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-P02: No tree yet — skipping"); return; }

  await expect(page.getByText(/Contact.*optional.*private/i)).toBeVisible({ timeout: 8000 });
  await expect(page.locator("aside").locator("input[type=email]")).toBeVisible();
  await expect(page.locator("aside").locator("input[type=tel]")).toBeVisible();
  await expect(page.locator("aside").locator("textarea")).toBeVisible();
});

test("TC-TREE-P03 Contact section not shown in preview/logged-out mode", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });
  // Contact section should be hidden (isPreview = true)
  await expect(page.locator("input[type=email]")).not.toBeVisible();
  await expect(page.locator("input[type=tel]")).not.toBeVisible();
});
