---
name: ship
description: Release a change to just-ate.com — pre-flight checks, SW version bump, commit, push, and verify the deploy actually landed in production. Use for every deploy of this project.
---

# Ship a change to just-ate.com

Pushing `main` deploys to production via GitHub Pages. Never skip verification —
the Pages deploy occasionally flakes, and the service worker only refetches when
`SW_VERSION` changes.

## 1. Pre-flight (always)

```bash
node --check app.js && node --check sync.js && node --check parser.js && node --check ui.js && node --check sw.js
node parser.test.js && node sync.test.js
```

If `supabase/functions/parse-food/index.ts` changed: `deno check` it AND deploy it
**before** pushing app code that depends on it (see the edge-function skill).

## 2. Bump the service worker

Increment `SW_VERSION` in `sw.js` (`just-ate-vN` → `vN+1`) whenever any runtime file
changed. Add brand-new runtime files to `CORE_ASSETS`.

## 3. Commit & push

Descriptive commit message; body explains why. Then `git push` (that IS the deploy).

## 4. Verify it landed (background task)

```bash
for i in $(seq 1 30); do
  sleep 12
  if curl -s "https://just-ate.com/sw.js?v=$i" | grep -q "just-ate-vN"; then   # new version
    echo DEPLOYED
    # grep live files for a marker unique to this change, e.g.:
    curl -s "https://just-ate.com/app.js?v=$i" | grep -c "someNewFunction"
    exit 0
  fi
done
echo CDN-TIMEOUT; exit 1
```

The `?v=$i` query busts the Fastly cache. Expect ~1–3 minutes.

## If the deploy fails or times out

1. `gh run list --repo i-trenchevski/just-ate --limit 3` — look for
   `pages build and deployment` with conclusion `failure`.
2. Transient "Deployment failed, try again later" → `gh run rerun <id> --failed`.
3. Rerun stuck `queued` >10 min → `gh run cancel <id>` then
   `gh api -X POST repos/i-trenchevski/just-ate/pages/builds` (fresh build).

## Risky changes get a review first

For diffs touching sync, reset/delete flows, or AI-spending paths: before pushing,
run an adversarial review (subagent or workflow) over `git diff`, and prove any
race-condition fixes with a harness (see the sync-harness skill). This project's
history shows these reviews catch deploy-blocking bugs.
