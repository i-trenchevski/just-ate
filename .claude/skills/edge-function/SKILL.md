---
name: edge-function
description: Work on the parse-food Supabase Edge Function (AI food lookup) — check, deploy to dev+prod, secrets, schema changes, and how to test it. Use whenever supabase/functions or schema.sql changes.
---

# parse-food edge function (AI food lookup)

`supabase/functions/parse-food/index.ts` — Deno, called by `aiLookup()` in app.js.
Holds the Anthropic key (function secret), requires a signed-in user's JWT, enforces
a 50/day/user cap via the `ai_usage` table + `bump_ai_usage()` RPC (atomic,
service-role only), calls `claude-haiku-4-5` with a structured-output JSON schema.

## Projects

| env | ref | used by |
|---|---|---|
| prod | `hhqqjjndnzupqdrutwex` | just-ate.com |
| dev | `zhmztlzefkajfnuevcxc` | localhost:8000 |

The CLI is authenticated on this machine (`supabase login` done; project linked).

## Change → deploy cycle

```bash
deno check supabase/functions/parse-food/index.ts
supabase functions deploy parse-food --project-ref zhmztlzefkajfnuevcxc   # dev first
supabase functions deploy parse-food --project-ref hhqqjjndnzupqdrutwex   # then prod
```

**Deploy the function BEFORE pushing app code that depends on a new response field** —
they release independently.

## Contract with the client (keep in sync with app.js)

Request: `POST /functions/v1/parse-food`, headers `apikey` (anon) + `Authorization:
Bearer <user JWT>`, body `{text}` (≤200 chars). Response: `{items: [{food_name_en,
grams, piece_grams, per100:{kcal,p,c,f}, confidence, note, phrase_names_quantity}],
remaining}`. Errors: 401 not signed in · 429 daily cap · 400 bad input · 5xx upstream.
Anon key alone must always yield 401 (`auth.getUser()` gate) — never weaken this.

## Secrets

`ANTHROPIC_API_KEY` is set per project. Rotate with:
`supabase secrets set ANTHROPIC_API_KEY=... --project-ref <ref>` (user runs this —
the key must not pass through chat or the repo). Spend cap lives in the Anthropic console.

## Schema changes (`schema.sql`)

The file is append-only documentation of the whole schema. Existing projects must run
**only the new section** in the SQL editor (dashboard) of BOTH projects — running the
whole file errors on existing tables and rolls everything back. Mark new sections with
the "run ONLY this section" comment convention already used in the file.

## Testing without a browser

- Unauthorized path: `curl -X POST <url> -H "apikey: <anon>"` → expect 401.
- Full path needs a real user JWT (Google OAuth) — test in the browser on localhost
  (dev project) with the console network tab, or temporarily log the function via
  `supabase functions logs parse-food --project-ref <ref>`.
- Prompt/schema experiments: the model behavior can be probed directly with the
  Anthropic API using the same system prompt + schema from index.ts.
