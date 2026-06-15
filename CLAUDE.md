# NaatuPaakam / Family Vibes — Claude Code Instructions

## Dev server
```bash
npm run dev   # starts at http://localhost:3001
```

## After every development change — run Playwright tests

Run the full test suite using Playwright against the local dev server (`http://localhost:3001`).
Use email/password sign-in with the test account:
- Email: `test@naatupakam.family`
- Password: `Test123!`

### Features to test on every change

1. **Authentication**
   - Sign in with email/password via the AuthModal
   - Verify avatar and name appear in the header after sign-in
   - Sign out and verify session clears

2. **Timeline (Home page)**
   - Page loads and shows updates
   - Alternating left/right layout on desktop
   - Trending Topics section is at the bottom

3. **Create post (Admin page)**
   - Navigate to `/admin`
   - Fill in title and hashtags, submit
   - Verify new post appears on the home timeline

4. **AI description generation**
   - On admin form, enter a title and click "✨ Generate with AI"
   - Verify a plain-prose description is returned (no markdown/bullets)

5. **Edit / delete own post**
   - Click a post card to open detail view
   - Edit the title, save, verify updated on timeline
   - Delete the post, verify it disappears

6. **Event timeline branch**
   - Click "🎉 Create Event" in the header
   - Fill in event name, submit
   - Verify amber banner appears below the header
   - Navigate to admin, post an update — verify amber badge on form
   - Return to home, verify the post appears on the amber side-branch
   - Click "✕ Close Event" in the header, confirm
   - Verify the banner disappears and the branch shows "Event closed"

7. **Weekly summary (admin only)**
   - After granting admin: `UPDATE profiles SET is_admin = true WHERE id = '<uuid>';`
   - Verify "Refresh" button on summary section is visible
   - Click refresh, verify AI summary text appears

8. **Hashtag filter**
   - Click a hashtag tag on a post card
   - Verify timeline filters to only show matching posts
   - Click "clear" to reset

### Test credentials
| Field | Value |
|---|---|
| Test user email | `test@naatupakam.family` |
| Test user password | `Test123!` |
| Local URL | `http://localhost:3001` |

### Notes
- Google sign-in cannot be automated — test manually
- Facebook OAuth is not yet configured
- The dev server must be running before Playwright tests start
