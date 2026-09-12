/**
 * Playwright globalTeardown — cleans up all seed test data after the suite.
 * Uses raw HTTP (fetch) to avoid Supabase SDK ESM/CJS conflicts.
 */

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  ?? "https://tslvjovdqiaxedrmxdfr.supabase.co";
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const EMAIL    = "test@naatupakam.family";
const PASSWORD = "Test123!";

async function del(table: string, filter: string, jwt: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${jwt}`,
      Prefer: "return=minimal",
    },
  });
  if (!r.ok && r.status !== 204) {
    console.warn(`[global-teardown] DELETE ${table}?${filter} → ${r.status}`);
  }
}

async function globalTeardown() {
  // Sign in
  const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!authResp.ok) { console.warn("[global-teardown] auth failed — skipping cleanup"); return; }
  const { access_token } = await authResp.json() as { access_token: string };
  const jwt = access_token;

  console.log("[global-teardown] Cleaning up seed test data…");

  // ── 1. Tree nodes — delete leaves first, then parents, then root ─────────────
  const leafIds = [
    "00000000-0000-0000-5eed-000000000004",
    "00000000-0000-0000-5eed-000000000005",
    "00000000-0000-0000-5eed-000000000006",
    "00000000-0000-0000-5eed-000000000007",
  ];
  const parentIds = [
    "00000000-0000-0000-5eed-000000000002",
    "00000000-0000-0000-5eed-000000000003",
  ];
  const rootId = "00000000-0000-0000-5eed-000000000001";

  for (const id of [...leafIds, ...parentIds, rootId]) {
    await del("family_tree_nodes", `id=eq.${id}`, jwt);
  }
  console.log("[global-teardown] ✓ Deleted tree nodes");

  // ── 2. Stories ──────────────────────────────────────────────────────────────
  await del("updates", "id=eq.00000000-0000-0000-5eed-000000000008", jwt);
  await del("updates", "id=eq.00000000-0000-0000-5eed-000000000009", jwt);
  await del("updates", "id=eq.00000000-0000-0000-5eed-000000000011", jwt);
  // Clean all test-generated stories by prefix or default title
  await del("updates", "title=like.*%5BSEED%5D*",       jwt);  // [SEED] prefix
  await del("updates", "title=like.TC-VIS*",             jwt);
  await del("updates", "title=like.VIS-TEST*",           jwt);
  await del("updates", "title=like.TC-SCOM*",            jwt);
  await del("updates", "title=like.bare+private+test",   jwt);
  // "New Post" is the app default title — any created by the test user should be removed
  await del("updates", `title=eq.New+Post&author_id=eq.${userId}`, jwt);
  console.log("[global-teardown] ✓ Deleted stories");

  // ── 3. Events ───────────────────────────────────────────────────────────────
  await del("events", "id=eq.00000000-0000-0000-5eed-000000000010", jwt);
  await del("events", "title=like.*%5BSEED%5D*", jwt);
  console.log("[global-teardown] ✓ Deleted events");

  console.log("[global-teardown] ✓ Teardown complete");
}

export default globalTeardown;
