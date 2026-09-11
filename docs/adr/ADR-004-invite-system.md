# ADR-004 — Invite system design

**Status:** Accepted  
**Date:** 2026-09-08  
**Updated:** 2026-09-08 — confirmed Phase 1 individual invite is copy-paste token only (no email); email delivery deferred indefinitely  
**Deciders:** Pavan Kumar Bijjala

---

## Context

Currently the only way to join a family is `join_family_by_code(p_invite_code)` RPC, which works but has no UI. There is no individual email invite flow. The user wants two invite paths: group link (any member can share) and individual email invite (admin only).

## Decision

### Path A — Group invite link (any family member)
- The `families.invite_code` (uuid) already exists and is unique per family.
- A shareable link is: `https://<app>/join/<invite_code>`
- Any signed-in user who visits that URL and is not already a member is auto-joined as `role = 'member'` via the existing `join_family_by_code` RPC.
- If the visitor is not signed in, they land on the sign-in/sign-up flow first, then are redirected back to `/join/<invite_code>` to complete joining.
- Any member (admin or member) can copy the link from the Family Settings panel — no special permission required.
- To invalidate: family admin regenerates a new invite code (new RPC: `rotate_invite_code(family_id)`). Old code stops working.

### Path B — Individual invite link (family admin only) — **copy-paste, no email**
- Family admin clicks "Generate invite link" in the Members panel.
- A one-time token is created in a new `family_invitations` table: `(id, family_id, invited_by, token uuid, expires_at, accepted_at, created_at)`.
  - No `invited_email` column — the admin pastes the link into WhatsApp, iMessage, or any messenger manually.
- The link format: `https://<app>/join/invite/<token>`
- The recipient clicks the link, signs up or signs in, and is auto-joined to that family as `role = 'member'`.
- Tokens expire after 7 days. An expired token shows an "invite expired, ask for a new one" page.
- Each click of "Generate invite link" creates a fresh token — previous tokens remain valid until they expire or are revoked.
- Admin can see a list of pending (unused, not expired) tokens and revoke any.
- **No email infrastructure needed** — no Resend, no Edge Function for sending. The `send-invite` Edge Function is explicitly out of scope.
- **Why:** families share links via WhatsApp anyway; adding email would add infrastructure complexity with no real benefit for the target user.

### Path C — Self-registration with group link (no invite needed)
- Same as Path A but the visitor is new to the platform entirely.
- They sign up (email or Google) and are immediately redirected to complete the join.
- No pre-approval step — the group link is the pre-approval.

### What does NOT exist (by design)
- Public family discovery — families are not searchable or listed anywhere publicly.
- Open registration without a link — you must have either a group link or an individual invite token.

### New route
`/join/:code` — handles both group invite codes and individual invite tokens (distinguishes by length/format: uuid v4 for group code, separate `token` column for individual invites).

## Consequences

- New migration: create `family_invitations` table + `rotate_invite_code` RPC.
- New route `/join/:code` added to App.tsx (handles both group invite code and individual invite token).
- No email Edge Function — ever, unless a future ADR supersedes this one.
- Family Settings panel shows "Copy group invite link" for any member; shows "Generate personal invite link" for admins only.
- No `RESEND_API_KEY` or email secrets required.
