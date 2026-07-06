/* just-ate — optional cloud sync (Supabase).
   Inert until CONFIG.supabaseUrl is filled in. Offline-first: localStorage
   stays the working copy; this module pushes changed rows up (debounced)
   and pull-merges on sign-in / focus / coming back online.

   Conflict rule: every day, custom food and the targets object carries `u`
   (ms timestamp of last local edit). Newest `u` wins, per item. Deleted
   custom foods become tombstones ({deleted:true, u}) so a deletion on one
   device isn't resurrected by another. */

const Sync = (() => {
  const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  let client = null;
  let user = null;
  let hooks = null;          // { getState, replaceState, onChange }
  let status = 'off';        // off | signedout | syncing | ok | error
  let lastSync = 0;
  let syncPromise = null;    // in-flight syncNow — callers join it, never race it
  let flushPromise = null;   // in-flight debounced push — wipeData awaits it
  let authStorageKey = '';   // supabase's own localStorage key, for forced sign-out
  let suspended = false;      // wipe in progress: block new sync, and no-op in-flight writes
  let pushTimer = null;
  const dirty = { targets: false, days: new Set(), custom: new Set() };

  // ------------------------------------------------------------ pure merge
  // Exported for tests. Returns the merged state, which keys must be pushed
  // up (local newer), and whether local storage changed (remote newer).
  function mergeStates(local, remote) {
    const u = (o) => (o && o.u) || 0;
    const merged = { ...local, targets: null, days: {}, custom: {} };
    const push = { targets: false, days: [], custom: [] };
    let changedLocal = false;

    if (u(local.targets) >= u(remote.targets)) {
      merged.targets = local.targets;
      if (local.targets && (!remote.targets || u(local.targets) > u(remote.targets))) push.targets = true;
    } else {
      merged.targets = remote.targets;
      changedLocal = true;
    }

    for (const kind of ['days', 'custom']) {
      const L = local[kind] || {}, R = remote[kind] || {};
      for (const k of new Set([...Object.keys(L), ...Object.keys(R)])) {
        const l = L[k], r = R[k];
        if (l && (!r || u(l) > u(r))) {
          merged[kind][k] = l;
          push[kind].push(k);
        } else if (r && (!l || u(r) > u(l))) {
          merged[kind][k] = r;
          changedLocal = true;
        } else {
          merged[kind][k] = l; // equal timestamps: keep local, no traffic
        }
      }
    }
    return { merged, push, changedLocal };
  }

  // ------------------------------------------------------------ plumbing
  function loadSdk() {
    if (window.supabase) return Promise.resolve();
    return new Promise((ok, bad) => {
      const s = document.createElement('script');
      s.src = SDK;
      s.onload = ok;
      s.onerror = () => bad(new Error('supabase sdk failed to load'));
      document.head.appendChild(s);
    });
  }

  const notify = () => { if (hooks && hooks.onChange) hooks.onChange(); };
  const bail = (e) => { console.warn('[sync]', e); status = 'error'; notify(); };
  const chk = ({ error }) => { if (error) throw error; };

  async function init(cfg, h) {
    hooks = h;
    if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) { status = 'off'; return; }
    try { authStorageKey = 'sb-' + new URL(cfg.supabaseUrl).hostname.split('.')[0] + '-auth-token'; } catch (e) { /* best effort */ }
    try { await loadSdk(); } catch (e) { return bail(e); }

    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    client.auth.onAuthStateChange((_ev, session) => {
      const before = user && user.id;
      user = (session && session.user) || null;
      status = user ? 'ok' : 'signedout';
      notify();
      if (user && user.id !== before) syncNow();
    });

    const { data } = await client.auth.getSession();
    user = (data.session && data.session.user) || null;
    status = user ? 'ok' : 'signedout';
    notify();
    if (user) syncNow();

    window.addEventListener('online', () => user && syncNow());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && user) syncNow();
    });
  }

  // ------------------------------------------------------------ auth
  async function signIn() {
    if (!client) return;
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
  }

  async function signOut() {
    if (!client) return;
    // scope 'local': only this device — the default ('global') would revoke
    // every device's refresh token.
    const { error } = await client.auth.signOut({ scope: 'local' }).catch((e) => ({ error: e }));
    if (error && authStorageKey) {
      // Server unreachable: the SDK keeps the session in localStorage, which
      // would quietly restore the account on the next page load. The device
      // must end up signed out regardless — drop the session ourselves.
      try { localStorage.removeItem(authStorageKey); } catch (e) { /* ignore */ }
    }
    user = null;
    status = 'signedout';
    dirty.targets = false; dirty.days.clear(); dirty.custom.clear();
    notify();
  }

  // Access token for calling edge functions as the signed-in user.
  async function getToken() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return (data && data.session && data.session.access_token) || null;
  }

  // GDPR erasure. The delete_account() RPC (see schema.sql) is security
  // definer: it deletes the auth.users row, and the on-delete-cascade FKs
  // take every personal row (targets, days, custom_foods) with it.
  async function deleteAccount() {
    if (!client || !user) return { ok: false, error: 'Not signed in.' };
    const { error } = await client.rpc('delete_account');
    if (error) {
      // PGRST202 = the RPC doesn't exist server-side (schema.sql not applied).
      const msg = error.code === 'PGRST202'
        ? 'Account deletion isn’t enabled on the server yet. Nothing was deleted.'
        : error.message;
      return { ok: false, error: msg };
    }
    await client.auth.signOut({ scope: 'local' }).catch(() => {});
    user = null;
    status = 'signedout';
    notify();
    return { ok: true };
  }

  // Wipe this account's data (days, custom foods, targets) from the server AND
  // this device, keeping the account and sign-in. Row-level security scopes
  // every delete to the signed-in user; foods_cache is shared/generic and is
  // left untouched. Sync is suspended across the whole critical section — no
  // new pull/push can start, any in-flight one is awaited (and no-ops its write
  // because `suspended` is set), the rows are deleted, then the local copy is
  // cleared before sync resumes — so nothing resurrects or re-uploads the data.
  async function wipeData() {
    if (!client || !user) return { ok: false, error: 'Not signed in.' };
    suspended = true;
    clearTimeout(pushTimer);
    dirty.targets = false; dirty.days.clear(); dirty.custom.clear();
    try { await syncPromise; } catch (e) { /* in-flight pull settles; it skips its write */ }
    try { await flushPromise; } catch (e) { /* in-flight push settles before we delete */ }
    try {
      const uid = user.id;
      const results = await Promise.all([
        client.from('days').delete().eq('user_id', uid),
        client.from('custom_foods').delete().eq('user_id', uid),
        client.from('targets').delete().eq('user_id', uid),
      ]);
      for (const r of results) if (r.error) throw r.error;
    } catch (e) {
      suspended = false;
      status = 'error'; notify();
      return { ok: false, error: (e && e.message) || 'Could not clear your cloud data.' };
    }
    hooks.replaceState({ targets: null, days: {}, custom: {} });  // clear the device while still suspended
    lastSync = Date.now(); status = 'ok';
    suspended = false;
    notify();
    return { ok: true };
  }

  // ------------------------------------------------------------ push
  function queuePush(kind, key) {
    if (kind === 'targets') dirty.targets = true;
    else if (kind === 'day') dirty.days.add(key);
    else if (kind === 'custom') dirty.custom.add(key);
    if (!client || !user) return; // stays dirty; first sync after sign-in covers it
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { flushPromise = flush().finally(() => { flushPromise = null; }); }, 1200);
  }

  async function flush() {
    if (!client || !user || suspended) return;
    const s = hooks.getState();
    // Drop flags whose local object no longer exists (a reset wiped it) —
    // there is nothing to push, and a stuck flag would make `pending` lie.
    if (dirty.targets && !s.targets) dirty.targets = false;
    for (const k of [...dirty.days]) if (!s.days[k]) dirty.days.delete(k);
    for (const k of [...dirty.custom]) if (!s.custom[k]) dirty.custom.delete(k);
    try {
      status = 'syncing'; notify();
      // After each awaited upsert, un-dirty only what was actually pushed and
      // hasn't been edited since — an edit landing mid-flight keeps its flag
      // and goes up with the debounced follow-up flush.
      if (dirty.targets && s.targets) {
        const pushedU = s.targets.u || 0;
        chk(await client.from('targets')
          .upsert({ user_id: user.id, data: s.targets, u: pushedU }));
        const cur = hooks.getState().targets;
        if (!cur || (cur.u || 0) <= pushedU) dirty.targets = false;
      }
      const dayRows = [...dirty.days].filter((k) => s.days[k]).map((k) => ({
        user_id: user.id, day: k,
        entries: s.days[k].entries, completed: !!s.days[k].completed,
        u: s.days[k].u || 0,
      }));
      if (dayRows.length) {
        chk(await client.from('days').upsert(dayRows));
        const cur = hooks.getState().days;
        dayRows.forEach((r) => { if (!cur[r.day] || (cur[r.day].u || 0) <= r.u) dirty.days.delete(r.day); });
      }
      const foodRows = [...dirty.custom].filter((k) => s.custom[k]).map((k) => ({
        user_id: user.id, key: k, food: s.custom[k], u: s.custom[k].u || 0,
      }));
      if (foodRows.length) {
        chk(await client.from('custom_foods').upsert(foodRows));
        const cur = hooks.getState().custom;
        foodRows.forEach((r) => { if (!cur[r.key] || (cur[r.key].u || 0) <= r.u) dirty.custom.delete(r.key); });
      }
      lastSync = Date.now(); status = 'ok';
    } catch (e) { return bail(e); }
    notify();
  }

  // ------------------------------------------------------------ pull + merge
  // Returns a promise that settles when sync is done. A second call while one
  // is in flight joins it instead of racing it — awaiting syncNow() always
  // means "a full pull+merge+push attempt has finished".
  function syncNow() {
    if (!client || !user || suspended) return Promise.resolve();
    if (!syncPromise) syncPromise = doSync().finally(() => { syncPromise = null; });
    return syncPromise;
  }

  async function doSync() {
    status = 'syncing'; notify();
    try {
      const [t, d, c] = await Promise.all([
        client.from('targets').select('data,u').eq('user_id', user.id).maybeSingle(),
        client.from('days').select('day,entries,completed,u').eq('user_id', user.id),
        client.from('custom_foods').select('key,food,u').eq('user_id', user.id),
      ]);
      chk(t); chk(d); chk(c);

      // Signed out, account deleted, or a wipe started while the selects were
      // in flight — writing the stale snapshot back would resurrect erased data.
      if (!user || suspended) return;

      const remote = { targets: null, days: {}, custom: {} };
      if (t.data) remote.targets = { ...t.data.data, u: Number(t.data.u) || 0 };
      for (const r of d.data || []) {
        remote.days[r.day] = { entries: r.entries || [], completed: !!r.completed, u: Number(r.u) || 0 };
      }
      for (const r of c.data || []) {
        remote.custom[r.key] = { ...r.food, u: Number(r.u) || 0 };
      }

      const { merged, push, changedLocal } = mergeStates(hooks.getState(), remote);
      if (changedLocal) hooks.replaceState(merged);

      if (push.targets) dirty.targets = true;
      push.days.forEach((k) => dirty.days.add(k));
      push.custom.forEach((k) => dirty.custom.add(k));

      if (dirty.targets || dirty.days.size || dirty.custom.size) {
        await flush();
      } else {
        lastSync = Date.now(); status = 'ok'; notify();
      }
    } catch (e) { bail(e); }
  }

  // ------------------------------------------------------------ shared food cache
  // Every Open Food Facts pick is written here once, for everyone, forever.
  async function cacheGet(key) {
    if (!client) return null;
    try {
      const { data, error } = await client.from('foods_cache').select('food').eq('key', key).maybeSingle();
      if (error) return null;
      return data ? data.food : null;
    } catch { return null; }
  }

  function cachePut(key, food) {
    if (!client || !user) return;
    client.from('foods_cache')
      .upsert({ key, food }, { onConflict: 'key', ignoreDuplicates: true })
      .then(({ error }) => { if (error) console.warn('[sync] cache put', error); });
  }

  return {
    init, signIn, signOut, deleteAccount, wipeData, getToken, queuePush, syncNow, cacheGet, cachePut, mergeStates,
    get user() { return user; },
    get status() { return status; },
    get lastSync() { return lastSync; },
    get pending() { return !!(dirty.targets || dirty.days.size || dirty.custom.size); },
  };
})();

if (typeof window !== 'undefined') window.Sync = Sync;
if (typeof module !== 'undefined') module.exports = { mergeStates: Sync.mergeStates };
