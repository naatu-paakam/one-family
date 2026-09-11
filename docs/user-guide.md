# Family Vibes — User Guide

> App URL: https://one-family.netlify.app  
> Dev URL: http://localhost:5177

---

## Getting started

### New user — create your family space
1. Open the app. On the home page, click **"Start your family space →"**.
2. The sign-up form opens. Enter your **full name**, **email**, and **password**, then click **Create Account**.
3. Check your email and click the confirmation link.
4. Sign back in — you'll land on the **Create a Family** screen.
5. Enter a family name and click **Create Family**. You become the first family admin.

### Returning user — sign in
1. Click **Join Family** in the top-right corner.
2. Choose **Continue with Google** or enter email + password, then click **Sign In**.
3. Your avatar appears in the header and the active family badge (❤️ Family Name) shows next to the logo.

### Join an existing family
- **Group invite link** — a family member shares a link like `https://one-family.netlify.app/join/abc12345`. Click it, sign in or sign up, and you're automatically added as a member.
- **Personal invite link** — a family admin generates a one-time link and sends it to you via WhatsApp. Click it, sign in or sign up, and you join.
- **Invite code** — go to `/family-settings` → Invites tab → enter the code manually.

### Switch between families
- Click the **FamilyMenu** button (header, next to your avatar) to see all your families.
- Select a different family — all pages update instantly.
- You can belong to multiple families (your own, in-laws, extended network) with different roles in each.

---

## Home page

- **AI Snapshot** — one-line AI summary of active events, story count, photos, and tree status.
- **Stat cards** — Stories / Events / Photos counts for the active family.
- **Family Tree preview** — read-only mini view of the active family's tree.
- **Active Events** — cards for ongoing events with a Live badge.
- **Live event banner** — amber strip below the header when an event is active.
- **Family bio** — shown below the family badge if the admin has written one.
- **Logged-out view** — hero with "Start your family space →" and "Plan for Event"; sample tree preview shown on the Family Tree page.

---

## Stories

Navigate to **Stories** in the top nav.

### Browse stories
- Cards on the left show published posts for the active family.
- Use the **All / Published / Drafts** tabs to filter.
- Search by title, author, or tag using the search box.
- Click a card to open the full story in the right panel.

### Write a story
1. Click **New Post** (visible when signed in).
2. Enter a title. Optionally click **✨ Generate with AI** for a prose draft.
3. Add sections, upload photos, tag an event.
4. Choose **visibility** at the bottom of the form:
   - 🔒 **Private** — only you can read it (saved as draft). Button shows "Save draft".
   - ❤️ **Family** — visible to family members (default published state).
   - 👥 **Open** — any registered user can read it.
   - 🌐 **Public** — anyone can read it via a shareable `/stories/:id` link.
5. Click **Save draft** (private) or **Save**.

### Edit or delete
- Edit and Delete buttons appear in the detail panel only for the post's author or a family admin.
- Change visibility at any time by editing the post and selecting a new tier.

---

## Events

Navigate to **Events** in the top nav, or click **Plan for Event** in the header.

### Browse events
- Tabs: **Upcoming / Ongoing / Past / All** — filtered to the active family.
- Search by title or location.
- Click an event card to open the detail panel.

### Create an event
1. Click the **+** FAB or **Plan for Event** in the header.
2. Enter a title and location. Click **✨ Generate with AI** for a description.
3. Choose **visibility** (who can see this event):
   - ❤️ **Family only** — family members (default).
   - 👥 **Registered users** — any signed-in user can read; registered users can RSVP.
   - 🌐 **Public** — anyone can read via a shareable `/events/:id` link.
4. Save the event.

### Manage invites
- In the detail panel, use **Add Invite** to add members.
- Each invitee has a status dropdown: Invited → Accepted / Declined.
- Event card shows counts: invited / going / pending.

### Close an event
- Click **Close Event** (visible to the creator or a family admin). Moves to Past tab.

---

## Family Tree

Navigate to **Family Tree** in the top nav.

### Logged-out preview
A sample tree (Pat & Jordan, Alex, Maya…) is shown so you can explore the feature. Clicking Save, Add Child, or Add Sibling opens the sign-in prompt. A green banner explains it's a sample.

### Edit the tree (signed in)
- Click any node to select it.
- Use **Add Child** / **Add Sibling** to grow the tree.
- Edit name and birth year inline in the right panel, then click **Save**.
- Use **▶ / ▼** to expand or collapse branches.

### Auto-save
- Changes save automatically after 800 ms of inactivity.
- A **"Saving…"** indicator appears while the save is in progress.
- The tree is scoped to the active family — switching families loads that family's tree.

---

## Family Settings (`/family-settings`)

Accessible from the **avatar dropdown → Family Settings** (visible to family admins).

### General tab (admin only)
- **Family profile visibility** — controls who can see the family's name and bio page:
  - 🔒 **Private** — members only (default)
  - 👥 **Open** — any registered user (direct link only)
  - 🌐 **Public** — anyone (direct link only)
- Family tree and member list are **always members-only** regardless of this setting.
- Individual story and event visibility is set by the creator — independent of this setting.

### Members tab
- Lists all family members with their role (Admin / Member) and join date.
- Read-only in MVP — promote/demote coming in R1.

### Bio tab (admin only)
- Write a short description of the family (up to 400 characters).
- Saved bio appears on the home page below the family badge.
- Leave blank to hide the bio entirely.

### Invites tab (admin only)
- **Group invite link** — copy and share with anyone. They join as Member. Click the rotate icon to invalidate the old link and generate a new one.
- **Personal invite links** — click **+ Generate link** to create a 7-day one-time token. Copy and send via WhatsApp. Click ✕ to revoke.

---

## Portal Admin (`/portal`)

Accessible from the **avatar dropdown → Portal Admin** — only visible to portal admins.

### Families tab
- See all families on the platform with member counts and admin names.
- Expand a row to see the family ID, invite code, creator name, and a copy button for the group invite link.
- Click the trash icon to permanently delete a family (destructive, cannot be undone).

### Users tab
- See all registered users with their portal admin status and family admin roles.
- **Make portal admin** — grants platform-wide access.
- **Remove portal admin** — removes platform access (cannot demote yourself).
- Family admin chips show which families each user admins; click ✕ to remove / ↑ to promote within a family.
- Trash icon removes the user from all families and deletes their profile.

---

## Tips

| Tip | Detail |
|---|---|
| Link a story to an event | When writing a post, choose an event — the story shows a 🎉 badge |
| AI generation | Works for event descriptions and story drafts — just provide a title |
| Multiple families | Use FamilyMenu to switch — no sign-out needed |
| Share group link | Family Settings → Invites tab → copy the group invite link |
| Share a public event | Set event visibility to 🌐 Public → copy the `/events/:id` URL |
| Share a public story | Set story visibility to 🌐 Public → copy the `/stories/:id` URL |
| Keep a story private | Set visibility to 🔒 Private — only you can see it (appears in Drafts tab) |
| Invite one person | Family Settings → Invites → Generate link → paste into WhatsApp |
| Portal admin | Promoted via the Portal admin dashboard → Users tab |

---

## FAQ

**Can I belong to more than one family?**  
Yes. Use FamilyMenu to switch between them. Each has its own stories, events, and tree.

**Who can see my family's content?**  
Only members of that family. The space is invite-only — there is no public feed.

**Can I delete someone else's story?**  
Only if you are a family admin or the post author.

**What does "Close Event" do?**  
Archives the event and moves it to the Past tab. Linked stories remain unchanged.

**The AI didn't generate anything — what's wrong?**  
The `ANTHROPIC_API_KEY` must be set as a Supabase Edge Function secret. Contact your family admin.

**Google sign-in isn't working in automated tests.**  
Google OAuth requires manual browser interaction and cannot be automated via Playwright.

**What's the difference between group and personal invite links?**  
Group link: permanent (until rotated), anyone with it can join. Personal: one-time use, expires in 7 days, sent to a specific person via WhatsApp.

**What's the difference between family visibility and story/event visibility?**  
Family visibility controls the family's *profile page* (name, bio). Story and event visibility is set per-item by the creator and is fully independent. A private family can have public events; a public family can have members-only stories.

**Can non-members comment on a public event?**  
No. Comments require a registered account. Public events are readable by anyone, but only registered users can comment or RSVP.

**Is the family tree ever public?**  
No. The family tree and member list are always members-only — this cannot be changed. Only the family bio/name can be made open or public.
