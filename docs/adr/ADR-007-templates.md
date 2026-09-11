# ADR-007 — Template system

**Status:** Accepted  
**Date:** 2026-09-08  
**Deciders:** Pavan Kumar Bijjala

---

## Context

Family admins need a way to configure repeatable patterns for content and presentation — so members don't start from a blank page, and the family's output has a consistent look. Templates apply to stories, events, and the monthly magazine layout.

## Decision

### Template types

Three distinct template types, all configurable per-family by family admins:

#### 1. Story templates
Pre-filled structure for blog posts so members start with a scaffold, not a blank editor.

Examples:
- **Monthly Update** — sections: Highlights, Who did what, Photos, What's next
- **Event Recap** — sections: What happened, Moments, Memories
- **Member Spotlight** — sections: About, Fun facts, Message from the family
- **Custom** — admin defines section names and optional placeholder text

Stored as: `family_story_templates(id, family_id, name, sections jsonb, created_by, created_at)`  
Used when: "New Post" → "Use a template" picker appears before the editor opens.

#### 2. Event templates
Pre-filled event title patterns and description skeletons so recurring events (Diwali, Annual Reunion) are consistent year to year.

Examples:
- **Annual Reunion** — suggested title format: "Family Reunion YYYY", description scaffold with agenda sections
- **Festival** — suggested title: "<Festival name> YYYY", description with what to bring, who's hosting
- **Birthday** — title: "<Name>'s Birthday YYYY", description with venue/timing prompts

Stored as: `family_event_templates(id, family_id, name, title_pattern text, description_scaffold text, created_by, created_at)`  
Used when: creating a new event → optional "Start from a template" step.

#### 3. Magazine layout template
Controls the look of the monthly family magazine PDF (roadmap feature — ADR pending build).

Configurable per-family:
- Cover style: photo-cover / title-only / illustrated
- Font family: serif (traditional) / sans-serif (modern)
- Colour scheme: warm / cool / neutral / custom hex
- Section order: which story categories appear first
- Include / exclude: family tree page, member spotlight page, event calendar page

Stored as: `family_magazine_config(family_id, cover_style, font_family, colour_scheme, section_order jsonb, includes jsonb, updated_by, updated_at)` — one row per family (upsert pattern).

### Who can manage templates

| Action | Role |
|---|---|
| Create / edit / delete story templates | Family Admin |
| Create / edit / delete event templates | Family Admin |
| Configure magazine layout | Family Admin |
| Use a story template when writing | Family Member (any) |
| Use an event template when creating | Family Member (any) |

### Where templates live in the UI

- **Family Settings panel** (admin-only section, accessible from FamilyMenu → "Family Settings") contains a "Templates" tab.
- Templates tab has three sub-sections: Stories / Events / Magazine Layout.
- Members see the template picker in the New Post and Create Event flows — they cannot see the admin Templates settings tab.

### Default templates (system-wide, not per-family)
- Three built-in story templates ship with the app (Monthly Update, Event Recap, Member Spotlight).
- These are not stored in the DB — they are hardcoded in the client.
- Family admins can supplement with custom templates on top of the built-ins; they cannot delete the built-ins.
- Event templates have no built-in defaults — families define their own from scratch.
- Magazine layout defaults to: photo-cover / sans-serif / warm / all sections included.

### Phase plan
- **Phase 1:** Story templates only — picker in New Post flow + admin template editor.
- **Phase 2:** Event templates.
- **Phase 3:** Magazine layout config (when PDF generation ships).

## Consequences

- Two new migrations: `family_story_templates` + `family_event_templates` tables (magazine config comes with Phase 3).
- RLS: INSERT/UPDATE/DELETE only by `family_members.role = 'admin'` for that family; SELECT by any family member.
- New "Family Settings" page/panel needed — this is where templates, bio (ADR-003), and member management all live.
- Template picker in New Post flow is optional — member can always start blank. No forced template.
- `[ROLE: family-admin]` gate on the entire Templates settings tab and all template CRUD actions.
- Built-in templates are constants in `client/lib/templates.ts` — not in Supabase.
