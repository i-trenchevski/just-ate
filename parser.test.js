// Run with: node parser.test.js
const { FOODS } = require('./foods.js');
const { createParser } = require('./parser.js');

const custom = {};
const parser = createParser(FOODS, () => custom);

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}  ${detail || ''}`); }
}
function one(text) { return parser.parseEntry(text)[0]; }

// --- the exact lines from the screenshot ---
let i = one('2 eggs');
check('"2 eggs" -> egg 110 g', i.ok && i.foodName === 'egg' && i.grams === 110, JSON.stringify(i));
check('"2 eggs" kcal', i.kcal === Math.round(143 * 1.1), i.kcal);

i = one('1 cucumber');
check('"1 cucumber" -> 300 g', i.ok && i.foodName === 'cucumber' && i.grams === 300, JSON.stringify(i));

i = one('3 apples');
check('"3 apples" -> 540 g', i.ok && i.foodName === 'apple' && i.grams === 540, JSON.stringify(i));

i = one('1 banana');
check('"1 banana" -> 118 g', i.ok && i.foodName === 'banana' && i.grams === 118, JSON.stringify(i));

let items = parser.parseEntry('30 gr whey protein, 150gr blueberries');
check('multi-item split', items.length === 2, items.length);
check('whey 30 g', items[0].ok && items[0].foodName === 'whey protein' && items[0].grams === 30, JSON.stringify(items[0]));
check('whey protein grams', items[1] && items[1].ok && items[1].foodName === 'blueberries' && items[1].grams === 150, JSON.stringify(items[1]));

// --- the zlatiborac case: brand word unknown, generic word matched ---
i = one('100g zlatiborac prshuta');
check('"zlatiborac prshuta" -> prosciutto', i.ok && i.foodName === 'prosciutto' && i.kcal === 250, JSON.stringify(i));

// --- formats ---
i = one('rice 150g');
check('trailing qty "rice 150g" = RAW rice', i.ok && i.foodName === 'rice' && i.grams === 150 && i.kcal === 548, JSON.stringify(i));

i = one('150g cooked rice');
check('"cooked rice" hits the cooked entry', i.ok && i.foodName === 'cooked rice' && i.kcal === 195, JSON.stringify(i));

i = one('1,5 banana');
check('comma decimal "1,5 banana"', i.ok && i.grams === 177, JSON.stringify(i));

i = one('0.5 avocado');
check('half an avocado', i.ok && i.grams === 70, JSON.stringify(i));

i = one('coffee');
check('bare name -> 1 piece', i.ok && i.foodName === 'black coffee' && i.grams === 200, JSON.stringify(i));

i = one('2 kom leb');
check('"2 kom leb" -> bread 70 g', i.ok && i.foodName === 'bread' && i.grams === 70, JSON.stringify(i));

i = one('250 ml melk');
check('ml as grams', i.ok && i.foodName === 'milk' && i.grams === 250, JSON.stringify(i));

// --- unknowns + custom foods ---
i = one('55g mystery snack');
check('unknown stays unresolved', i.ok === false && i.name === 'mystery snack', JSON.stringify(i));

custom[parser.normName('mystery snack')] = { name: 'mystery snack', per100: { kcal: 400, p: 10, c: 50, f: 18 } };
i = one('55g mystery snack');
check('custom food resolves after save', i.ok && i.kcal === 220, JSON.stringify(i));

i = one('2 whey protein');
check('count without piece weight -> 100 g each + note', i.ok && i.grams === 200 && !!i.note, JSON.stringify(i));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
