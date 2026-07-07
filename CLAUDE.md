# CLAUDE.md — Just Ate

Chat-style calorie/macro tracker. Vanilla JS PWA, **no build step, no framework,
no bundler** — the repo root IS the deployed site. Display name is **"Just Ate"**;
code, repo, and domain use `just-ate`.

- **Live**: https://just-ate.com (GitHub Pages, branch `main`, root; `git push` = deploy;
  the old `i-trenchevski.github.io/just-ate/` URL redirects here)
- **Dev**: `python3 -m http.server 8000` → http://localhost:8000 (hostname selects the
  dev Supabase project automatically — you can't touch prod data from localhost)

## Non-negotiable release rules

1. **Bump `SW_VERSION` in sw.js on every release** (currently v14). New runtime files
   also go into `CORE_ASSETS`.
2. **Run the checks** before any push — there is no CI:
   `node --check <changed .js files> && node parser.test.js && node sync.test.js`
   (35 + 10 tests). `deno check supabase/functions/parse-food/index.ts` when the edge
   function changes.
3. **Verify the deploy landed** — use the `/ship` skill (poll `sw.js` for the new
   version, then grep the live files for your change markers).
4. For changes that can destroy data or spend money (sync, reset/delete flows, AI
   spending paths): run an adversarial review agent over the diff before pushing, and
   prove races with the harness in the `/sync-harness` skill. This habit has caught
   deploy-blocking bugs on this project repeatedly.

## File map

| File | Role |
|---|---|
| `app.js` | All views + actions. Views: setup / main (plate + chat) / history / settings. Event delegation on `document` via `data-action`. |
| `parser.js` | Deterministic entry parser (`createParser`). Exact/alias lookup, fraction words, fuzzy matching gates (see below). |
| `foods.js` | Built-in food DB (`per100` per raw weight for grains/legumes/meat; `piece` grams for countables). |
| `sync.js` | Offline-first Supabase sync (IIFE, `window.Sync`). localStorage is the working copy; newest-`u`-wins per item; tombstones for deleted customs. |
| `ui.js` | Themed `<dialog>` system: `UI.alert/confirm/prompt/menu/toast`. **Never use native alert/confirm/prompt.** |
| `config.js` | `CONFIGS.prod/dev` + hostname switch. Anon keys are public by design (RLS protects data). **Never commit service_role keys.** |
| `sw.js` | Network-first SW; `res.ok` guard so errors never overwrite cache. |
| `schema.sql` | Supabase schema. **Append-only sections** — on existing projects run ONLY the new section in the SQL editor (the whole file errors on existing tables). |
| `supabase/functions/parse-food/` | Edge function: AI food lookup (see `/edge-function` skill). |
| `privacy.html` | Privacy policy (linked from Google OAuth consent screen — keep accurate). |

## Invariants that exist because of real bugs (don't regress)

- **Async completions must not full-render.** `render()` rebuilds `#app.innerHTML` and
  wipes in-progress typing + focus. AI results patch only their resolver card
  (`patchResolver`), sync status pings patch `#acct-slot` / `#sync-section`, and
  `renderMain` preserves input drafts across renders. Any new async UI must follow this.
- **Parser fuzzy-match gates**: connector words (`with/so/со/sa/...`) or >4 words →
  no contained-word/prefix matching; leave `ok:false` so the AI reads the whole phrase.
  Exact name/alias matches always run first.
- **`normName` keeps letters in every script** (Cyrillic phrases are valid custom-food
  keys — that's how phrase aliasing works).
- **Sync guards**: `syncNow()` returns a joinable promise (never no-ops on re-entry);
  `doSync`/`flush` re-check `user`/`suspended` after every await; `wipeData()` suspends
  sync across its whole critical section; `signOut` is scope `'local'` and force-removes
  the `sb-*-auth-token` if the server call fails; logout awaits a full sync then wipes
  the device; delete-account = separate RPC (`delete_account()`, security definer).
- **AI spend rules**: auto-lookup fires only from `onLog` for just-typed unknown items,
  signed-in + online; accepted results write to custom foods + shared `foods_cache`;
  quantity-free phrases get aliased so repeats are free; 50/day/user cap via `ai_usage`
  + `bump_ai_usage()` (service-role only).
- **Destructive dialogs**: red buttons, focus defaults to Cancel; delete-account keeps
  the type-DELETE gate.

## Infrastructure

- **Supabase**: prod `hhqqjjndnzupqdrutwex` (just-ate), dev `zhmztlzefkajfnuevcxc`
  (just-ate-dev), both eu-central-1. CLI is authenticated on this machine.
  `ANTHROPIC_API_KEY` is set as a function secret in both projects (never in the repo).
- **DNS**: Cloudflare, records must stay **DNS-only (grey cloud)** — proxying breaks
  GitHub Pages' certificate. A `google-site-verification` TXT proves domain ownership.
- **Google OAuth**: consent screen app name "Just Ate", homepage + privacy URLs set;
  sign-in flows through the Supabase callback (Google Cloud config rarely needs touching).
- **Pages deploys** occasionally flake ("Deployment failed, try again later") —
  `gh run rerun <id> --failed`; if a rerun sits queued >10 min, cancel and
  `gh api -X POST repos/i-trenchevski/just-ate/pages/builds`.

## Where things stand / what's next

See **ROADMAP.md** for completed work, the 3 known open sync issues, and the designed
next steps (USDA grounding, cross-user cache reads). The user's auto-memory
(`sync-layer-known-issues`) mirrors the open-bug list.
