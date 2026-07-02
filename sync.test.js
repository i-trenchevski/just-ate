// Tests for the pure merge at the heart of sync. Run: node sync.test.js
const { mergeStates } = require('./sync.js');

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ok ', name); }
  else { fail++; console.log('  FAIL', name, detail); }
}

const day = (u, n = 1) => ({ entries: Array(n).fill({ id: 'x', text: 'egg', items: [] }), completed: false, u });

// 1. local newer wins and is queued for push
let r = mergeStates(
  { targets: null, days: { '2026-07-01': day(200) }, custom: {} },
  { targets: null, days: { '2026-07-01': day(100, 2) }, custom: {} },
);
check('local-newer day wins', r.merged.days['2026-07-01'].u === 200 && r.merged.days['2026-07-01'].entries.length === 1);
check('local-newer day queued for push', r.push.days.includes('2026-07-01') && !r.changedLocal);

// 2. remote newer wins and flags a local change
r = mergeStates(
  { targets: null, days: { '2026-07-01': day(100) }, custom: {} },
  { targets: null, days: { '2026-07-01': day(300, 3) }, custom: {} },
);
check('remote-newer day wins', r.merged.days['2026-07-01'].entries.length === 3);
check('remote-newer flags changedLocal', r.changedLocal && r.push.days.length === 0);

// 3. local-only content gets pushed (first sign-in with existing data)
r = mergeStates(
  { targets: { kcal: 1800, u: 0 }, days: { '2026-06-30': day(0) }, custom: { rice: { name: 'rice', u: 0 } } },
  { targets: null, days: {}, custom: {} },
);
check('legacy local targets pushed', r.push.targets && r.merged.targets.kcal === 1800);
check('legacy local day + food pushed', r.push.days.length === 1 && r.push.custom.length === 1 && !r.changedLocal);

// 4. remote-only content is adopted (fresh device)
r = mergeStates(
  { targets: null, days: {}, custom: {} },
  { targets: { kcal: 2000, u: 5 }, days: { '2026-07-01': day(5) }, custom: { ajvar: { name: 'ajvar', u: 5 } } },
);
check('fresh device adopts remote', r.changedLocal && r.merged.targets.kcal === 2000
  && !!r.merged.days['2026-07-01'] && !!r.merged.custom.ajvar && r.push.days.length === 0);

// 5. equal timestamps: keep local, no traffic either way
r = mergeStates(
  { targets: { kcal: 1800, u: 7 }, days: {}, custom: {} },
  { targets: { kcal: 1900, u: 7 }, days: {}, custom: {} },
);
check('equal u keeps local quietly', r.merged.targets.kcal === 1800 && !r.push.targets && !r.changedLocal);

// 6. tombstone: a newer deletion beats an older live food (no resurrection)
r = mergeStates(
  { targets: null, days: {}, custom: { whey: { deleted: true, u: 900 } } },
  { targets: null, days: {}, custom: { whey: { name: 'whey', per100: { kcal: 380 }, u: 500 } } },
);
check('newer tombstone wins + pushes', r.merged.custom.whey.deleted === true && r.push.custom.includes('whey'));

// 7. unrelated top-level keys survive the merge
r = mergeStates(
  { targets: null, days: {}, custom: {}, someFutureFlag: true },
  { targets: null, days: {}, custom: {} },
);
check('extra state keys preserved', r.merged.someFutureFlag === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
