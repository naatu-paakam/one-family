/**
 * Playwright globalSetup — creates a dedicated Test Family and seeds data before the suite.
 * Uses the create_family RPC (security-definer) so family creation always succeeds.
 * Family UUIDs are written to .playwright/test-families.json for teardown.
 *
 * Uses raw HTTP (fetch) to avoid Supabase SDK ESM/CJS conflicts in Node.js globalSetup.
 */

import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  ?? "https://tslvjovdqiaxedrmxdfr.supabase.co";
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const EMAIL    = "test@naatupakam.family";
const PASSWORD = "Test123!";

// Seed item IDs — deterministic, namespaced under 5eed prefix
export const SEED_ROOT_ID          = "00000000-0000-0000-5eed-000000000001";
export const SEED_STORY_FAM        = "00000000-0000-0000-5eed-000000000008";
export const SEED_STORY_OPEN       = "00000000-0000-0000-5eed-000000000009";
export const SEED_EVENT_ID         = "00000000-0000-0000-5eed-000000000010";
export const SEED_STORY_COMMENTS   = "00000000-0000-0000-5eed-000000000011";

// These are populated at runtime by globalSetup and exported for test files
export let TEST_FAMILY_ID   = "";
export let TEST_FAMILY_B_ID = "";

const FAMILIES_FILE = path.resolve(".playwright/test-families.json");

async function rest(method: string, path: string, body: any, jwt: string, prefer = "return=minimal") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && r.status !== 204) {
    const txt = await r.text().catch(() => "");
    console.warn(`[global-setup] ${method} ${path} → ${r.status}: ${txt.slice(0,120)}`);
  }
  return r;
}

async function rpc(fn: string, args: any, jwt: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    console.warn(`[global-setup] rpc/${fn} → ${r.status}: ${txt.slice(0,120)}`);
  }
  return r;
}

async function rpcJson(fn: string, args: any, jwt: string): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`[global-setup] rpc/${fn} → ${r.status}: ${txt.slice(0,120)}`);
  }
  return r.json();
}

async function globalSetup() {
  // Sign in via Supabase Auth REST
  const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!authResp.ok) throw new Error("[global-setup] Auth failed: " + (await authResp.text()));
  const { access_token, user } = await authResp.json() as { access_token: string; user: { id: string } };
  const jwt    = access_token;
  const userId = user.id;
  console.log("[global-setup] Signed in as", EMAIL, "uid:", userId);

  // ── 0. Test Families via create_family RPC (security-definer, always succeeds) ─
  fs.mkdirSync(path.dirname(FAMILIES_FILE), { recursive: true });

  // Reuse existing families if teardown left them (shouldn't happen, but safety net)
  let existingFamilies: { a?: string; b?: string } = {};
  if (fs.existsSync(FAMILIES_FILE)) {
    try { existingFamilies = JSON.parse(fs.readFileSync(FAMILIES_FILE, "utf8")); } catch {}
  }

  // Create (or reuse) Test Family A
  let familyA: any;
  if (existingFamilies.a) {
    familyA = { id: existingFamilies.a };
    console.log("[global-setup] Reusing Test Family A:", familyA.id);
  } else {
    familyA = await rpcJson("create_family", { p_name: "Test Family A" }, jwt);
    console.log("[global-setup] Created Test Family A:", familyA.id);
  }

  // Create (or reuse) Test Family B
  let familyB: any;
  if (existingFamilies.b) {
    familyB = { id: existingFamilies.b };
    console.log("[global-setup] Reusing Test Family B:", familyB.id);
  } else {
    familyB = await rpcJson("create_family", { p_name: "Test Family B" }, jwt);
    console.log("[global-setup] Created Test Family B:", familyB.id);
  }

  // Persist UUIDs for teardown
  fs.writeFileSync(FAMILIES_FILE, JSON.stringify({ a: familyA.id, b: familyB.id }));
  TEST_FAMILY_ID   = familyA.id;
  TEST_FAMILY_B_ID = familyB.id;
  console.log("[global-setup] ✓ Test Families A & B ready");

  // ── 1. Family tree nodes ───────────────────────────────────────────────────────
  const BASE_NODE = { family_id: TEST_FAMILY_ID, born: null as null|string, partner_name: null as null|string,
    partner_born: null as null|string, email: null as null|string, phone: null as null|string,
    address: null as null|string, avatar: null as null|string, user_id: null as null|string };
  const treeNodes = [
    { ...BASE_NODE, id: SEED_ROOT_ID, parent_id: null, name: "Seed Grandparent", born: "1940", partner_name: "Seed Grandmother", partner_born: "1942", sort_order: 0, user_id: userId },
    { ...BASE_NODE, id: "00000000-0000-0000-5eed-000000000002", parent_id: SEED_ROOT_ID, name: "Seed Parent One",  born: "1968", partner_name: "Seed Spouse One",  partner_born: "1970", sort_order: 0, email: "parent1@seed.test", phone: "+1-555-0001" },
    { ...BASE_NODE, id: "00000000-0000-0000-5eed-000000000003", parent_id: SEED_ROOT_ID, name: "Seed Parent Two",  born: "1972", partner_name: "Seed Spouse Two",  partner_born: "1974", sort_order: 1 },
    { ...BASE_NODE, id: "00000000-0000-0000-5eed-000000000007", parent_id: SEED_ROOT_ID, name: "Seed Sibling",     born: "1975", sort_order: 2 },
    { ...BASE_NODE, id: "00000000-0000-0000-5eed-000000000004", parent_id: "00000000-0000-0000-5eed-000000000002", name: "Seed Child One",   born: "2000", sort_order: 0 },
    { ...BASE_NODE, id: "00000000-0000-0000-5eed-000000000005", parent_id: "00000000-0000-0000-5eed-000000000002", name: "Seed Child Two",   born: "2003", sort_order: 1 },
    { ...BASE_NODE, id: "00000000-0000-0000-5eed-000000000006", parent_id: "00000000-0000-0000-5eed-000000000003", name: "Seed Grandchild",  born: "2010", sort_order: 0 },
  ];

  await rest("POST", "family_tree_nodes", treeNodes, jwt, "resolution=ignore-duplicates,return=minimal");
  console.log("[global-setup] ✓ Tree nodes upserted");

  // ── 2. Stories ────────────────────────────────────────────────────────────────
  await rest("POST", "updates", {
    id: SEED_STORY_FAM, author_id: userId, ai_generated: false, hashtags: ["seed"],
    title: "[SEED] Family story", content: "Seed family story for testing edit/delete and copy link.",
    visibility: "family", event_id: null, image_url: null,
  }, jwt, "resolution=ignore-duplicates,return=minimal");
  await rpc("publish_story_to_family", { p_story_id: SEED_STORY_FAM, p_family_id: TEST_FAMILY_ID }, jwt);

  await rest("POST", "updates", {
    id: SEED_STORY_OPEN, author_id: userId, ai_generated: false, hashtags: ["seed"],
    title: "[SEED] Open story", content: "Seed open story for link sharing tests.",
    visibility: "open", event_id: null, image_url: null,
  }, jwt, "resolution=ignore-duplicates,return=minimal");
  console.log("[global-setup] ✓ Stories upserted");

  // ── 3. Story with comments enabled ───────────────────────────────────────────
  await rest("POST", "updates", {
    id: SEED_STORY_COMMENTS, author_id: userId, ai_generated: false, hashtags: ["seed"],
    title: "[SEED] Comments-enabled story", content: "This story has comments enabled for testing.",
    visibility: "family", event_id: null, image_url: null, comments_enabled: true,
  }, jwt, "resolution=ignore-duplicates,return=minimal");
  await rpc("publish_story_to_family", { p_story_id: SEED_STORY_COMMENTS, p_family_id: TEST_FAMILY_ID }, jwt);
  console.log("[global-setup] ✓ Comments-enabled story upserted");

  // ── 4. Event ──────────────────────────────────────────────────────────────────
  await rest("POST", "events", {
    id: SEED_EVENT_ID, created_by: userId, visibility: "family", closed_at: null,
    title: "[SEED] Ongoing Test Event",
    description: "Seed ongoing event for TC-17 Close Event test.",
    location: "Seed Location", started_at: new Date().toISOString(),
  }, jwt, "resolution=ignore-duplicates,return=minimal");
  await rpc("share_event_to_family", { p_event_id: SEED_EVENT_ID, p_family_id: TEST_FAMILY_ID }, jwt);
  console.log("[global-setup] ✓ Event upserted");

  console.log("[global-setup] ✓ All seed data ready under Test Family — tests will run without skipping");
}

export default globalSetup;
