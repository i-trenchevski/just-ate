---
name: sync-harness
description: Test sync.js changes (races, wipes, logout, merge) by running the REAL module in node against a fake Supabase client with controllable promise timing. Use before shipping any sync.js change that could lose or resurrect data.
---

# Sync harness — prove sync.js changes with executable evidence

`sync.test.js` covers only the pure `mergeStates`. Everything else (flush races,
logout/wipe/delete flows, in-flight-pull resurrection) is verified by loading the real
`sync.js` in node with stubbed globals and a fake Supabase client whose promises you
gate manually. This pattern has repeatedly turned "plausible" review findings into
reproduced-or-refuted facts on this project — write a scenario per risky timing.

## Skeleton (adapt per scenario; run from the scratchpad, don't commit)

```js
const SYNC = '/Users/inestrenchevski/Downloads/just-ate/sync.js';
const CFG = { supabaseUrl: 'https://hhqqjjndnzupqdrutwex.supabase.co', supabaseAnonKey: 'k' };

function makeEnv(opts = {}) {          // opts: {remote, gateSelects, offline, failDelete, signOut}
  const upserts = [], deletes = [], gates = [];
  function selectResult(table) {       // shape rows from opts.remote like doSync expects
    const data = table === 'targets' ? (opts.remote.targets ?? null)
      : table === 'days' ? Object.entries(opts.remote.days).map(([day, v]) => ({ day, ...v }))
      : Object.entries(opts.remote.custom).map(([key, v]) => ({ key, food: v, u: v.u }));
    if (opts.gateSelects) {            // hold the response until the test releases it
      let res; const p = new Promise(r => { res = r; });
      gates.push(() => res({ data, error: null }));
      p.maybeSingle = () => p; return p;
    }
    if (opts.offline) return Promise.reject(new Error('Failed to fetch'));
    const p = Promise.resolve({ data, error: null }); p.maybeSingle = () => p; return p;
  }
  const client = {
    auth: {
      onAuthStateChange() { return { data: { subscription: {} } }; },
      async getSession() { return { data: { session: { user: { id: 'u1' } } } }; },
      signOut: opts.signOut || (async () => ({ error: null })),
    },
    from(table) {
      return {
        select() { return { eq: () => selectResult(table) }; },
        delete() { return { eq: () => { deletes.push(table); return Promise.resolve({ error: opts.failDelete === table ? new Error('boom') : null }); } }; },
        upsert(rows) { upserts.push({ table, rows }); return Promise.resolve({ error: null }); },
      };
    },
    rpc() { return Promise.resolve({ error: null }); },
  };
  delete require.cache[require.resolve(SYNC)];
  global.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  global.window = { supabase: { createClient: () => client }, addEventListener() {} };
  global.document = { addEventListener() {}, head: { appendChild() {} }, createElement() { throw new Error('no SDK load in tests'); } };
  require(SYNC);
  return { Sync: global.window.Sync, upserts, deletes, releaseGates: () => gates.forEach(g => g()) };
}
```

## How to use it

1. Build `state` + `hooks = { getState, replaceState, onChange }` mirroring app.js.
2. `await Sync.init(CFG, hooks)` — with `gateSelects` the boot sync is now in flight.
3. Interleave the operation under test (wipe, logout, edit) with `releaseGates()` to
   force the exact timing a reviewer flagged.
4. Assert on `state` (nothing resurrected), `upserts` (nothing re-uploaded), `deletes`,
   and that sync isn't left suspended (`Sync.syncNow()` still runs after).

## Existing scenario sets to crib from

Past sessions proved: logout-during-in-flight-sync, offline logout token removal,
wipe-vs-slow-pull resurrection, flush mid-flight edit races, reset-then-logout stray
flags. If you change `doSync`/`flush`/`wipeData`/`signOut`/`logOut` semantics, re-prove
the relevant scenarios — the guards (`suspended`, post-await `user` checks, per-key
un-dirty) exist because each of these failed once.
