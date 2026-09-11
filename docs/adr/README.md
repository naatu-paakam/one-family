# Architecture Decision Records

ADRs document design decisions that must be honoured in every change.  
**If a change would violate an ADR, it must not be merged without first updating the ADR and getting explicit sign-off.**

| ADR | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-role-model.md) | Three-tier role model (portal admin / family admin / member) | Accepted |
| [ADR-002](ADR-002-portal-admin.md) | Portal admin implementation (`is_portal_admin`, `/portal` route) | Accepted |
| [ADR-003](ADR-003-per-family-roles.md) | Per-family role storage and enforcement | Accepted |
| [ADR-004](ADR-004-invite-system.md) | Invite system — group link + individual email invite | Accepted |
| [ADR-005](ADR-005-role-gate-conventions.md) | Client-side role gate conventions (`[ROLE: ...]` tagging) | Accepted |
| [ADR-006](ADR-006-multi-family-membership.md) | Multi-family membership model | Accepted |
| [ADR-007](ADR-007-templates.md) | Template system — story, event, magazine layout | Accepted |
| [ADR-008](ADR-008-identifier-policy.md) | UUID identifier policy — every business entity | Accepted |
| [ADR-009](ADR-009-multi-family-story-publishing.md) | Stories and events publishable to multiple families; comments follow parent scope | Accepted |
| [ADR-010](ADR-010-visibility-tiers.md) | Visibility tiers (family / open / public) for families, events, and stories | Accepted |
| [ADR-012](ADR-012-family-tree-scale.md) | Family tree scale: flat `family_tree_nodes` table + lazy-load + member search | Accepted |

## How to use ADRs

- **Read before implementing** any feature that touches auth, roles, families, invites, or access control.
- **Update** the relevant ADR if a decision changes — with date and reason.
- **Add a new ADR** (ADR-00N) for any significant new architectural decision.
- ADR status values: `Proposed` → `Accepted` → `Superseded` | `Deprecated`
