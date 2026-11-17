// Library order. Run with: node tests/library-order.test.mjs
// Slices HJSyncCore out of HarkenJot.html between the HJSYNC-CORE markers and
// checks patchSources (how a pull places sources) and sortSourcesByDate (the
// re-sort on load). The library groups by date and draws sources in array
// order, so the array must stay newest createdAt first.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../HarkenJot.html', import.meta.url), 'utf8');
const m = html.match(/\/\* HJSYNC-CORE-START \*\/([\s\S]*?)\/\* HJSYNC-CORE-END \*\//);
assert.ok(m, 'HJSYNC-CORE markers not found in HarkenJot.html');
// The core calls these two top-level helpers; ordering needs neither.
const HJSyncCore = new Function('getReadStatus', 'normalizeUrlKey', `${m[1]}\nreturn HJSyncCore;`)(
  () => 'unread', (u) => u,
);
const { patchSources, sortSourcesByDate } = HJSyncCore;

let failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
};

const src = (id, day, time = '12:00:00') => ({
  id, title: `Source ${id}`, status: 'complete', copiedAt: null, createdAt: `2026-${day}T${time}.000Z`,
});
const op = (o) => ({ remove: [], insert: [], patch: {}, ...o });
const ids = (list) => list.map(s => s.id);
const isSorted = (list) => list.every((s, i) => i === 0 || Date.parse(list[i - 1].createdAt) >= Date.parse(s.createdAt));
const assertSorted = (list) => assert.ok(isSorted(list), `not newest first: ${list.map(s => `${s.id}@${s.createdAt.slice(0, 10)}`).join(', ')}`);
const assertSameData = (before, after) => {
  const byId = new Map(before.map(s => [s.id, s]));
  assert.equal(after.length, before.length);
  after.forEach(s => assert.deepEqual(s, byId.get(s.id)));
};

// Nov 15: four sources had been moved to the top with Move to Today (Nov 14).
// One pull restored three of them to Apr 28, Sept 10 and Jul 23; a later pull
// restored the fourth to Nov 11.
const nov15Library = () => [
  src('nov11', '11-14', '09:04:00'),
  src('sep10', '11-14', '09:03:00'),
  src('apr28', '11-14', '09:02:00'),
  src('jul23', '11-14', '09:01:00'),
  src('n13a', '11-13'), src('n13b', '11-13', '08:00:00'),
  src('o12', '10-12'),
  src('s10b', '09-10'),
  src('j23b', '07-23'),
  src('a28b', '04-28'),
];

check('Nov 15 replay: several dates restored in one pull, then one more', () => {
  let lib = patchSources(nov15Library(), op({ patch: {
    sep10: { createdAt: '2026-09-10T08:00:00.000Z' },
    apr28: { createdAt: '2026-04-28T08:00:00.000Z' },
    jul23: { createdAt: '2026-07-23T08:00:00.000Z' },
  } }));
  assertSorted(lib);
  lib = patchSources(lib, op({ patch: { nov11: { createdAt: '2026-11-11T08:00:00.000Z' } } }));
  assertSorted(lib);
  assert.deepEqual(ids(lib), ['n13a', 'n13b', 'nov11', 'o12', 's10b', 'sep10', 'j23b', 'jul23', 'a28b', 'apr28']);
});

check('several moved sources in every starting order end sorted', () => {
  const moves = { sep10: '2026-09-10T08:00:00.000Z', apr28: '2026-04-28T08:00:00.000Z', jul23: '2026-07-23T08:00:00.000Z', nov11: '2026-11-11T08:00:00.000Z' };
  const perms = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x, ...p])));
  const base = nov15Library();
  perms(base.slice(0, 4)).forEach(top => {
    const lib = patchSources(top.concat(base.slice(4)), op({ patch: Object.fromEntries(Object.entries(moves).map(([id, t]) => [id, { createdAt: t }])) }));
    assertSorted(lib);
  });
});

check('a single moved source lands in its date group, after same-timestamp ones', () => {
  const lib = [src('a', '11-15'), src('b', '11-13'), src('c', '11-12'), src('d', '11-12'), src('e', '11-10')];
  const out = patchSources(lib, op({ patch: { a: { createdAt: '2026-11-12T12:00:00.000Z' } } }));
  assert.deepEqual(ids(out), ['b', 'c', 'd', 'a', 'e']);
  assertSorted(out);
});

check('a single source moved to today (Move to Today elsewhere) goes to the top', () => {
  const lib = [src('a', '11-15'), src('b', '11-13'), src('c', '09-10')];
  const out = patchSources(lib, op({ patch: { c: { createdAt: '2026-11-16T07:00:00.000Z' } } }));
  assert.deepEqual(ids(out), ['c', 'a', 'b']);
});

check('inserts from another device land by createdAt', () => {
  const lib = [src('a', '11-15'), src('b', '11-13'), src('c', '09-10')];
  const out = patchSources(lib, op({ insert: [src('new1', '11-14'), src('new2', '11-16'), src('new3', '01-02'), src('a', '01-01')] }));
  assert.deepEqual(ids(out), ['new2', 'a', 'new1', 'b', 'c', 'new3']);
});

check('inserts and moves in one pull end sorted', () => {
  const lib = nov15Library();
  const out = patchSources(lib, op({
    patch: { sep10: { createdAt: '2026-09-10T08:00:00.000Z' }, apr28: { createdAt: '2026-04-28T08:00:00.000Z' } },
    insert: [src('agent', '09-11')],
    remove: ['o12'],
  }));
  assertSorted(out);
  assert.ok(!ids(out).includes('o12'));
  assert.ok(ids(out).includes('agent'));
});

check('a patch without createdAt leaves the order alone', () => {
  const lib = [src('a', '11-15'), src('b', '11-13'), src('c', '09-10')];
  const out = patchSources(lib, op({ patch: { b: { status: 'in-progress' } } }));
  assert.deepEqual(ids(out), ['a', 'b', 'c']);
  assert.equal(out[1].status, 'in-progress');
});

check('load-time sort fixes an out-of-order library', () => {
  let lib = nov15Library();
  // The order the bug left behind on both devices.
  lib = ['nov11', 'sep10', 'n13a', 'n13b', 'o12', 's10b', 'j23b', 'jul23', 'a28b', 'apr28'].map(id => {
    const s = lib.find(x => x.id === id);
    const restored = { nov11: '2026-11-11', sep10: '2026-09-10', jul23: '2026-07-23', apr28: '2026-04-28' }[id];
    return restored ? { ...s, createdAt: `${restored}T08:00:00.000Z` } : s;
  });
  const before = structuredClone(lib);
  const out = sortSourcesByDate(lib);
  assertSorted(out);
  assert.deepEqual(ids(out), ['n13a', 'n13b', 'nov11', 'o12', 's10b', 'sep10', 'j23b', 'jul23', 'a28b', 'apr28']);
  assertSameData(before, out);
  assert.deepEqual(lib, before, 'the input array was changed');
});

check('load-time sort keeps same-timestamp sources in their order', () => {
  const t = '11-12';
  const lib = [src('x', '09-01'), src('p', t), src('q', t), src('r', t), src('y', '11-20')];
  assert.deepEqual(ids(sortSourcesByDate(lib)), ['y', 'p', 'q', 'r', 'x']);
});

check('load-time sort puts a missing or invalid date last, as placement does', () => {
  const lib = [{ id: 'none', title: 'n' }, src('a', '11-15'), { id: 'bad', createdAt: 'not a date' }, src('b', '11-13')];
  const out = sortSourcesByDate(lib);
  assert.deepEqual(ids(out), ['a', 'b', 'none', 'bad']);
  assertSameData(lib, out);
});

check('load-time sort returns an in-order library as the same array', () => {
  const lib = [src('a', '11-15'), src('b', '11-15'), src('c', '11-13')];
  assert.equal(sortSourcesByDate(lib), lib);
  assert.equal(sortSourcesByDate([]).length, 0);
});

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
