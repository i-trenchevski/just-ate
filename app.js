/* just-ate — app logic.
   Views: setup (first run) · main (plate + chat) · history · settings.
   State lives in localStorage; logged entries bake their numbers in, so
   editing foods.js later never rewrites history. */

const LS_KEY = 'just-ate-v1';
const app = document.getElementById('app');

// ---------------------------------------------------------------- state
let state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && typeof s === 'object') return { targets: null, custom: {}, days: {}, ...s };
  } catch (e) { /* fall through */ }
  return { targets: null, custom: {}, days: {} };
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

// Stamp an item as edited-now and tell sync about it (no-op when sync is off).
function touch(kind, key) {
  const u = Date.now();
  if (kind === 'day' && state.days[key]) state.days[key].u = u;
  else if (kind === 'custom' && state.custom[key]) state.custom[key].u = u;
  else if (kind === 'targets' && state.targets) state.targets.u = u;
  if (window.Sync) Sync.queuePush(kind, key);
}

// Custom foods minus tombstones (deleted-on-another-device markers).
function liveCustom() {
  const out = {};
  for (const [k, f] of Object.entries(state.custom)) if (!f.deleted) out[k] = f;
  return out;
}

const parser = createParser(FOODS, liveCustom);

// ---------------------------------------------------------------- dates
function dayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function niceDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const label = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return key === dayKey() ? `Today · ${label}` : label;
}

// Any past day left open closes itself. (Empty days are kept but marked
// completed — deleting them would let a synced copy resurrect them. History
// only shows days that have entries.)
function rollover() {
  const today = dayKey();
  let changed = false;
  for (const k of Object.keys(state.days)) {
    const d = state.days[k];
    if (k < today && !d.completed) {
      d.completed = true;
      touch('day', k);
      changed = true;
    }
  }
  if (changed) save();
}
function today() {
  const k = dayKey();
  if (!state.days[k]) state.days[k] = { entries: [], completed: false };
  return state.days[k];
}

// ---------------------------------------------------------------- totals
function dayTotals(d) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const e of d.entries) for (const it of e.items) if (it.ok) {
    t.kcal += it.kcal; t.p += it.p; t.c += it.c; t.f += it.f;
  }
  t.p = Math.round(t.p); t.c = Math.round(t.c); t.f = Math.round(t.f);
  return t;
}
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
function barClass(eaten, target) {
  if (!target) return '';
  const r = eaten / target;
  return r > 1.15 ? 'over' : r > 1 ? 'warn' : '';
}
function barW(eaten, target) { return target ? Math.min(100, (eaten / target) * 100) : 0; }

// ---------------------------------------------------------------- routing
window.addEventListener('hashchange', render);
function route() {
  if (!state.targets) return 'setup';
  const h = location.hash.replace('#', '');
  return ['settings', 'history'].includes(h) ? h : 'main';
}
function render() {
  const r = route();
  if (r === 'setup') return renderTargetsForm(true);
  if (r === 'settings') return renderTargetsForm(false);
  if (r === 'history') return renderHistory();
  renderMain();
}

// ---------------------------------------------------------------- icons
const ICONS = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

// The account chip lives at the top right of every view.
function acctChip() {
  if (!window.Sync || Sync.status === 'off') return '';
  const u = Sync.user;
  if (!u) {
    // 'signedout' means the SDK is up and signIn() will work; on 'error' with
    // no user (SDK never loaded) the button would silently do nothing.
    return Sync.status === 'signedout'
      ? `<button class="acct-chip" data-action="google-login">Log in ${ICONS.user}</button>` : '';
  }
  const meta = u.user_metadata || {};
  const first = ((meta.full_name || meta.name || u.email || '').split('@')[0].trim().split(/\s+/)[0]) || 'Account';
  const av = meta.avatar_url
    ? `<img src="${esc(meta.avatar_url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`
    : ICONS.user;
  return `<button class="acct-chip" data-action="nav" data-to="settings" title="${esc(u.email || '')}">${esc(first)} ${av}</button>`;
}

// ---------------------------------------------------------------- main view
let resolverUI = {}; // transient per-item UI state: `${entryId}:${idx}` -> {mode, results}

function renderMain() {
  rollover();
  const d = today();
  const t = state.targets;
  const tot = dayTotals(d);
  const left = t.kcal - tot.kcal;

  const macros = [['Protein', 'p'], ['Carbs', 'c'], ['Fat', 'f']].map(([label, k]) => `
    <div>
      <div class="macro-name">${label}</div>
      <div class="macro-val"><b>${tot[k]}</b><span> / ${t[k]} g</span></div>
      <div class="bar"><i class="${barClass(tot[k], t[k])}" style="width:${barW(tot[k], t[k])}%"></i></div>
    </div>`).join('');

  const chat = d.entries.length
    ? d.entries.map(entryHTML).join('')
    : `<div class="chat-empty">Type what you ate, like<br><b>2 eggs</b> or <b>30 gr whey protein, 150gr blueberries</b></div>`;

  const composer = d.completed
    ? `<div class="sysmsg">Day completed — it's in your history. <button class="reopen" data-action="reopen">Reopen</button></div>`
    : `<form class="composer-row" id="logform">
         <input type="text" id="loginput" placeholder="What did you eat?" autocomplete="off" enterkeyhint="send">
         <button class="send" type="submit" aria-label="Log it">${ICONS.send}</button>
       </form>
       <button class="complete" data-action="complete" ${d.entries.length ? '' : 'disabled'}>Complete the day</button>`;

  app.innerHTML = `
    <header class="plate">
      <div class="plate-card">
        <div class="plate-row">
          <span class="plate-date">${niceDate(dayKey())}</span>
          <span class="plate-nav">
            <span id="acct-slot">${acctChip()}</span>
            <button class="icon-btn" data-action="nav" data-to="history" aria-label="History">${ICONS.history}</button>
            <button class="icon-btn" data-action="nav" data-to="settings" aria-label="Settings">${ICONS.gear}</button>
          </span>
        </div>
        <div class="kcal-left ${left < 0 ? 'over' : ''}">${left >= 0 ? fmt(left) : '+' + fmt(-left)}<small>${left >= 0 ? 'kcal left' : 'kcal over'}</small></div>
        <div class="kcal-sub">${fmt(tot.kcal)} / ${fmt(t.kcal)} kcal</div>
        <div class="bar thick"><i class="${barClass(tot.kcal, t.kcal)}" style="width:${barW(tot.kcal, t.kcal)}%"></i></div>
        <div class="macros">${macros}</div>
      </div>
    </header>
    <main class="chat" id="chat">${chat}</main>
    <footer class="composer">${composer}</footer>`;

  const form = document.getElementById('logform');
  if (form) form.addEventListener('submit', onLog);
  window.scrollTo(0, document.body.scrollHeight);
}

function entryHTML(e) {
  const time = new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const lines = e.items.map((it, idx) => {
    if (it.ok) {
      return `<div class="item-line">${esc(it.foodName)} <span class="g">→ ${it.grams} g</span> · ${it.kcal} kcal · P ${it.p} C ${it.c} F ${it.f}${it.note ? `<div class="item-note">${esc(it.note)}</div>` : ''}</div>`;
    }
    return `<div class="item-line bad">“${esc(it.name)}” — I don't know this one</div>`;
  }).join('');
  const totalKcal = e.items.filter(i => i.ok).reduce((s, i) => s + i.kcal, 0);
  const resolvers = e.items.map((it, idx) => it.ok ? '' : resolverHTML(e.id, idx, it)).join('');
  return `
    <div class="msg">
      <div class="bubble">
        <div class="bubble-raw">${esc(e.text)}</div>
        ${lines}
        <div class="bubble-foot">
          ${e.items.length > 1 ? `<span>Σ ${totalKcal} kcal</span>` : ''}
          <span>${time}</span>
          <button class="del" data-action="del-entry" data-id="${e.id}" aria-label="Delete entry">✕</button>
        </div>
      </div>
    </div>${resolvers}`;
}

// ------------------------------------------------ unknown-food resolver
function resolverHTML(entryId, idx, item) {
  const key = `${entryId}:${idx}`;
  const ui = resolverUI[key] || { mode: 'idle' };
  let body = '';
  if (ui.mode === 'idle') {
    const ai = window.Sync && Sync.user
      ? `<button class="chip ai" data-action="ai-lookup" data-key="${key}">✨ Ask AI</button>` : '';
    body = `<div class="resolver-actions">
      ${ai}
      <button class="chip" data-action="off-search" data-key="${key}">Search Open Food Facts</button>
      <button class="chip" data-action="manual" data-key="${key}">Add it myself</button>
    </div>${ai ? '' : `<div class="item-note" style="margin-top:6px">Sign in to identify foods with AI — any language, any phrasing.</div>`}`;
  } else if (ui.mode === 'ai-loading') {
    body = `<span class="status">Asking AI…</span>`;
  } else if (ui.mode === 'ai-results') {
    const rows = ui.results.map((r) => `
      <div class="ai-item">
        <span class="nm">${esc(r.food_name_en)} <span class="g">→ ${Math.round(r.grams)} g · ${Math.round(r.per100.kcal * r.grams / 100)} kcal</span></span>
        <span class="kc">${r.per100.kcal} kcal · P ${r.per100.p} C ${r.per100.c} F ${r.per100.f} per 100 g${r.confidence === 'low' ? ' · low confidence — double-check' : ''}</span>
        ${r.note ? `<span class="kc">${esc(r.note)}</span>` : ''}
      </div>`).join('');
    body = `${rows}
      <div class="resolver-actions" style="margin-top:8px">
        <button class="chip ai" data-action="ai-accept" data-key="${key}">Use ${ui.results.length > 1 ? 'these' : 'this'}</button>
        <button class="chip" data-action="off-search" data-key="${key}">Search Open Food Facts</button>
        <button class="chip" data-action="manual" data-key="${key}">Add it myself</button>
      </div>`;
  } else if (ui.mode === 'ai-error') {
    body = `<span class="status">${esc(ui.message)}</span>
      <div class="resolver-actions" style="margin-top:8px">
        <button class="chip" data-action="ai-lookup" data-key="${key}">Retry AI</button>
        <button class="chip" data-action="off-search" data-key="${key}">Search Open Food Facts</button>
        <button class="chip" data-action="manual" data-key="${key}">Add it myself</button>
      </div>`;
  } else if (ui.mode === 'searching') {
    body = `<span class="status">Searching Open Food Facts…</span>`;
  } else if (ui.mode === 'error') {
    body = `<span class="status">Search failed — offline, maybe. </span>
      <div class="resolver-actions"><button class="chip" data-action="off-search" data-key="${key}">Retry</button>
      <button class="chip" data-action="manual" data-key="${key}">Add it myself</button></div>`;
  } else if (ui.mode === 'results') {
    body = ui.results.length
      ? ui.results.map((r, i) => `
          <button class="off-result" data-action="off-pick" data-key="${key}" data-i="${i}">
            <span class="nm">${esc(r.label)}</span>
            <span class="kc">${r.per100.kcal} kcal · P ${r.per100.p} C ${r.per100.c} F ${r.per100.f} per 100 g</span>
          </button>`).join('') +
        `<div class="resolver-actions"><button class="chip" data-action="manual" data-key="${key}">None of these — add it myself</button></div>`
      : `<span class="status">Nothing found. </span><div class="resolver-actions"><button class="chip" data-action="manual" data-key="${key}">Add it myself</button></div>`;
  } else if (ui.mode === 'manual') {
    body = `<div class="mini-form">
        <div><label>kcal / 100 g</label><input inputmode="decimal" id="mf-kcal-${key}"></div>
        <div><label>Protein g</label><input inputmode="decimal" id="mf-p-${key}"></div>
        <div><label>Carbs g</label><input inputmode="decimal" id="mf-c-${key}"></div>
        <div><label>Fat g</label><input inputmode="decimal" id="mf-f-${key}"></div>
      </div>
      <div class="resolver-actions" style="margin-top:8px">
        <button class="chip" data-action="manual-save" data-key="${key}">Save food</button>
      </div>`;
  }
  return `<div class="resolver" data-rkey="${key}">
    <p>New food: <b>${esc(item.name)}</b> — tell me once, I'll remember it.</p>${body}</div>`;
}

// ------------------------------------------------ AI food lookup
// The edge function (supabase/functions/parse-food) holds the API key and
// requires a signed-in user; the browser only ever sends the food text.
async function aiLookup(key) {
  const item = itemByKey(key);
  if (!item) return;
  resolverUI[key] = { mode: 'ai-loading' };
  render();
  let ui;
  try {
    const token = window.Sync ? await Sync.getToken() : null;
    if (!token) throw { message: 'Sign in (top right) to use AI lookups.' };
    const res = await fetch(`${CONFIG.supabaseUrl}/functions/v1/parse-food`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: item.raw || item.name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { message: data.error || `AI lookup failed (${res.status}).` };
    ui = (data.items && data.items.length)
      ? { mode: 'ai-results', results: data.items }
      : { mode: 'ai-error', message: 'The AI couldn’t find a food in this — try rephrasing.' };
  } catch (e) {
    ui = { mode: 'ai-error', message: (e && e.message) || 'AI lookup failed — offline, maybe.' };
  }
  // The entry may have changed while we waited (another item accepted, entry
  // deleted, indexes shifted) — only attach the result if `key` still points
  // at the same unresolved item we asked about.
  if (itemByKey(key) !== item || item.ok) return;
  resolverUI[key] = ui;
  render();
}

function aiAccept(key) {
  const ui = resolverUI[key];
  if (!ui || ui.mode !== 'ai-results' || !ui.results.length) return;
  const [entryId, idxS] = key.split(':');
  const entry = today().entries.find((e) => e.id === entryId);
  const idx = Number(idxS);
  const source = entry && entry.items[idx];
  if (!source) return;

  const replacements = ui.results.map((r) => {
    // Prefer a food the app already knows — but only on an EXACT name match.
    // resolveFood's fuzzy rules would happily turn "almond milk" into plain
    // "milk" and silently use the wrong numbers.
    const nq = parser.normName(r.food_name_en);
    let food = parser.resolveFood(r.food_name_en);
    if (food) {
      const nf = parser.normName(food.name);
      if (nf !== nq && nf !== nq.replace(/(e?s)$/, '')) food = null;
    }
    if (!food) {
      food = { name: r.food_name_en, per100: r.per100 };
      if (r.piece_grams) food.piece = r.piece_grams;
      if (nq) {
        state.custom[nq] = food;
        touch('custom', nq);
        if (window.Sync) Sync.cachePut(nq, food);
      }
    }
    const item = { raw: source.raw, name: r.food_name_en, mode: 'g', amount: r.grams };
    parser.computeItem(item, food);
    if (r.note) item.note = item.note ? `${item.note} · ${r.note}` : r.note;
    return item;
  });

  entry.items.splice(idx, 1, ...replacements);
  // Item indexes may have shifted — drop this entry's transient resolver state.
  for (const k of Object.keys(resolverUI)) if (k.startsWith(entryId + ':')) delete resolverUI[k];
  touch('day', dayKey());
  save();
  render();
}

async function offSearch(key, name) {
  resolverUI[key] = { mode: 'searching' };
  render();

  // Our own database first: has anyone (any device, ever) resolved this food?
  let cached = null;
  if (window.Sync) {
    cached = await Sync.cacheGet(parser.normName(name)).catch(() => null);
  }

  try {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=6'
      + '&fields=product_name,brands,nutriments&search_terms=' + encodeURIComponent(name);
    const res = await fetch(url);
    const data = await res.json();
    const results = (data.products || [])
      .filter(p => p.nutriments && p.nutriments['energy-kcal_100g'] != null)
      .slice(0, 5)
      .map(p => ({
        label: [p.product_name, p.brands].filter(Boolean).join(' — ') || name,
        per100: {
          kcal: Math.round(p.nutriments['energy-kcal_100g']),
          p: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
          c: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10,
          f: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
        },
      }));
    if (cached && cached.per100) {
      results.unshift({ label: `${cached.name || name} — saved earlier`, per100: cached.per100, cached: true });
    }
    resolverUI[key] = { mode: 'results', results };
  } catch (e) {
    resolverUI[key] = (cached && cached.per100)
      ? { mode: 'results', results: [{ label: `${cached.name || name} — saved earlier`, per100: cached.per100, cached: true }] }
      : { mode: 'error' };
  }
  render();
}

function resolveWith(key, per100) {
  const [entryId, idxS] = key.split(':');
  const idx = Number(idxS);
  const d = today();
  const entry = d.entries.find(e => e.id === entryId);
  if (!entry) return;
  const item = entry.items[idx];
  const food = { name: item.name, per100 };
  const norm = parser.normName(item.name);
  state.custom[norm] = food;   // remembered forever
  touch('custom', norm);
  parser.computeItem(item, food);
  delete resolverUI[key];
  save();
  render();
}

// ---------------------------------------------------------------- actions
document.addEventListener('click', ev => {
  const btn = ev.target.closest('[data-action]');
  if (!btn) return;
  const a = btn.dataset.action;

  if (a === 'nav') { location.hash = btn.dataset.to; return; }

  if (a === 'del-entry') {
    const d = today();
    const e = d.entries.find(x => x.id === btn.dataset.id);
    if (e && confirm(`Delete “${e.text}”?`)) {
      d.entries = d.entries.filter(x => x.id !== btn.dataset.id);
      touch('day', dayKey());
      save(); render();
    }
    return;
  }

  if (a === 'complete') {
    if (confirm('Close this day and move it to history?')) { today().completed = true; touch('day', dayKey()); save(); render(); }
    return;
  }
  if (a === 'reopen') { today().completed = false; touch('day', dayKey()); save(); render(); return; }

  if (a === 'ai-lookup') { aiLookup(btn.dataset.key); return; }
  if (a === 'ai-accept') { aiAccept(btn.dataset.key); return; }
  if (a === 'off-search') {
    const key = btn.dataset.key;
    const item = itemByKey(key);
    if (item) offSearch(key, item.name);
    return;
  }
  if (a === 'manual') { resolverUI[btn.dataset.key] = { mode: 'manual' }; render(); return; }
  if (a === 'off-pick') {
    const key = btn.dataset.key;
    const r = (resolverUI[key].results || [])[Number(btn.dataset.i)];
    if (r) {
      const item = itemByKey(key);
      if (item && window.Sync && !r.cached) {
        Sync.cachePut(parser.normName(item.name), { name: item.name, per100: r.per100 });
      }
      resolveWith(key, r.per100);
    }
    return;
  }
  if (a === 'manual-save') {
    const key = btn.dataset.key;
    const g = id => parseFloat((document.getElementById(`mf-${id}-${key}`) || {}).value?.replace(',', '.')) || 0;
    const per100 = { kcal: g('kcal'), p: g('p'), c: g('c'), f: g('f') };
    if (per100.kcal <= 0) { alert('kcal per 100 g is needed.'); return; }
    resolveWith(key, per100);
    return;
  }

  if (a === 'del-custom') {
    state.custom[btn.dataset.key] = { deleted: true };
    touch('custom', btn.dataset.key);
    save(); render(); return;
  }
  if (a === 'google-login') { window.Sync && Sync.signIn(); return; }
  if (a === 'logout') { logOut(); return; }
  if (a === 'sync-now') { window.Sync && Sync.syncNow(); return; }
  if (a === 'delete-account') { deleteAccount(); return; }

  if (a === 'export') { exportJSON(); return; }
  if (a === 'import') { document.getElementById('importfile').click(); return; }
  if (a === 'reset') {
    const cloud = window.Sync && Sync.user
      ? '\n\n(You are signed in — the cloud copy stays and will come back on next sync. To clear just this device, use Log out instead.)' : '';
    if (confirm('Wipe everything — targets, custom foods, all history?' + cloud)) {
      localStorage.removeItem(LS_KEY); state = load(); location.hash = ''; render();
    }
    return;
  }
  if (a === 'estimate') { estimate(); return; }
  if (a === 'save-targets') { saveTargets(); return; }
  if (a === 'sex') {
    document.querySelectorAll('[data-action=sex]').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    return;
  }
});

function itemByKey(key) {
  const [entryId, idxS] = key.split(':');
  const entry = today().entries.find(e => e.id === entryId);
  return entry && entry.items[Number(idxS)];
}

// Logging out also removes the local copy — the next person at this browser
// starts fresh. A full sync must complete first: the dirty flags don't
// survive a reload, so only a finished pull-merge can rediscover local rows
// the server doesn't have yet and push them up before the wipe.
let loggingOut = false;
async function logOut() {
  if (loggingOut || !(window.Sync && Sync.user)) return;
  loggingOut = true;
  try {
    const btn = () => document.querySelector('[data-action=logout]');
    let b = btn();
    if (b) { b.disabled = true; b.textContent = 'Syncing…'; }
    await Sync.syncNow();                      // joins an in-flight sync, or runs one
    if (Sync.pending) await Sync.syncNow();    // edits that landed mid-sync
    b = btn();
    if (b) { b.disabled = false; b.textContent = 'Log out'; }
    const clean = !Sync.pending && Sync.status === 'ok';
    const msg = clean
      ? 'Log out and remove your log from this device? It stays in your account and comes back when you sign in again.'
      : 'Log out and remove your log from this device?\n\nWARNING: couldn’t confirm everything is backed up (sync failed) — recent changes may be lost. To be safe, cancel and tap “Sync now” once you’re back online.';
    if (!confirm(msg)) return;
    await Sync.signOut();
    localStorage.removeItem(LS_KEY);
    state = load();
    resolverUI = {};
    location.hash = '';
    render();
  } finally { loggingOut = false; }
}

async function deleteAccount() {
  if (!(window.Sync && Sync.user)) return;
  const email = Sync.user.email || 'your account';
  if (!confirm(`Permanently delete ${email} and ALL synced data — every day, food and target, on every device?`)) return;
  if (prompt('This cannot be undone. Type DELETE to confirm.') !== 'DELETE') return;
  const btn = document.querySelector('[data-action=delete-account]');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
  const res = await Sync.deleteAccount();
  if (!res.ok) {
    alert('Could not delete the account: ' + res.error);
    if (btn) { btn.disabled = false; btn.textContent = 'Delete'; }
    return;
  }
  localStorage.removeItem(LS_KEY);
  state = load();
  resolverUI = {};
  location.hash = '';
  render();
  alert('Your account and all synced data were deleted.');
}

function onLog(ev) {
  ev.preventDefault();
  const input = document.getElementById('loginput');
  const text = input.value.trim();
  if (!text) return;
  const items = parser.parseEntry(text);
  if (!items.length) return;
  today().entries.push({ id: Math.random().toString(36).slice(2, 9), text, items, t: Date.now() });
  touch('day', dayKey());
  save();
  render();
  const fresh = document.getElementById('loginput');
  if (fresh) fresh.focus();
}

// ---------------------------------------------------------------- setup / settings
function renderTargetsForm(firstRun) {
  const t = state.targets || { kcal: '', p: '', c: '', f: '' };
  const pr = (state.targets && state.targets.profile) || {};
  app.innerHTML = `
    <div class="page">
      <div class="page-top">
        ${firstRun ? '<span></span>' : `<button class="back" data-action="nav" data-to="">← Back to today</button>`}
        <span id="acct-slot">${acctChip()}</span>
      </div>
      <h1>${firstRun ? 'Set your day' : 'Settings'}</h1>
      <p class="lede">${firstRun ? 'Targets first — then it\u2019s just typing what you eat.' : 'Targets, your foods, your data.'}</p>

      <h2>About you (only used for the estimate)</h2>
      <div class="grid-2">
        <div class="field"><label>Weight, kg</label><input inputmode="decimal" id="f-w" value="${pr.w ?? ''}"></div>
        <div class="field"><label>Height, cm</label><input inputmode="decimal" id="f-h" value="${pr.h ?? ''}"></div>
        <div class="field"><label>Age</label><input inputmode="numeric" id="f-age" value="${pr.age ?? ''}"></div>
        <div class="field"><label>Activity</label>
          <select id="f-act">
            <option value="1.2" ${pr.act == 1.2 ? 'selected' : ''}>Mostly sitting</option>
            <option value="1.375" ${(pr.act ?? 1.375) == 1.375 ? 'selected' : ''}>Lightly active</option>
            <option value="1.55" ${pr.act == 1.55 ? 'selected' : ''}>Active</option>
            <option value="1.725" ${pr.act == 1.725 ? 'selected' : ''}>Very active</option>
          </select>
        </div>
      </div>
      <div class="field"><label>Sex (for the formula)</label>
        <div class="seg">
          <button data-action="sex" data-v="f" class="${(pr.sex ?? 'f') === 'f' ? 'on' : ''}">Female</button>
          <button data-action="sex" data-v="m" class="${pr.sex === 'm' ? 'on' : ''}">Male</button>
        </div>
      </div>
      <button class="btn" data-action="estimate">Estimate my targets</button>
      <p class="hint">Mifflin-St Jeor × activity — a maintenance estimate. Adjust below to match your goal.</p>

      <h2>Daily targets</h2>
      <div class="grid-4">
        <div class="field"><label>kcal</label><input inputmode="numeric" id="t-kcal" value="${t.kcal}"></div>
        <div class="field"><label>Protein g</label><input inputmode="numeric" id="t-p" value="${t.p}"></div>
        <div class="field"><label>Carbs g</label><input inputmode="numeric" id="t-c" value="${t.c}"></div>
        <div class="field"><label>Fat g</label><input inputmode="numeric" id="t-f" value="${t.f}"></div>
      </div>
      <div class="btn-row"><button class="btn primary" data-action="save-targets">Save targets</button></div>

      ${firstRun ? '' : settingsExtras()}
    </div>`;
}

function settingsExtras() {
  const foods = Object.entries(state.custom).filter(([, f]) => !f.deleted);
  const signedIn = !!(window.Sync && Sync.user);
  return `
    <h2>Your foods (${foods.length})</h2>
    ${foods.length ? foods.map(([k, f]) => `
      <div class="custom-food">
        <span>${esc(f.name)} <span style="color:var(--faint)">· ${f.per100.kcal} kcal/100g</span></span>
        <button class="del" data-action="del-custom" data-key="${esc(k)}">✕</button>
      </div>`).join('') : `<p class="hint">Foods you teach it will show up here.</p>`}

    <h2>Account & sync</h2>
    <div id="sync-section">${syncSection()}</div>

    <h2>Data</h2>
    <div class="btn-row">
      <button class="btn" data-action="export">Export JSON</button>
      <button class="btn" data-action="import">Import JSON</button>
    </div>
    <p class="hint">Your log lives in this browser${signedIn ? ', backed up to your account' : ' only — export now and then, clearing browser data clears your history too'}. Export gives you the full log as a file you can keep or take elsewhere.</p>

    ${signedIn ? `
    <div class="logout-row">
      <button class="btn" data-action="logout">Log out</button>
      <p class="hint">Signs you out and removes your log from this device — it stays in your account (and on your other devices) and comes back when you sign in again.</p>
    </div>` : ''}

    <div class="danger-zone">
      <h2>Danger zone</h2>
      <div class="dz-item">
        <div>
          <b>Reset everything</b>
          <p class="hint">Wipes targets, foods and history from this device.${signedIn ? ' Your synced copy stays and comes back on the next sign-in.' : ''}</p>
        </div>
        <button class="btn danger" data-action="reset">Reset</button>
      </div>
      <div class="dz-item">
        <div>
          <b>Delete account</b>
          <p class="hint">${signedIn
            ? 'Permanently deletes your account and every synced day, food and target. Cannot be undone.'
            : 'Sign in first — there is no account to delete from this device.'}</p>
        </div>
        ${signedIn ? `<button class="btn danger solid" data-action="delete-account">Delete</button>` : ''}
      </div>
    </div>
    <input type="file" id="importfile" accept="application/json" style="display:none" onchange="importJSON(event)">`;
}

function syncSection() {
  const envNote = (typeof CONFIG !== 'undefined' && CONFIG.env === 'dev')
    ? `<p class="hint" style="color:var(--amber)">Test environment — this data lives in the dev project, fully separate from the live app.</p>` : '';
  if (!window.Sync || Sync.status === 'off') {
    return envNote + `<p class="hint">Sync isn't set up in this build — the app is local-only. To enable login + multi-device sync, follow SETUP.md in the repo and fill in config.js.</p>`;
  }
  if (!Sync.user) {
    return envNote + `
      <p class="hint">Sign in to back up your log and keep phone and laptop in step. No password — Google handles it.</p>
      <div class="btn-row"><button class="btn primary" data-action="google-login">Continue with Google</button></div>`;
  }
  const when = Sync.lastSync ? new Date(Sync.lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
  const label = { syncing: 'syncing…', ok: `synced · ${when}`, error: 'sync error — will retry' }[Sync.status] || Sync.status;
  return envNote + `
    <div class="custom-food">
      <span>${esc(Sync.user.email || 'Signed in')} <span style="color:var(--faint)">· ${label}</span></span>
    </div>
    <div class="btn-row"><button class="btn" data-action="sync-now">Sync now</button></div>
    <p class="hint">Everything syncs automatically — on each change, and whenever you come back to the app.</p>`;
}

function estimate() {
  const v = id => parseFloat((document.getElementById(id) || {}).value?.replace(',', '.'));
  const w = v('f-w'), h = v('f-h'), age = v('f-age');
  const act = parseFloat(document.getElementById('f-act').value);
  const sexBtn = document.querySelector('[data-action=sex].on');
  const sex = sexBtn ? sexBtn.dataset.v : 'f';
  if (!(w > 0 && h > 0 && age > 0)) { alert('Weight, height and age are needed for the estimate.'); return; }
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'm' ? 5 : -161);
  const kcal = Math.round((bmr * act) / 50) * 50;
  const p = Math.round(1.6 * w);
  const f = Math.round(0.9 * w);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  document.getElementById('t-kcal').value = kcal;
  document.getElementById('t-p').value = p;
  document.getElementById('t-c').value = c;
  document.getElementById('t-f').value = f;
}

function saveTargets() {
  const v = id => parseFloat((document.getElementById(id) || {}).value?.replace(',', '.'));
  const kcal = v('t-kcal'), p = v('t-p'), c = v('t-c'), f = v('t-f');
  if (!(kcal > 0 && p >= 0 && c >= 0 && f >= 0)) { alert('Set the four targets first (Estimate can fill them in).'); return; }
  const sexBtn = document.querySelector('[data-action=sex].on');
  state.targets = {
    kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), f: Math.round(f),
    profile: {
      w: v('f-w') || null, h: v('f-h') || null, age: v('f-age') || null,
      act: parseFloat(document.getElementById('f-act').value),
      sex: sexBtn ? sexBtn.dataset.v : 'f',
    },
  };
  touch('targets');
  save();
  location.hash = '';
  render();
}

// ---------------------------------------------------------------- history
function renderHistory() {
  rollover();
  const t = state.targets;
  const days = Object.entries(state.days)
    .filter(([, d]) => d.completed && d.entries.length)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([k, d]) => ({ key: k, totals: dayTotals(d) }));

  const weekAgo = dayKey(new Date(Date.now() - 6 * 86400000));
  const last7 = days.filter(d => d.key >= weekAgo);
  const avg = arr => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : 0;
  const onTarget = last7.filter(d => Math.abs(d.totals.kcal - t.kcal) <= t.kcal * 0.1).length;

  const summary = days.length ? `
    <div class="summary">
      <div class="big">${fmt(avg(last7.map(d => d.totals.kcal)))}<small> avg kcal, last 7 days</small></div>
      <div class="summary-grid">
        <div><div class="lab">Avg protein</div><div class="val">${avg(last7.map(d => d.totals.p))} g</div></div>
        <div><div class="lab">Within ±10%</div><div class="val">${onTarget} / ${last7.length} days</div></div>
        <div><div class="lab">Days logged</div><div class="val">${days.length}</div></div>
      </div>
    </div>` : `<p class="lede">Nothing here yet — complete a day and it lands on this page.</p>`;

  const rows = days.map(d => `
    <div class="dayrow">
      <div class="dayrow-top"><span class="d">${niceDate(d.key)}</span><span>${fmt(d.totals.kcal)} / ${fmt(t.kcal)} kcal</span></div>
      <div class="bar"><i class="${barClass(d.totals.kcal, t.kcal)}" style="width:${barW(d.totals.kcal, t.kcal)}%"></i></div>
      <div class="dayrow-macros"><span>P ${d.totals.p}</span><span>C ${d.totals.c}</span><span>F ${d.totals.f}</span></div>
    </div>`).join('');

  app.innerHTML = `
    <div class="page">
      <div class="page-top">
        <button class="back" data-action="nav" data-to="">← Back to today</button>
        <span id="acct-slot">${acctChip()}</span>
      </div>
      <h1>History</h1>
      <p class="lede">Only completed days count. A missing day means you didn't log, not that you didn't eat.</p>
      ${summary}${rows}
    </div>`;
}

// ---------------------------------------------------------------- data i/o
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `just-ate-export-${dayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
window.importJSON = function (ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!s || typeof s !== 'object' || !('days' in s)) throw new Error('shape');
      state = { targets: null, custom: {}, days: {}, ...s };
      // An import is an explicit "this is the truth" — stamp it newest so it
      // wins the merge on every device.
      const u = Date.now();
      if (state.targets) state.targets.u = u;
      for (const k of Object.keys(state.days)) { state.days[k].u = u; window.Sync && Sync.queuePush('day', k); }
      for (const k of Object.keys(state.custom)) { state.custom[k].u = u; window.Sync && Sync.queuePush('custom', k); }
      if (state.targets && window.Sync) Sync.queuePush('targets');
      save(); location.hash = ''; render();
    } catch (e) { alert('That file doesn\u2019t look like a just-ate export.'); }
  };
  reader.readAsText(file);
};

// ---------------------------------------------------------------- boot
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
rollover();
render();

if (window.Sync && typeof CONFIG !== 'undefined') {
  let lastAcct = '';
  Sync.init(CONFIG, {
    getState: () => state,
    replaceState: (s) => { state = s; save(); render(); },
    onChange: () => {
      const id = (Sync.user && Sync.user.id) || '';
      if (id !== lastAcct) { lastAcct = id; render(); return; } // login/logout: everything updates
      const slot = document.getElementById('acct-slot');        // chip appearing / status pings: patch
      if (slot) slot.innerHTML = acctChip();                    // in place — nobody's typing is disturbed
      if (route() === 'settings') {
        const box = document.getElementById('sync-section');
        if (box) box.innerHTML = syncSection();
      }
    },
  });
}
