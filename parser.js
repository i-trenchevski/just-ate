// Parser: turns a chat line into food items with grams + macros.
//
//   "2 eggs"                          -> 2 counted eggs -> 110 g
//   "30 gr whey protein, 150gr blueberries" -> two gram-based items
//   "rice 150g"                       -> trailing quantity also works
//   "zlatiborac prshuta 100g"         -> matches generic prosciutto via the
//                                        contained alias "prshuta"
//
// Weight units convert to grams; liquids treat ml as grams (close enough).
// Counted items use the food's `piece` weight; if a food has no piece
// weight, one piece is assumed to be 100 g and the entry says so.

const WEIGHT_UNITS = {
  g: 1, gr: 1, gram: 1, grams: 1, kg: 1000,
  ml: 1, l: 1000, cl: 10, dl: 100,
  tbsp: 15, tsp: 5,
};
const COUNT_UNITS = new Set(['x', 'pc', 'pcs', 'piece', 'pieces', 'kom', 'st', 'stuks']);

// Leading fraction words: "half banana", "pola banana", "половина јаболко".
const FRACTION_WORDS = {
  'half': 0.5, '1/2': 0.5, 'pola': 0.5, 'polovina': 0.5, 'пола': 0.5, 'половина': 0.5,
  'quarter': 0.25, '1/4': 0.25, 'третина': 1 / 3, 'third': 1 / 3,
};
const FRACTION_RE = new RegExp(
  `^(${Object.keys(FRACTION_WORDS).map((w) => w.replace('/', '\\/')).join('|')})\\s+(?:an?\\s+)?(.+)$`, 'i');

function normName(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\u0111/g, 'd')                            // dj has no NFD decomposition
    .replace(/[^a-z0-9%\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function num(s) { return parseFloat(String(s).replace(',', '.')); }

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function singularVariants(q) {
  const v = [q];
  if (q.endsWith('ies')) v.push(q.slice(0, -3) + 'y');
  if (q.endsWith('es')) v.push(q.slice(0, -2));
  if (q.endsWith('s')) v.push(q.slice(0, -1));
  return v;
}

function createParser(foods, getCustom) {
  // exact-lookup index: every name and alias -> food
  const exact = new Map();
  // list of {alias, food} for contained-word matching, longest alias first
  const contains = [];
  for (const f of foods) {
    const keys = [f.name, ...(f.aliases || [])];
    for (const k of keys) {
      const nk = normName(k);
      if (!exact.has(nk)) exact.set(nk, f);
      contains.push({ alias: nk, food: f });
    }
  }
  contains.sort((a, b) => b.alias.length - a.alias.length);

  function customMap() {
    const c = getCustom ? getCustom() : {};
    return c || {};
  }

  // Resolve a food name -> {name, per100, piece} or null.
  function resolveFood(raw) {
    const q = normName(raw);
    if (!q) return null;
    const custom = customMap();

    for (const v of singularVariants(q)) {
      if (custom[v]) return custom[v];           // your own foods win
      if (exact.has(v)) return exact.get(v);     // then built-ins, exactly
    }

    // whole-word alias contained in the query: "zlatiborac prshuta" -> prosciutto
    for (const key of Object.keys(custom)) {
      if (key.length >= 3 && new RegExp(`(^|\\s)${escapeRe(key)}(s|es)?($|\\s)`).test(q)) return custom[key];
    }
    for (const { alias, food } of contains) {
      if (alias.length >= 3 && new RegExp(`(^|\\s)${escapeRe(alias)}(s|es)?($|\\s)`).test(q)) return food;
    }

    // query is a prefix of a known food: "blueb" -> blueberries
    if (q.length >= 4) {
      for (const { alias, food } of contains) {
        if (alias.startsWith(q)) return food;
      }
    }
    return null;
  }

  // Parse one comma-separated chunk -> item {raw, name, mode, amount}
  function parseItem(raw) {
    let s = raw.trim().replace(/^(i\s+)?(ate|had)\s+/i, '');
    if (!s) return null;

    const fm = s.match(FRACTION_RE);
    if (fm) {
      const frac = FRACTION_WORDS[fm[1].toLowerCase()];
      const rest = fm[2].trim();
      // "half kg rice" / "1/2 l milk": the fraction scales a weight unit
      const um = rest.match(/^([a-zA-Z]+)\.?\s*(.*)$/);
      if (um && WEIGHT_UNITS[um[1].toLowerCase()] != null && um[2]) {
        return { raw, name: um[2].trim(), mode: 'g', amount: frac * WEIGHT_UNITS[um[1].toLowerCase()] };
      }
      // keep the unstripped text: a taught food may itself start with a
      // fraction word ("quarter pounder")
      return { raw, name: rest, mode: 'count', amount: frac, full: s };
    }

    let m = s.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (m) {
      const amount = num(m[1]);
      const rest = m[2].trim();
      const um = rest.match(/^([a-zA-Z]+)\.?\s*(.*)$/);
      if (um) {
        const unit = um[1].toLowerCase();
        if (WEIGHT_UNITS[unit] != null && um[2]) {
          return { raw, name: um[2].trim(), mode: 'g', amount: amount * WEIGHT_UNITS[unit] };
        }
        if (COUNT_UNITS.has(unit) && um[2]) {
          return { raw, name: um[2].trim(), mode: 'count', amount };
        }
      }
      if (!rest) return null; // just a number
      return { raw, name: rest, mode: 'count', amount };
    }

    // trailing quantity: "rice 150g", "milk 250 ml"
    const tm = s.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|gr|grams?|kg|ml|cl|dl|l)\.?$/i);
    if (tm) {
      return { raw, name: tm[1].trim(), mode: 'g', amount: num(tm[2]) * WEIGHT_UNITS[tm[3].toLowerCase()] };
    }

    return { raw, name: s, mode: 'count', amount: 1 };
  }

  // Attach a food to an item and compute grams + macros.
  function computeItem(item, food) {
    if (!food) { item.ok = false; return item; }
    let grams, note = null;
    if (item.mode === 'g') {
      grams = item.amount;
    } else if (food.piece) {
      grams = item.amount * food.piece;
    } else {
      grams = item.amount * 100;
      note = 'no piece weight known — assumed 100 g each';
    }
    const k = grams / 100;
    item.ok = true;
    item.foodName = food.name;
    item.per100 = { ...food.per100 };
    item.grams = Math.round(grams * 10) / 10;
    item.kcal = Math.round(food.per100.kcal * k);
    item.p = Math.round(food.per100.p * k * 10) / 10;
    item.c = Math.round(food.per100.c * k * 10) / 10;
    item.f = Math.round(food.per100.f * k * 10) / 10;
    item.note = note;
    return item;
  }

  // Full pipeline: "text" -> [items], resolved where possible.
  function parseEntry(text) {
    // "1,5 banana" uses a decimal comma; convert it before splitting on commas
    const safe = String(text).replace(/(\d),(\d)/g, '$1.$2');
    const chunks = safe.split(/,|;|\s\+\s|\s+and\s+/i);
    const items = [];
    for (const chunk of chunks) {
      const item = parseItem(chunk);
      if (!item) continue;
      let food = null;
      if (item.full) {
        // exact custom-food match on the whole phrase beats the fraction
        // reading: "quarter pounder" is one taught food, not 0.25 pounders
        const whole = customMap()[normName(item.full)];
        if (whole) { item.name = item.full; item.mode = 'count'; item.amount = 1; food = whole; }
      }
      delete item.full;
      computeItem(item, food || resolveFood(item.name));
      items.push(item);
    }
    return items;
  }

  return { parseEntry, resolveFood, computeItem, normName };
}

if (typeof module !== 'undefined') module.exports = { createParser, normName };
