# Family Vibes — User Guide

> App URL: https://one-family.netlify.app  
> Dev URL: http://localhost:5177

---

## Getting started

### New user — create your family space
1. Open the app. On the home page, click **"Start your family space →"**.
2. The sign-up form opens. Enter your **full name**, **email**, and **password**, then click **Create Account**.
3. Check your email and click the confirmation link.
4. Sign back in — you'll land on the **"You're all set!"** screen.
5. Click **Create a Family**, enter a name, and click **Create Family**. You become the first admin.

### Returning user — sign in
1. Click **Join Family** in the top-right corner.
2. Choose **Continue with Google** or enter email + password, then click **Sign In**.
3. Your avatar appears in the header and the active family badge (❤️ Family Name) shows next to the logo.

### Join an existing family
- **Group invite link** — a family member shares `https://one-family.netlify.app/join/abc12345`. Click it to see the invite card; sign in or sign up to join automatically.
- **Personal invite link** — a family admin generates a one-time link and sends it to you. Click it, sign in or sign up, and you join.
- **Invite code** — go to `/family-settings` → **Invites** tab → enter the code manually, or use **Join with Invite Code** from the family menu.

### Switch between families
- Click the **❤️ FamilyName** badge in the header (hamburger icon) to open **My Families**.
- Select a different family — all pages update instantly.
- You can belong to multiple families (your own, in-laws, extended network) with different roles in each.

### Leave a family
- Open **My Families** (header menu).
- Click the 🗑 **leave icon** next to a family where your role is **Member**.
  - ⚠️ Admins cannot leave via this button — transfer admin role first, or contact a portal admin.
- An inline confirmation appears: click **Leave** to confirm, or **Cancel** to dismiss.

---

## Navigation

### Profile dropdown (avatar, top-right)
Click your avatar to access:

| Item | Action |
|---|---|
| **New Story** | Opens the Stories page with the creation form pre-opened |
| **Plan for Event** | Opens the Events page with the create form pre-opened |
| ─ | ─ |
| **View Stories** | Goes to the Stories feed |
| **View Events** | Goes to the Events feed |
| **View Family Tree** | Goes to the Family Tree page |
| ─ | ─ |
| **Family Settings** | Family admin only |
| **Portal Admin** | Portal admin only |
| ─ | ─ |
| **Sign Out** | Signs out of the app |

### My Families panel (❤️ badge in header)
- Lists all your families with role badge (Admin / Member).
- **Admin families** show two icons:
  - 📋 **Copy invite code** — copies the short code (e.g. `abc12345`) to clipboard
  - 🔗 **Copy invite link** — copies the full URL (e.g. `https://.../join/abc12345`) to clipboard
- **Member families** show a 🗑 **leave icon** — click to open an inline confirmation and leave.
- **Create a new family** and **Join another family** appear directly below the list.

---

## Home page

- **AI Snapshot** — one-line AI summary of active events, story count, photos, and tree status.
- **Stat cards** — Stories / Events / Photos counts for the active family.
- **Family Tree preview** — read-only mini view of the active family's tree.
- **Active Events** — cards for ongoing events with a Live badge.
- **Live event banner** — amber strip below the header when an event is active.
- **Family bio** — shown below the family badge if the admin has written one. Click **Edit** (admin only) to update.
- **Logged-out view** — hero with "Start your family space →" and "Plan for Event"; sample tree shown.
- **No-family view** — if signed in but not yet a member of any family, the app shows "You're all set!" with Create / Join prompts. Stories, Events, and Family Tree redirect here automatically.

---

## Stories

Navigate to **Stories** in the top nav, or choose **View Stories** or **New Story** from the avatar dropdown.

### Browse stories
- Cards on the left show published posts for the active family.
- Use the **All / Published / Drafts** tabs to filter.
- Search by title, author, or tag using the search box.
- Click a card to open the full story in the right panel.
- Comment count badge (💬 N) appears on cards where comments are enabled.

### Write a story
1. Click **New Story** (+ FAB or avatar dropdown → New Story).  
   The form opens automatically — no extra click needed.
2. Enter a title. Optionally click **✨ Generate with AI** for a prose draft.
3. Add content, upload photos, tag an event.
4. Choose **Who can see this?**:
   - 🔒 **Private to you** — only you can read it (Drafts tab). Button shows "Save draft".
   - ❤️ **Family** — visible to family members (default).
   - 👥 **All users** — any registered user can read it.
   - 🌐 **Public** — anyone can read it via a shareable `/stories/:id` link.
5. Toggle **Allow comments** (author-controlled, off by default).
6. Click **Save draft** (private) or **Save**.

### Edit, delete, or change visibility
- **Modify Post** button appears in the detail panel for the post's author or a family admin.
- Delete shows an inline red confirmation panel — no browser popup.
- Change visibility at any time by editing and selecting a new tier.

### Story comments
- Comments are off by default per story. The author enables them via **Modify Post → Allow comments**.
- Once enabled, any family member (or registered user for open/public stories) can comment.
- Comments support replies, emoji reactions, and photo attachments.
- Comment author or family admin can delete comments.

### Share a story
- Copy the link icon (🔗) appears on non-private stories in the detail panel.
- For public stories, share `/stories/:id` — no login required to read.

---

## Events

Navigate to **Events** in the top nav, or choose **View Events** or **Plan for Event** from the avatar dropdown.

### Browse events
- Tabs: **Upcoming / Ongoing / Past / All** — filtered to the active family.
- Each card shows visibility badge (❤️ Family · 👥 Open · 🌐 Public), invite counts, and comment count.
- Click an event card to open the detail panel.

### Create an event
1. Click the **+** FAB, or use avatar dropdown → **Plan for Event**.
2. Enter a title and location. Click **✨ Generate with AI** for a description.
3. Choose **Who can see this?**:
   - ❤️ **Family** — family members only (default).
   - 👥 **All users** — any registered user can read and RSVP.
   - 🌐 **Public** — anyone can read via a shareable `/events/:id` link; registered users can RSVP.
4. Click **Save**.

### Manage invites
- In the detail panel, start typing a name in **Add invite** — a typeahead list of family members appears.
- Select a member to add them. Their status begins as **Invited**.
- Invited users can update their own RSVP (Accepted / Declined / Pending) — their row is highlighted.
- Organiser or admin can delete an invite via the 🗑 icon on each invite row.

### Modify or delete an event
- Click **Modify Event** in the detail panel.
- Change title, location, description, or visibility, then **Save**.
- **Delete Event** (red button, visible to creator or family admin) shows an inline confirmation — no browser popup.

### Close an event
- Click **Close Event** in the detail panel (visible to creator or family admin).
- An inline confirmation appears before closing.
- Closing archives the event to the Past tab.

### Share an event
- Copy icon (🔗) in the detail panel copies the `/events/:id` URL.
- For public events, anyone can open the link without signing in.

---

## Family Tree

Navigate to **Family Tree** in the top nav, or avatar dropdown → **View Family Tree**.

### Logged-out preview
A sample tree is shown so you can explore the feature. Clicking edit controls opens the sign-in prompt.

### Edit the tree (signed in)
- Click any node to select it.
- Sidebar shows: **Save** row (top), then **Add Child / Add Sibling** (below).
- Edit name, birth year, partner name, contact details, then click **Save**.
- **Delete** (🗑 icon) shows an inline confirmation panel — no browser popup.
- Use expand/collapse arrows (▶ / ▼) or the global **Expand all / Collapse all** controls.

### "This is me" — link your profile
- Click any node → click **This is me** to link your user account to that node.
- After navigating away and returning, the node stays visible and shows a **"me"** green badge.
- Partners also have their own **This is me** button.

### Multiple families
- Switching families loads that family's tree.
- If a tree has more than one root node (data anomaly), all roots and their sub-trees are shown — no member is hidden.

---

## Joining a family via link (`/join/:code`)

When someone shares an invite link:

1. You see the **"You've been invited!"** card — always visible at the top.
2. The bottom section adapts to your state:
   - **Not signed in** → sign-in / sign-up form (after signing in, you're added automatically).
   - **Signed in and joining** → spinner while the join is processed.
   - **Success** → green "You've joined the family!" panel with a CTA to go to the family space.
   - **Error** (expired or already used token) → red error box with guidance.
3. No page flash or flicker between states.

---

## Family Settings (`/family-settings`)

Accessible from **avatar dropdown → Family Settings** (visible to family admins only).

### General tab (admin only)
- **Family profile visibility** — controls who can see the family's name and bio page:
  - 🔒 **Private** — members only (default)
  - 👥 **Open to members** — any registered user (direct link only)
  - 🌐 **Public** — anyone (direct link only)
- Family tree and member list are **always members-only** regardless of this setting.

### Members tab
- Lists all family members with their role (Admin / Member) and join date.
- **Remove member** (🗑 icon, admin only) — appears on non-self member rows.
  - Clicking shows an inline confirmation ("Remove [name] from the family? / Remove / Cancel").
  - Admins cannot remove themselves via this button.

### Bio tab (admin only)
- Write a short description of the family (up to 400 characters).
- Saved bio appears on the home page below the family badge.
- Leave blank to hide the bio entirely.

### Invites tab (admin only)
- **Group invite link** — copy and share. Visitors join as Member.
  - Click the rotate icon to invalidate the old link and generate a new one.
- **Personal invite links** — click **+ Generate link** to create a one-time token.
  - Copy and send via WhatsApp. Click ✕ to revoke.

---

## Portal Admin (`/portal`)

Accessible from **avatar dropdown → Portal Admin** — only visible to portal admins.

### Families tab
- All families on the platform with member counts and admin names.
- Expand a row for family ID, invite code, creator name, and a copy button.
- Trash icon permanently deletes a family.

### Users tab
- All registered users (E2E test accounts automatically excluded).
- Email shown under each user's name.
- **Make portal admin** / **Remove portal admin** — platform-wide access management.
- Family admin chips show which families each user admins.
- Trash icon removes the user account.

> **Note:** Portal admin status does NOT automatically grant family admin UI controls. When a portal admin is a plain *member* of a family, they see the same member UI as any other member. Portal admin powers apply only within the `/portal` dashboard.

---

## Confirmation dialogs

All destructive actions use **inline confirmation panels** — the app never shows browser-level popup boxes (`confirm()`). Each confirm shows a red-bordered card with the action description and **Confirm / Cancel** buttons, directly on the page.

Actions with inline confirms:
- Delete Event (in Modify Event form)
- Close Event (in event detail)
- Delete Post / Story (in edit form)
- Delete family tree node (in tree sidebar)
- Remove family member (in Family Settings → Members)
- Leave family (in My Families panel)

---

## Tips

| Tip | Detail |
|---|---|
| **Quick story from dropdown** | Avatar → New Story — creation form opens immediately |
| **Quick event from dropdown** | Avatar → Plan for Event — create form opens immediately |
| **Copy invite link** | My Families → 🔗 icon next to any admin family |
| **Leave a family** | My Families → 🗑 icon (member role only; admins cannot self-remove) |
| **Enable comments on a story** | Edit the story → tick "Allow comments" |
| **Your RSVP on an event** | Invited users see their row highlighted — update status directly |
| **Link a story to an event** | When writing a post, choose an event — the story shows a 🎉 badge |
| **AI generation** | Works for event descriptions and story drafts — provide a title first |
| **Share a public event/story** | Set visibility to 🌐 Public → copy the `/events/:id` or `/stories/:id` URL |
| **Keep a story private** | Set visibility to 🔒 Private — only you can see it (Drafts tab) |
| **Invite one person** | Family Settings → Invites → Generate link → paste into WhatsApp |
| **Remove a member** | Family Settings → Members → 🗑 icon (admin only; not on own row) |
| **Multiple families** | Use My Families panel to switch — no sign-out needed |
| **Portal admin** | Promoted via the Portal Admin dashboard → Users tab |

---

## FAQ

**Can I belong to more than one family?**  
Yes. Use the My Families panel to switch between them. Each has its own stories, events, and tree.

**Who can see my family's content?**  
Only family members by default. Set story/event visibility to Open or Public to share wider.

**Can I leave a family?**  
Yes — open My Families (header menu) and click the 🗑 leave icon on a family where you're a Member. Admins cannot self-remove; ask another admin or a portal admin to help.

**Can I delete someone else's story?**  
Only if you are a family admin or the post author.

**What does "Close Event" do?**  
Archives the event to the Past tab. Linked stories remain unchanged.

**What's the difference between "Copy invite code" and "Copy invite link"?**  
The code is short (e.g. `abc12345`) — people enter it manually on the Join page. The link is the full URL (e.g. `https://…/join/abc12345`) — people click it directly and are taken to the join flow.

**What's the difference between group and personal invite links?**  
Group link: permanent (until rotated), anyone with it can join. Personal: one-time use, expires after use, sent to a specific person.

**Does portal admin mean I'm a family admin everywhere?**  
No. Portal admin gives you access to the `/portal` management dashboard, not family admin controls. If you're a plain member of a family, you see member UI for that family.

**Can non-members comment on a public event?**  
No. Comments require a registered account. Public events are readable by anyone, but only registered users can comment or RSVP.

**Is the family tree ever public?**  
No. The family tree and member list are always members-only — this cannot be changed. Only the family bio/name can be made open or public.

**The AI didn't generate anything — what's wrong?**  
The `ANTHROPIC_API_KEY` must be set as a Supabase Edge Function secret. Contact your family admin or portal admin.

**Google sign-in isn't working in automated tests.**  
Google OAuth requires manual browser interaction and cannot be automated via Playwright.
