# Setting up login + sync (one-time, ~20 minutes)

The code is already wired. What's missing are the two things only you can create:
a **Supabase project** (the database + auth server) and a **Google OAuth client**
(what makes "Continue with Google" legitimate in Google's eyes). Both free.

Until you finish this, the app keeps working exactly as before — local-only.

---

## The two environments

You run **two Supabase projects** (the free tier allows two):

| Environment | Supabase project | Used by | Data |
|---|---|---|---|
| **prod** | `just-ate` | https://just-ate.com | your real log |
| **dev** | `just-ate-dev` | http://localhost:8000 | throwaway test data |

`config.js` picks the environment **by hostname** — localhost always gets dev,
the Pages site always gets prod. There is no switch to flip and no way to
point a local session at production data by accident. Each project also only
whitelists its own site for login (step 4), so the isolation is enforced on
both ends. When you're in dev, Settings shows a "Test environment" banner.

---

## 1. Create the two Supabase projects (~5 min)

1. Go to https://supabase.com → sign up (using GitHub as **i-trenchevski** is easiest).
2. **New project** → name: `just-ate` → set a database password (store it in a
   password manager; you won't need it day-to-day) → Region: **eu-central-1
   (Frankfurt)** — closest to Eindhoven.
3. Repeat for the second project: name `just-ate-dev`, same region.
4. For **each** project, go to **Project Settings → API** and note two values:
   - **Project URL** (like `https://abcdefghij.supabase.co`)
   - **anon public** key (long string)

Free-tier note: projects pause after ~1 week without traffic. Daily logging
keeps prod alive by itself; dev will pause between coding sessions — one click
("Restore") in the dashboard wakes it up in about a minute.

## 2. Create the database tables (~3 min)

Do this **in each project** (dev and prod get identical schemas):

1. Dashboard → **SQL Editor → New query**.
2. Paste the entire contents of `schema.sql` from this repo → **Run**.
3. You should see "Success. No rows returned". Check **Table Editor** — four
   tables: `targets`, `days`, `custom_foods`, `foods_cache`.

## 3. Create the Google OAuth client (~8 min, the fiddly one)

1. Go to https://console.cloud.google.com (any Google account works — this is
   about *your app*, not *your login*).
2. Top bar → project picker → **New project** → name `just-ate` → Create → make
   sure it's selected.
3. **APIs & Services → OAuth consent screen** (Google may call this "Branding"
   under *Google Auth Platform* now):
   - User type: **External** → Create.
   - App name `just-ate`, your email in both email fields → Save through the
     steps (no scopes to add, no test users needed if you **Publish** the app —
     do publish; "unverified app" warnings don't apply to a basic email/profile
     login like this).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, name `just-ate web`.
   - **Authorized JavaScript origins** — add all of:
     - `https://just-ate.com`
     - `https://i-trenchevski.github.io`
     - `http://localhost:8000`
   - **Authorized redirect URIs** — add the Supabase callback of **both**
     projects (one Google client happily serves both environments):
     - `https://PROD-PROJECT-REF.supabase.co/auth/v1/callback`
     - `https://DEV-PROJECT-REF.supabase.co/auth/v1/callback`
     (each project ref is the random part of its Project URL from step 1.4)
   - Create → copy the **Client ID** and **Client secret**.

## 4. Connect Google to Supabase (~4 min)

Do this **in each project**, with the same Client ID and secret:

1. Dashboard → **Authentication → Sign In / Providers → Google** → toggle
   **Enable**, paste the Client ID and Client secret → Save.
2. Still under Authentication → **URL Configuration** — this is where the
   environments get their separate front doors:
   - **`just-ate` (prod):** Site URL `https://just-ate.com/` and the same URL
     in Redirect URLs (keep `https://i-trenchevski.github.io/just-ate/` in
     Redirect URLs too while the old address is still in circulation).
     Do **not** add localhost here.
   - **`just-ate-dev`:** Site URL `http://localhost:8000/` and the same in
     Redirect URLs. Do **not** add the Pages URL here.

## 5. Tell the app about your projects (~1 min)

Open `config.js` and fill in the values from step 1.4 — the prod URL is
already there; add the prod anon key and both dev values:

```js
const CONFIGS = {
  prod: {
    supabaseUrl: 'https://hhqqjjndnzupqdrutwex.supabase.co',
    supabaseAnonKey: 'eyJ...the prod anon key',
  },
  dev: {
    supabaseUrl: 'https://something-else.supabase.co',
    supabaseAnonKey: 'eyJ...the dev anon key',
  },
};
```

Yes, this gets committed publicly — anon keys are designed for that. They can
only do what the row-level-security policies in `schema.sql` allow, which is:
each signed-in user reads/writes their own rows, nothing else.

## 6. Test in dev, then ship prod

Dev first, from the repo folder:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 → Settings shows the amber **Test environment**
banner → **Continue with Google** → after the redirect you should see your
email and "synced". Log something, check Supabase's Table Editor in
`just-ate-dev` — the row appears in `days`. That's the whole loop verified
without touching prod.

Then ship:

```bash
git add config.js
git commit -m "Enable sync (dev + prod environments)"
git push
```

Wait a minute for Pages, open the app (no banner this time — prod), sign in,
then open the same URL on your phone, sign in with the same Google account,
and today's log appears on both.

---

## How the sync behaves (so nothing surprises you)

- **Offline-first.** The app never waits for the network. Log in a supermarket
  basement; it pushes when you're back online or reopen the app.
- **Newest edit wins, per day.** Edit the same day on two devices while both
  are offline and the later edit takes that day. For one person this is the
  right trade; nothing else is ever touched.
- **Log out** removes your log from that device (after a final sync push), so
  the next person at the browser starts fresh — it all returns when you sign
  in again. **Reset everything** wipes the device, not the account — while
  signed in, the cloud copy comes back on the next sync.
- **Deleting a custom food** sticks across devices (tombstones), it won't
  creep back.
- **foods_cache** is shared and append-only: every Open Food Facts result you
  pick is saved to your own database, so it's looked up from the internet once,
  ever. This is the seed of "our own food DB".

## If something misbehaves

- **Google button does nothing / redirect error** → the URL in the error tells
  you which allow-list is missing an entry; recheck steps 3.4 and 4.2
  (origins, redirect URIs, Site URL). Exact strings matter, including the
  trailing `/` on the Pages and localhost URLs.
- **"sync error" in Settings** → open the browser console; a row-level-security
  message means schema.sql didn't fully run in **that** project (step 2 —
  remember it runs twice, once per project).
- **Dev suddenly can't connect after a quiet week** → the free-tier project
  paused; open the Supabase dashboard and click Restore.
- **Wrong environment?** Settings tells you: amber "Test environment" banner
  = dev, no banner = prod. Localhost is always dev by design.
- Auth sessions are stored in localStorage per device *and per project*, so
  being signed in on dev says nothing about prod, and signing out on one
  device doesn't sign out others.
