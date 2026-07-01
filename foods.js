// Built-in food database.
// Values are per 100 g (or 100 ml for liquids). `piece` = grams assumed for
// one counted item ("2 eggs" -> 2 x 55 g). Everything here is a reasonable
// generic average — edit freely, precision theatre is not the goal.
//
// CONVENTION: weights are RAW / as-purchased. "60g rice" = 60 g dry rice,
// "150g chicken" = raw weight. Foods that change a lot in the pan have an
// explicit "cooked ..." entry — type that if you weighed after cooking.
// Entries logged in the app bake these numbers in at log time, so editing
// this file never rewrites your history.

const FOODS = [
  // --- protein ---
  { name: 'egg', aliases: ['eggs', 'boiled egg', 'fried egg', 'ei', 'eieren', 'jajce'], per100: { kcal: 143, p: 12.6, c: 0.7, f: 9.5 }, piece: 55 },
  { name: 'egg white', aliases: ['egg whites'], per100: { kcal: 52, p: 10.9, c: 0.7, f: 0.2 }, piece: 33 },
  { name: 'chicken breast', aliases: ['chicken', 'kipfilet', 'pileshko', 'raw chicken'], per100: { kcal: 120, p: 22.5, c: 0, f: 2.6 } },
  { name: 'cooked chicken breast', aliases: ['cooked chicken', 'grilled chicken', 'roast chicken'], per100: { kcal: 165, p: 31, c: 0, f: 3.6 } },
  { name: 'chicken thigh', aliases: ['chicken thighs'], per100: { kcal: 121, p: 19.7, c: 0, f: 4.7 } },
  { name: 'minced beef', aliases: ['ground beef', 'beef mince', 'gehakt', 'melo meso'], per100: { kcal: 230, p: 18.5, c: 0, f: 17 } },
  { name: 'beef steak', aliases: ['steak', 'beef'], per100: { kcal: 176, p: 21, c: 0, f: 10 } },
  { name: 'pork chop', aliases: ['pork'], per100: { kcal: 200, p: 20, c: 0, f: 13.5 } },
  { name: 'prosciutto', aliases: ['prshuta', 'prsuta', 'dry-cured ham', 'parma ham'], per100: { kcal: 250, p: 25, c: 0.3, f: 16 } },
  { name: 'ham', aliases: ['cooked ham', 'shunka'], per100: { kcal: 145, p: 21, c: 1.5, f: 6 } },
  { name: 'bacon', aliases: ['spek', 'slanina'], per100: { kcal: 541, p: 37, c: 1.4, f: 42 } },
  { name: 'salmon', aliases: ['zalm', 'losos'], per100: { kcal: 208, p: 20, c: 0, f: 13 } },
  { name: 'tuna', aliases: ['canned tuna', 'tonijn'], per100: { kcal: 116, p: 26, c: 0, f: 1 } },
  { name: 'white fish', aliases: ['cod', 'kabeljauw'], per100: { kcal: 82, p: 18, c: 0, f: 0.7 } },
  { name: 'shrimp', aliases: ['prawns', 'garnalen'], per100: { kcal: 99, p: 24, c: 0.2, f: 0.3 } },
  { name: 'whey protein', aliases: ['whey', 'protein powder', 'protein shake'], per100: { kcal: 380, p: 75, c: 8, f: 5 } },
  { name: 'tofu', aliases: [], per100: { kcal: 76, p: 8, c: 1.9, f: 4.8 } },

  // --- dairy ---
  { name: 'milk', aliases: ['semi-skimmed milk', 'melk', 'mleko'], per100: { kcal: 47, p: 3.4, c: 4.8, f: 1.5 } },
  { name: 'whole milk', aliases: ['full fat milk'], per100: { kcal: 61, p: 3.2, c: 4.8, f: 3.3 } },
  { name: 'yogurt', aliases: ['yoghurt', 'jogurt'], per100: { kcal: 61, p: 3.5, c: 4.7, f: 3.3 } },
  { name: 'greek yogurt', aliases: ['greek yoghurt'], per100: { kcal: 97, p: 9, c: 3.9, f: 5 } },
  { name: 'skyr', aliases: [], per100: { kcal: 63, p: 11, c: 4, f: 0.2 } },
  { name: 'quark', aliases: ['kwark'], per100: { kcal: 67, p: 12, c: 4, f: 0.3 } },
  { name: 'cottage cheese', aliases: ['huttenkase'], per100: { kcal: 98, p: 11, c: 3.4, f: 4.3 } },
  { name: 'cheese', aliases: ['gouda', 'kaas', 'kashkaval'], per100: { kcal: 356, p: 25, c: 2.2, f: 27 } },
  { name: 'feta', aliases: ['white cheese', 'sirenje'], per100: { kcal: 264, p: 14, c: 4, f: 21 } },
  { name: 'mozzarella', aliases: [], per100: { kcal: 280, p: 22, c: 2.2, f: 22 } },
  { name: 'parmesan', aliases: [], per100: { kcal: 431, p: 38, c: 4, f: 29 } },
  { name: 'butter', aliases: ['boter', 'puter'], per100: { kcal: 717, p: 0.9, c: 0.1, f: 81 } },
  { name: 'kajmak', aliases: [], per100: { kcal: 620, p: 4, c: 2, f: 65 } },

  // --- grains, bread, potatoes ---
  { name: 'rice', aliases: ['white rice', 'oriz', 'dry rice', 'uncooked rice', 'raw rice'], per100: { kcal: 365, p: 7, c: 80, f: 0.7 } },
  { name: 'cooked rice', aliases: ['boiled rice', 'gekookte rijst'], per100: { kcal: 130, p: 2.7, c: 28, f: 0.3 } },
  { name: 'pasta', aliases: ['spaghetti', 'makaroni', 'dry pasta', 'uncooked pasta'], per100: { kcal: 371, p: 13, c: 75, f: 1.5 } },
  { name: 'cooked pasta', aliases: ['cooked spaghetti', 'boiled pasta'], per100: { kcal: 158, p: 5.8, c: 31, f: 0.9 } },
  { name: 'oats', aliases: ['oatmeal', 'havermout', 'ovesni snegulki'], per100: { kcal: 379, p: 13, c: 68, f: 6.5 } },
  { name: 'bread', aliases: ['slice of bread', 'toast', 'white bread', 'brood', 'leb'], per100: { kcal: 265, p: 9, c: 49, f: 3.2 }, piece: 35 },
  { name: 'whole wheat bread', aliases: ['brown bread', 'volkoren'], per100: { kcal: 247, p: 13, c: 41, f: 3.4 }, piece: 36 },
  { name: 'tortilla', aliases: ['wrap'], per100: { kcal: 310, p: 8, c: 51, f: 8 }, piece: 64 },
  { name: 'croissant', aliases: [], per100: { kcal: 406, p: 8, c: 46, f: 21 }, piece: 60 },
  { name: 'bagel', aliases: [], per100: { kcal: 257, p: 10, c: 50, f: 1.7 }, piece: 100 },
  { name: 'potato', aliases: ['potatoes', 'aardappel', 'kompir'], per100: { kcal: 77, p: 2, c: 17, f: 0.1 }, piece: 170 },
  { name: 'sweet potato', aliases: [], per100: { kcal: 86, p: 1.6, c: 20, f: 0.1 }, piece: 180 },
  { name: 'fries', aliases: ['french fries', 'friet', 'pomfrit'], per100: { kcal: 312, p: 3.4, c: 41, f: 15 } },
  { name: 'quinoa', aliases: ['dry quinoa'], per100: { kcal: 368, p: 14.1, c: 64, f: 6.1 } },
  { name: 'cooked quinoa', aliases: [], per100: { kcal: 120, p: 4.4, c: 21, f: 1.9 } },
  { name: 'couscous', aliases: ['dry couscous'], per100: { kcal: 376, p: 12.8, c: 72, f: 0.6 } },
  { name: 'cooked couscous', aliases: [], per100: { kcal: 112, p: 3.8, c: 23, f: 0.2 } },

  // --- legumes ---
  { name: 'lentils', aliases: ['leka', 'dry lentils'], per100: { kcal: 352, p: 24.6, c: 63, f: 1.1 } },
  { name: 'cooked lentils', aliases: ['boiled lentils'], per100: { kcal: 116, p: 9, c: 20, f: 0.4 } },
  { name: 'chickpeas', aliases: ['dry chickpeas'], per100: { kcal: 378, p: 20.5, c: 63, f: 6 } },
  { name: 'cooked chickpeas', aliases: ['canned chickpeas'], per100: { kcal: 164, p: 8.9, c: 27, f: 2.6 } },
  { name: 'beans', aliases: ['white beans', 'dry beans'], per100: { kcal: 333, p: 23.6, c: 60, f: 0.9 } },
  { name: 'cooked beans', aliases: ['grav', 'gravce', 'canned beans'], per100: { kcal: 127, p: 8.7, c: 23, f: 0.5 } },
  { name: 'hummus', aliases: [], per100: { kcal: 166, p: 8, c: 14, f: 10 } },

  // --- fruit ---
  { name: 'banana', aliases: ['bananas', 'banaan'], per100: { kcal: 89, p: 1.1, c: 23, f: 0.3 }, piece: 118 },
  { name: 'apple', aliases: ['apples', 'appel', 'jabolko'], per100: { kcal: 52, p: 0.3, c: 14, f: 0.2 }, piece: 180 },
  { name: 'blueberries', aliases: ['blueberry', 'borovnici', 'bosbessen'], per100: { kcal: 57, p: 0.7, c: 14.5, f: 0.3 } },
  { name: 'strawberries', aliases: ['strawberry', 'jagodi', 'aardbeien'], per100: { kcal: 32, p: 0.7, c: 7.7, f: 0.3 } },
  { name: 'raspberries', aliases: ['raspberry', 'malini'], per100: { kcal: 52, p: 1.2, c: 12, f: 0.7 } },
  { name: 'grapes', aliases: ['grape', 'grozje', 'druiven'], per100: { kcal: 69, p: 0.7, c: 18, f: 0.2 } },
  { name: 'orange', aliases: ['oranges', 'portokal', 'sinaasappel'], per100: { kcal: 47, p: 0.9, c: 12, f: 0.1 }, piece: 130 },
  { name: 'mandarin', aliases: ['mandarins', 'clementine', 'mandarina'], per100: { kcal: 53, p: 0.8, c: 13, f: 0.3 }, piece: 75 },
  { name: 'pear', aliases: ['pears', 'krusha', 'peer'], per100: { kcal: 57, p: 0.4, c: 15, f: 0.1 }, piece: 175 },
  { name: 'peach', aliases: ['peaches', 'praska'], per100: { kcal: 39, p: 0.9, c: 9.5, f: 0.3 }, piece: 150 },
  { name: 'kiwi', aliases: ['kiwis'], per100: { kcal: 61, p: 1.1, c: 15, f: 0.5 }, piece: 75 },
  { name: 'watermelon', aliases: ['lubenica'], per100: { kcal: 30, p: 0.6, c: 7.6, f: 0.2 } },
  { name: 'melon', aliases: ['cantaloupe', 'dinja'], per100: { kcal: 34, p: 0.8, c: 8.2, f: 0.2 } },
  { name: 'pineapple', aliases: ['ananas'], per100: { kcal: 50, p: 0.5, c: 13, f: 0.1 } },
  { name: 'mango', aliases: [], per100: { kcal: 60, p: 0.8, c: 15, f: 0.4 }, piece: 200 },
  { name: 'avocado', aliases: ['avocados'], per100: { kcal: 160, p: 2, c: 8.5, f: 14.7 }, piece: 140 },
  { name: 'dates', aliases: ['date', 'urmi'], per100: { kcal: 282, p: 2.5, c: 75, f: 0.4 }, piece: 20 },

  // --- vegetables ---
  { name: 'cucumber', aliases: ['cucumbers', 'komkommer', 'krastavica'], per100: { kcal: 15, p: 0.7, c: 3.6, f: 0.1 }, piece: 300 },
  { name: 'tomato', aliases: ['tomatoes', 'tomaat', 'domat'], per100: { kcal: 18, p: 0.9, c: 3.9, f: 0.2 }, piece: 120 },
  { name: 'bell pepper', aliases: ['paprika', 'piperka'], per100: { kcal: 26, p: 1, c: 6, f: 0.3 }, piece: 120 },
  { name: 'carrot', aliases: ['carrots', 'wortel', 'morkov'], per100: { kcal: 41, p: 0.9, c: 10, f: 0.2 }, piece: 60 },
  { name: 'onion', aliases: ['onions', 'ui', 'kromid'], per100: { kcal: 40, p: 1.1, c: 9.3, f: 0.1 }, piece: 110 },
  { name: 'broccoli', aliases: [], per100: { kcal: 34, p: 2.8, c: 6.6, f: 0.4 } },
  { name: 'spinach', aliases: ['spanak', 'spinazie'], per100: { kcal: 23, p: 2.9, c: 3.6, f: 0.4 } },
  { name: 'lettuce', aliases: ['salad greens', 'sla', 'marula'], per100: { kcal: 15, p: 1.4, c: 2.9, f: 0.2 } },
  { name: 'zucchini', aliases: ['courgette', 'tikvica'], per100: { kcal: 17, p: 1.2, c: 3.1, f: 0.3 }, piece: 200 },
  { name: 'mushrooms', aliases: ['mushroom', 'champignons', 'pechurki'], per100: { kcal: 22, p: 3.1, c: 3.3, f: 0.3 } },
  { name: 'corn', aliases: ['sweetcorn'], per100: { kcal: 86, p: 3.3, c: 19, f: 1.4 } },
  { name: 'peas', aliases: ['green peas', 'grashok'], per100: { kcal: 81, p: 5.4, c: 14, f: 0.4 } },

  // --- nuts, fats, sweets ---
  { name: 'almonds', aliases: ['almond', 'badem'], per100: { kcal: 579, p: 21, c: 22, f: 50 } },
  { name: 'walnuts', aliases: ['walnut', 'orevi'], per100: { kcal: 654, p: 15, c: 14, f: 65 } },
  { name: 'peanuts', aliases: ['peanut', 'kikiritki'], per100: { kcal: 567, p: 26, c: 16, f: 49 } },
  { name: 'peanut butter', aliases: ['pindakaas'], per100: { kcal: 588, p: 25, c: 20, f: 50 } },
  { name: 'cashews', aliases: ['cashew'], per100: { kcal: 553, p: 18, c: 30, f: 44 } },
  { name: 'olive oil', aliases: ['oil', 'maslinovo maslo'], per100: { kcal: 884, p: 0, c: 0, f: 100 } },
  { name: 'honey', aliases: ['med', 'honing'], per100: { kcal: 304, p: 0.3, c: 82, f: 0 } },
  { name: 'sugar', aliases: ['sheker', 'suiker'], per100: { kcal: 387, p: 0, c: 100, f: 0 } },
  { name: 'jam', aliases: ['marmalade', 'slatko'], per100: { kcal: 250, p: 0.4, c: 62, f: 0.1 } },
  { name: 'nutella', aliases: ['chocolate spread'], per100: { kcal: 539, p: 6, c: 57, f: 31 } },
  { name: 'dark chocolate', aliases: [], per100: { kcal: 546, p: 4.9, c: 61, f: 31 } },
  { name: 'chocolate', aliases: ['milk chocolate', 'cokolada'], per100: { kcal: 535, p: 7.7, c: 59, f: 30 } },
  { name: 'chips', aliases: ['crisps'], per100: { kcal: 536, p: 7, c: 53, f: 34 } },
  { name: 'ice cream', aliases: ['sladoled', 'ijs'], per100: { kcal: 207, p: 3.5, c: 24, f: 11 } },
  { name: 'cookie', aliases: ['cookies', 'biscuit', 'koekje'], per100: { kcal: 480, p: 5.5, c: 65, f: 22 }, piece: 12 },

  // --- composed / Balkan ---
  { name: 'pizza', aliases: ['slice of pizza', 'pizza slice'], per100: { kcal: 266, p: 11, c: 33, f: 10 }, piece: 120 },
  { name: 'burek', aliases: ['byrek'], per100: { kcal: 280, p: 7, c: 25, f: 17 } },
  { name: 'ajvar', aliases: [], per100: { kcal: 120, p: 1.7, c: 10, f: 8 } },
  { name: 'protein bar', aliases: [], per100: { kcal: 380, p: 33, c: 38, f: 12 }, piece: 55 },

  // --- drinks (per 100 ml; ml is treated as grams) ---
  { name: 'beer', aliases: ['pivo', 'bier'], per100: { kcal: 43, p: 0.5, c: 3.6, f: 0 }, piece: 330 },
  { name: 'wine', aliases: ['red wine', 'white wine', 'vino'], per100: { kcal: 83, p: 0.1, c: 2.6, f: 0 }, piece: 150 },
  { name: 'cola', aliases: ['coke', 'soda'], per100: { kcal: 42, p: 0, c: 10.6, f: 0 }, piece: 330 },
  { name: 'orange juice', aliases: ['juice', 'sok'], per100: { kcal: 45, p: 0.7, c: 10.4, f: 0.2 }, piece: 200 },
  { name: 'black coffee', aliases: ['coffee', 'kafe', 'koffie', 'espresso'], per100: { kcal: 2, p: 0.1, c: 0, f: 0 }, piece: 200 },
];

// Node shim so the parser tests can run outside the browser.
if (typeof module !== 'undefined') module.exports = { FOODS };
