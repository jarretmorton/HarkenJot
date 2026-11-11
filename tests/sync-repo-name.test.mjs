// Repo-name matching for GitHub sync. Run with: node tests/sync-repo-name.test.mjs
// Slices HJSyncCore out of HarkenJot.html between the HJSYNC-CORE markers and
// checks sameRepo, which decides whether this device's sync record (sync_meta)
// belongs to the repo named in Settings.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../HarkenJot.html', import.meta.url), 'utf8');
const m = html.match(/\/\* HJSYNC-CORE-START \*\/([\s\S]*?)\/\* HJSYNC-CORE-END \*\//);
assert.ok(m, 'HJSYNC-CORE markers not found in HarkenJot.html');
// The core calls these two top-level helpers; sameRepo needs neither.
const HJSyncCore = new Function('getReadStatus', 'normalizeUrlKey', `${m[1]}\nreturn HJSyncCore;`)(
  () => 'unread', (u) => u,
);

let failed = 0;
const check = (name, actual, expected) => {
  try { assert.equal(actual, expected); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}: expected ${expected}, got ${actual}`); }
};
const { sameRepo } = HJSyncCore;

check('identical names match', sameRepo('jarretmorton/harkenjot-library', 'jarretmorton/harkenjot-library'), true);
check('a case-only rename matches', sameRepo('jarretmorton/harkenjot-library', 'jarretmorton/HarkenJot-Library'), true);
check('owner case is ignored too', sameRepo('JarretMorton/lib', 'jarretmorton/lib'), true);
check('a different repo does not match', sameRepo('jarretmorton/harkenjot-library', 'jarretmorton/harkenjot-library-test'), false);
check('a different owner does not match', sameRepo('someone/harkenjot-library', 'jarretmorton/harkenjot-library'), false);
check('no stored record never matches', sameRepo(undefined, 'jarretmorton/lib'), false);
check('null never matches', sameRepo(null, null), false);

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
