# ROADMAP — Just Ate

State of the project as of commit `ca2dcb1` (2026-07-06, SW v14). For architecture and
working rules, read CLAUDE.md first.

## Shipped

- Core app: chat-style logging, plate header, history, settings; setup leads with
  Daily targets, estimator collapsed behind a button.
- Supabase sync (offline-first, newest-`u`-wins, tombstones), Google sign-in,
  device-local logout that syncs-then-wipes, GDPR delete-account (RPC) and
  reset-that-truly-wipes (cloud + device, keeps account, race-proof via sync suspension).
- AI food lookup: `parse-food` edge function (claude-haiku-4-5, structured outputs,
  JWT-gated, 50/day/user via atomic `bump_ai_usage`), auto-fires for just-typed unknown
  foods, phrase aliasing makes repeats free, animated "Asking AI…" card.
- Parser hardening: multilingual fraction words, connector-word and >4-word gates on
  fuzzy matching (compound phrases and dish descriptions go to the AI).
- Custom domain just-ate.com (Pages + Cloudflare DNS-only + enforced HTTPS),
  light green theme (WCAG-checked), orange bite-bubble brand icons (fixed-bite export),
  custom dialogs/toasts (`ui.js`), privacy policy page, "Just Ate" display naming.

## Open issues (verified real, not yet fixed)

1. **SDK load failure kills sync for the session** — `sync.js init()` bails before
   registering `online`/`visibilitychange` listeners when the jsdelivr SDK fails to
   load (offline PWA launch); no retry until full reload. Fix: register listeners
   regardless and retry `loadSdk`, or vendor the SDK into the repo + `CORE_ASSETS`.
   *Matters most for the installed phone PWA.*
2. **SW offline fallback too broad; icons not precached** — `sw.js` serves cached
   `index.html` for ANY same-origin miss (not just navigations); `icons/` aren't in
   `CORE_ASSETS`, so offline first-paint can miss them.
3. **`days` pull unbounded** — Supabase's 1000-row default cap will silently truncate
   the pull after ~3 years of daily logging. Fix: paginate with `.range()` or raise
   Max Rows in the dashboard.

## Pending outside the repo

- **Google branding verification**: domain re-verified under the correct account via
  Search Console TXT; after it clears, the consent screen shows "Just Ate" + logo.
  If it stalls, re-submit from the OAuth consent screen (propagation can lag hours).
- Old wrong-account TXT record (`google-site-verification=QutlScZkOLp4…`) can be
  deleted from Cloudflare once the correct account's verification is confirmed.

## Designed next steps (in rough priority order)

1. **Cross-user cache reads for AI lookups** — today `foods_cache` is written on accept
   but never read on the AI path, so a second user pays for a food the first already
   resolved. Design decided with the user: have the edge function ask the model for the
   canonical English name, check `foods_cache` by that key first, and only then call
   for a full estimate — shares nutrition knowledge without exposing anyone's diary text.
2. **USDA FoodData Central grounding (phase 2 of the AI design)** — load a generic-foods
   subset into Supabase; edge function maps phrase → canonical food + grams via the
   model, then prefers USDA measured values over model estimates.
3. **Auto-accept high-confidence AI results** — user is open to it if the confirm tap
   annoys in practice; trivial change in `aiAccept`/`aiLookup` (respect `confidence`).
4. Fix open issues #1–#3 above (in that order; #1 first for the installed PWA).

## Working agreements with the user

- Push-to-prod is the normal flow (their personal app); verify every deploy landed.
- Ask before: theme/brand decisions, anything spending real money, destructive
  semantics changes. Proceed autonomously on the rest.
- Costs stay capped: AI per-user daily limit + Anthropic console spend cap.
