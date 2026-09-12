/**
 * Playwright globalTeardown — deletes the Test Family created in globalSetup.
 * Cascade foreign keys handle all child rows automatically:
 *   family_members, family_tree_nodes, story_families, event_families,
 *   stories (updates), events, comments, invites — all gone in one delete.
 *
 * Stories with visibility='open'/'public' are NOT in story_families so they
 * are cleaned up by author_id filter separately.
 *
 * Uses raw HTTP (fetch) to avoid Supabase SDK ESM/CJS conflicts.
 */

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  ?? "https://tslvjovdqiaxedrmxdfr.supabase.co";
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const EMAIL    = "test@naatupakam.family";
const PASSWORD = "Test123!";

import * as fs from "fs";
import * as path from "path";

const FAMILIES_FILE = path.resolve(".playwright/test-families.json");

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
    console.warn(`[global-teardown] rpc/${fn} → ${r.status}: ${txt.slice(0,80)}`);
  }
  return r;
}

async function globalTeardown() {
  // Sign in
  const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!authResp.ok) { console.warn("[global-teardown] auth failed — skipping cleanup"); return; }
  const { access_token, user } = await authResp.json() as { access_token: string; user: { id: string } };
  const jwt    = access_token;
  const userId = user.id;

  console.log("[global-teardown] Cleaning up Test Family and seed data…");

  // ── 1. Delete Test Families via portal RPC — cascade removes all child rows ──
  let families: { a?: string; b?: string } = {};
  if (fs.existsSync(FAMILIES_FILE)) {
    try { families = JSON.parse(fs.readFileSync(FAMILIES_FILE, "utf8")); } catch {}
  }
  if (families.a) await rpc("portal_delete_family", { p_family_id: families.a }, jwt);
  if (families.b) await rpc("portal_delete_family", { p_family_id: families.b }, jwt);
  // Remove the families file so next run starts fresh
  if (fs.existsSync(FAMILIES_FILE)) fs.unlinkSync(FAMILIES_FILE);
  console.log("[global-teardown] ✓ Deleted Test Families A & B (cascade)");

  // ── 2. Stories without a family link (open/public visibility) ────────────────
  // These aren't in story_families so the family cascade doesn't catch them.
  // Only delete by the test user — never touch other users' content.
  await del("updates", `author_id=eq.${userId}&title=like.*%5BSEED%5D*`, jwt);
  await del("updates", `author_id=eq.${userId}&title=like.TC-VIS*`,       jwt);
  await del("updates", `author_id=eq.${userId}&title=like.VIS-TEST*`,     jwt);
  await del("updates", `author_id=eq.${userId}&title=like.TC-SCOM*`,      jwt);
  await del("updates", `author_id=eq.${userId}&title=eq.New+Post`,        jwt);
  console.log("[global-teardown] ✓ Deleted orphan test stories");

  console.log("[global-teardown] ✓ Teardown complete");
}

export default globalTeardown;
