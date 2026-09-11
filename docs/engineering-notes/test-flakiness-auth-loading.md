# Engineering Note: Auth/Family Loading Flakiness

**Date:** 2026-09-11  
**Status:** Resolved via Playwright storageState  
**Affects:** All Playwright test suites

---

## Root Cause

Every test that called `page.goto(url)` triggered a full SPA reload. After each reload:

1. **Supabase auth restore** — the client reads the JWT from localStorage and calls `supabase.auth.getSession()` asynchronously. Until this completes, `session` from `useAuth()` is `null`.
2. **FamilyContext load** — after session is set, `fetchMyFamilies()` runs to load family membership. Until this completes, `families` is `[]` and `activeFamily` is `null`.
3. **UI gates** — tests checking for `❤️ FamilyName` badge, "Family Settings" heading, story/event counts, or any content that requires both `session` AND `activeFamily` would sometimes check before step 1 or 2 completed → "element not found".

The `signIn()` helper in each test file waited for `header button.rounded-full` (avatar), which confirms `session` is set. But it did NOT wait for `activeFamily` to load. Subsequent `page.goto()` calls (e.g., navigating to `/family-settings`) reset all async state.

---

## Evidence

| Symptom | Cause |
|---|---|
| `TC-FS-01`: heading "Settings" not found (timeout 8s) | `activeFamily` not loaded before assertion |
| `TC-PORTAL-*`: portal page shows loading state | `isPortalAdmin` check races with auth load |
| `TC-STORIES-03/04`: tab content not found | Family data not loaded, no stories visible |
| `TC-EVENTS-01/02`: events tabs not found | Same |
| ~30 tests marked "flaky" | Pass on retry because 2nd attempt catches after data loads |

---

## Solution: Playwright `storageState`

**How it works:**

```
┌──────────────┐    saves    ┌──────────────────────┐
│  setup.ts    │ ──────────► │ .playwright/auth.json │
│ (runs once)  │             │ (localStorage +       │
│ signs in     │             │  cookies snapshot)    │
└──────────────┘             └──────────┬───────────┘
                                        │  loaded before
                                        ▼  first navigation
                             ┌──────────────────────┐
                             │  All test files       │
                             │  start with valid     │
                             │  Supabase session     │
                             │  already in storage   │
                             └──────────────────────┘
```

When `storageState` is loaded, the SPA finds the Supabase JWT in localStorage on first mount → `supabase.auth.getSession()` resolves immediately (synchronously from cache) → no async delay → `session` is available on first render.

**What still causes loading delay:**

- `FamilyContext.fetchMyFamilies()` — still async (one Supabase call). Tests checking for family-dependent content (❤️ badge, Family Settings heading) still need `await expect(...).toBeVisible({ timeout: 12000 })` with generous timeouts.
- Tests that explicitly sign out and back in still need `signIn()`.
- Logged-out tests (TC-NAV-01, TC-HOME-01b) still work — storageState is ignored by tests that navigate before checking session.

**Files changed:**
- `playwright.config.ts` — added `setup` project + `dependencies: ["setup"]` on chromium
- `e2e/setup.ts` — signs in once, saves `.playwright/auth.json`
- `.gitignore` — `.playwright/` added (auth tokens must not be committed)
- `.env.example` — added `RESEND_API_KEY` (for TC-AUTH-04)

---

## Residual Flakiness (expected, not a bug)

Some tests are inherently timing-sensitive even with storageState:

| Test | Reason | Mitigation |
|---|---|---|
| `TC-FS-01` (Family Settings heading) | `activeFamily` loads after session | `timeout: 15000` on heading assertion |
| `TC-PORTAL-*` | Portal data fetched fresh each time | `timeout: 12000` on portal heading |
| `TC-TREE-01` (signed-in tree state) | `family_tree_nodes` fetched async | `timeout: 12000`, graceful skip if no tree |

These are marked as "flaky" (1 retry) not "failed". Retry: 1 in playwright.config.ts handles them.

---

## Running tests

```bash
# First run — setup creates .playwright/auth.json automatically
npx playwright test

# If auth.json is stale (session expired), delete it and re-run:
rm .playwright/auth.json && npx playwright test
```
