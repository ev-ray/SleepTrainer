# Sleep Log

A private, installable web app for logging our baby's naps and nights while
sleep training (extinction / "cry it out"). Three people, three iPhones, one
shared live log, plus a daily schedule and a "Hold steady" button for the hard
moments.

- **Frontend:** Vite + Preact, installable PWA, works offline and syncs when back online.
- **Backend:** Supabase (Postgres, email-code sign-in, row-level security, realtime).
- **Hosting:** GitHub Pages via GitHub Actions.
- **Cost:** $0 on the free tiers.

Try it without any setup: `npm install && npm run dev`, then open
`http://localhost:5173/?demo` (demo mode uses sample data stored only in your browser).

---

## One-time setup (about 20 minutes)

### 1. Supabase project
1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Edit [`supabase/members.sql`](supabase/members.sql) with the three real emails and names, then run it too.
   Only these emails can ever create an account or read data.
4. **Authentication → Email Templates**: in both **Magic Link** and **Confirm signup**, add the code to the body, e.g.
   ```html
   <h2>Your Sleep Log code</h2>
   <p style="font-size:28px;letter-spacing:4px"><b>{{ .Token }}</b></p>
   ```
   (The app signs in with this code rather than the link — on iPhone, a home-screen app has
   separate storage from Safari, so a link would sign in Safari instead of the app.)
5. **Authentication → Sign In / Providers → Email**: keep Email enabled. Under **Authentication → Sessions**,
   leave "time-box" and "inactivity timeout" off, so nobody gets signed out.
6. **Email delivery:** Supabase's built-in email only sends to members of your Supabase organization and is
   rate-limited. Either:
   - invite your wife and mom to the Supabase organization (Organization → Team), or
   - set up free custom SMTP (**Authentication → Emails → SMTP settings**) — e.g. Gmail with an
     [app password](https://myaccount.google.com/apppasswords) (`smtp.gmail.com`, port 465), or Resend.
7. **Project Settings → API**: copy the **Project URL** and the **publishable / anon key**.
   Both are safe to ship in the app; the data is protected by row-level security.

### 2. GitHub Pages
1. Create a GitHub repo and push this folder to `main`.
2. **Settings → Pages → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables**: add `SUPABASE_URL` and `SUPABASE_KEY`.
4. Re-run the "Deploy to GitHub Pages" action. The app will be at `https://<user>.github.io/<repo>/`.
5. Back in Supabase, **Authentication → URL Configuration**: set Site URL to that address.

Free GitHub Pages needs a public repo. That's fine — no data or secrets live in the code — but if
you'd rather keep the code private, Cloudflare Pages or Netlify work the same way for free
(build command `npm run build`, output `dist`, same two environment variables prefixed `VITE_`).

### 3. On each iPhone
1. Open the link in **Safari** → Share → **Add to Home Screen**.
2. Open it from the home screen, enter your email, type the code from the email. That's the last time.
3. Guide tab → Settings: set his birthday, night 1 of training, and the night-feed plan you've agreed with your pediatrician.

---

## Local development
```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

## Where things live
| | |
|---|---|
| `src/content/guide.js` | All advice text: checklists, playbook, research, Hold steady copy |
| `src/lib/age.js` | Age-banded benchmarks (wake windows, naps, sleep totals) |
| `src/lib/schedule.js` | Next nap / bedtime logic |
| `src/lib/store.js` | Sync: local-first writes, offline outbox, realtime |
| `src/components/` | Screens |
| `supabase/` | Database schema and the family allowlist |

## Access control
- Sign-up is blocked by a database trigger unless the email is in `members`.
- Every table has row-level security requiring the signed-in email to be in `members`.
- To revoke someone, delete their row in `members` (Table Editor). It takes effect immediately.
