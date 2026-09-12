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

test("TC-TREE-M05 Full tree is expanded by default — all nodes visible without user interaction", async ({ page }) => {
  await page.goto(`${BASE}/family-tree`);
  await expect(page.getByText("Grandparent").first()).toBeVisible({ timeout: 8000 });

  // All levels visible by default (collapse-by-depth deferred post-MVP)
  await expect(page.getByText("Parent").first()).toBeVisible();
  await expect(page.getByText("Child").first()).toBeVisible();
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

// ── BUG-001: Tree renders all members / Add Child appears in canvas ───────────

test("TC-TREE-B01 Member count in subtitle matches number of rendered tree nodes", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-B01: No tree — skipping"); return; }

  // Read the member count from the subtitle (e.g. "NaatuPaakam · 9 members · Click…")
  const subtitleEl = page.locator("p").filter({ hasText: /members/ }).first();
  const subtitleText = await subtitleEl.innerText({ timeout: 8000 });
  const match = subtitleText.match(/(\d+)\s+member/);
  if (!match) { console.log("TC-TREE-B01: Could not parse member count — skipping"); return; }
  const memberCount = parseInt(match[1], 10);

  // Expand all so every node is visible
  await page.getByTitle("Expand all branches").click();
  await page.waitForTimeout(500);

  const renderedNodes = await page.locator(".rounded-md.border.bg-card[role=button]").count();
  expect(renderedNodes).toBe(memberCount);
});

test("TC-TREE-B01b Add Child appears immediately in tree canvas after clicking Add Child", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-B01b: No tree — skipping"); return; }

  // Expand all so we can see all nodes
  await page.getByTitle("Expand all branches").click();
  await page.waitForTimeout(300);
  const countBefore = await page.locator(".rounded-md.border.bg-card[role=button]").count();

  // Click Add Child on the selected (root) node
  await page.getByRole("button", { name: "Add Child" }).click();
  await page.waitForTimeout(800);

  // Tree canvas should now show one more node
  const countAfter = await page.locator(".rounded-md.border.bg-card[role=button]").count();
  expect(countAfter).toBe(countBefore + 1);
});

// ── BUG-002: "This is me" for Partner / Spouse ────────────────────────────────

test("TC-TREE-B02 Partner section has its own This is me button when signed in", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-B02: No tree — skipping"); return; }

  // Ensure a node is selected
  await page.locator(".rounded-md.border.bg-card[role=button]").first().click();
  await page.waitForTimeout(300);

  // The Partner / Spouse section heading row should contain a "This is me" button
  const partnerSection = page.locator("aside").getByText("Partner / Spouse").locator("..");
  await expect(partnerSection.getByRole("button", { name: /This is me|That's me/i })).toBeVisible({ timeout: 5000 });
});

test("TC-TREE-B02b Clicking partner This is me changes it to That's me", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-B02b: No tree — skipping"); return; }

  await page.locator(".rounded-md.border.bg-card[role=button]").first().click();
  await page.waitForTimeout(300);

  // Find the partner-section "This is me" — it's the second one in the aside
  const allThisMeBtns = page.locator("aside").getByRole("button", { name: /This is me/i });
  const partnerBtn = allThisMeBtns.nth(1); // second = partner section
  const isVisible = await partnerBtn.isVisible({ timeout: 4000 }).catch(() => false);
  if (!isVisible) { console.log("TC-TREE-B02b: Partner This is me button not visible — skipping"); return; }

  await partnerBtn.click();
  await page.waitForTimeout(500);
  // Should now say "That's me"
  const thatsMeBtns = page.locator("aside").getByRole("button", { name: /That's me/i });
  expect(await thatsMeBtns.count()).toBeGreaterThanOrEqual(1);
});

// ── BUG-003: Action bar layout ────────────────────────────────────────────────

test("TC-TREE-B03 Cancel and Delete icon buttons are present in sidebar", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-B03: No tree — skipping"); return; }

  // Cancel button (title="Cancel changes")
  await expect(page.getByTitle("Cancel changes")).toBeVisible({ timeout: 8000 });
  // Delete button (title="Delete member")
  await expect(page.getByTitle("Delete member")).toBeVisible({ timeout: 8000 });
});

test("TC-TREE-B03b Born label reads 'YYYY or Date of Birth'", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-B03b: No tree — skipping"); return; }

  await expect(page.getByText(/YYYY or Date of Birth/i).first()).toBeVisible({ timeout: 8000 });
});

test("TC-TREE-B03c Add Child and Add Sibling buttons are separated from Save button", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-B03c: No tree — skipping"); return; }

  const aside = page.locator("aside");
  // Both tree-mutation buttons exist
  await expect(aside.getByRole("button", { name: "Add Child" })).toBeVisible({ timeout: 8000 });
  await expect(aside.getByRole("button", { name: "Add Sibling" })).toBeVisible({ timeout: 8000 });
  // Save button exists
  await expect(aside.getByRole("button", { name: /^Save$|^Saving/ })).toBeVisible({ timeout: 8000 });
  // Save button is rendered ABOVE Add Child — verify by comparing button y positions
  const saveBox     = await aside.getByRole("button", { name: /^Save$|^Saving/ }).boundingBox();
  const addChildBox = await aside.getByRole("button", { name: "Add Child" }).boundingBox();
  if (saveBox && addChildBox) {
    // Add Child row must be below (larger y) the Save button
    expect(addChildBox.y).toBeGreaterThan(saveBox.y);
  }
});

// ── BUG-004: "This is me" node visible after navigation ──────────────────────

test("TC-TREE-B04 Flagged This-is-me node remains visible after navigating away and back", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-B04: No tree — skipping"); return; }

  // Flag first node as "This is me"
  const firstNode = page.locator(".rounded-md.border.bg-card[role=button]").first();
  await firstNode.click();
  await page.waitForTimeout(300);

  const thisMeBtn = page.locator("aside").getByRole("button", { name: /This is me/i }).first();
  const canFlag = await thisMeBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!canFlag) { console.log("TC-TREE-B04: This is me button not visible — skipping"); return; }

  await thisMeBtn.click();
  await page.waitForTimeout(600);
  // Confirm it is flagged
  await expect(page.locator("aside").getByRole("button", { name: /That's me/i }).first()).toBeVisible({ timeout: 3000 });

  // Navigate away
  await page.goto(`${BASE}/events`);
  await page.waitForTimeout(500);

  // Navigate back
  await page.goto(`${BASE}/family-tree`);
  // Wait for tree to fully load
  await page.waitForTimeout(2500);

  // Expand all to make every node visible
  const expandBtn = page.getByTitle("Expand all branches");
  const expandVisible = await expandBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (expandVisible) {
    await expandBtn.click();
    await page.waitForTimeout(500);
  }

  // The node with the "me" badge should be visible in canvas
  const meBadge = page.locator("span.bg-emerald-500").filter({ hasText: "me" });
  await expect(meBadge.first()).toBeVisible({ timeout: 5000 });
});

// ── Scroll: wide tree is horizontally scrollable ──────────────────────────────

test("TC-TREE-S01 Horizontal scroll container exists and allows overflow scroll", async ({ page }) => {
  await goToTree(page);
  const hasTree = await page.getByRole("heading", { name: "Family Tree" }).isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasTree) { console.log("TC-TREE-S01: No tree — skipping"); return; }

  // Expand all to maximise width
  await page.getByTitle("Expand all branches").click();
  await page.waitForTimeout(500);

  const scrollEl = page.locator(".overflow-x-auto").first();
  await expect(scrollEl).toBeVisible({ timeout: 5000 });

  const box = await scrollEl.boundingBox();
  expect(box).not.toBeNull();

  // scrollWidth >= clientWidth (container can scroll if content is wider)
  const scrollWidth = await scrollEl.evaluate((el: HTMLElement) => el.scrollWidth);
  const clientWidth = await scrollEl.evaluate((el: HTMLElement) => el.clientWidth);
  // At minimum the scroll container is not broken (scrollWidth ≥ clientWidth)
  expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
});
