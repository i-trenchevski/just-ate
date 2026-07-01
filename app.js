/* Kcal — app logic.
   Views: setup (first run) · main (plate + chat) · history · settings.
   State lives in localStorage; logged entries bake their numbers in, so
   editing foods.js later never rewrites history. */

const LS_KEY = 'kcal-v1';
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

const parser = createParser(FOODS, () => state.custom);

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

// Any past day left open closes itself; empty stubs disappear.
function rollover() {
  const today = dayKey();
  let changed = false;
  for (const k of Object.keys(state.days)) {
    const d = state.days[k];
    if (k < today && !d.completed) {
      if (d.entries.length) { d.completed = true; } else { delete state.days[k]; }
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
};

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
    body = `<div class="resolver-actions">
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

async function offSearch(key, name) {
  resolverUI[key] = { mode: 'searching' };
  render();
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
    resolverUI[key] = { mode: 'results', results };
  } catch (e) {
    resolverUI[key] = { mode: 'error' };
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
  state.custom[parser.normName(item.name)] = food;   // remembered forever
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
      save(); render();
    }
    return;
  }

  if (a === 'complete') {
    if (confirm('Close this day and move it to history?')) { today().completed = true; save(); render(); }
    return;
  }
  if (a === 'reopen') { today().completed = false; save(); render(); return; }

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
    if (r) resolveWith(key, r.per100);
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
    delete state.custom[btn.dataset.key]; save(); render(); return;
  }
  if (a === 'export') { exportJSON(); return; }
  if (a === 'import') { document.getElementById('importfile').click(); return; }
  if (a === 'reset') {
    if (confirm('Wipe everything — targets, custom foods, all history?')) {
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

function onLog(ev) {
  ev.preventDefault();
  const input = document.getElementById('loginput');
  const text = input.value.trim();
  if (!text) return;
  const items = parser.parseEntry(text);
  if (!items.length) return;
  today().entries.push({ id: Math.random().toString(36).slice(2, 9), text, items, t: Date.now() });
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
      ${firstRun ? '' : `<button class="back" data-action="nav" data-to="">← Back to today</button>`}
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
  const foods = Object.entries(state.custom);
  return `
    <h2>Your foods (${foods.length})</h2>
    ${foods.length ? foods.map(([k, f]) => `
      <div class="custom-food">
        <span>${esc(f.name)} <span style="color:var(--faint)">· ${f.per100.kcal} kcal/100g</span></span>
        <button class="del" data-action="del-custom" data-key="${esc(k)}">✕</button>
      </div>`).join('') : `<p class="hint">Foods you teach it will show up here.</p>`}

    <h2>Data</h2>
    <div class="btn-row">
      <button class="btn" data-action="export">Export JSON</button>
      <button class="btn" data-action="import">Import JSON</button>
      <button class="btn danger" data-action="reset">Reset everything</button>
    </div>
    <p class="hint">Everything lives in this browser only. Export now and then — clearing browser data clears your history too.</p>
    <input type="file" id="importfile" accept="application/json" style="display:none" onchange="importJSON(event)">`;
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
      <button class="back" data-action="nav" data-to="">← Back to today</button>
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
  a.download = `kcal-export-${dayKey()}.json`;
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
      save(); location.hash = ''; render();
    } catch (e) { alert('That file doesn\u2019t look like a Kcal export.'); }
  };
  reader.readAsText(file);
};

// ---------------------------------------------------------------- boot
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
rollover();
render();
