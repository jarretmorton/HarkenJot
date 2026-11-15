// Markdown-to-reading-text. Run with: node tests/markdown-text.test.mjs
// Slices markdownToReadableText out of HarkenJot.html between the HJMD markers
// and checks that hard-wrapped lines join instead of ending a sentence.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../HarkenJot.html', import.meta.url), 'utf8');
const m = html.match(/\/\* HJMD-START \*\/([\s\S]*?)\/\* HJMD-END \*\//);
assert.ok(m, 'HJMD markers not found in HarkenJot.html');
// decodeEntities uses a DOM textarea in the app; the cases here carry no entities.
const md2text = new Function('decodeEntities', `${m[1]}\nreturn markdownToReadableText;`)((s) => s);
const text = (md) => md2text(md).text;

let failed = 0;
const check = (name, actual, expected) => {
  try { assert.equal(actual, expected); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}:\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`); }
};

check('a wrapped numbered item joins its continuation line',
  text('1. **Every displayed fact cites one of three sites:** PubChem\n   (`pubchem.ncbi.nlm.nih.gov`), or LibreTexts.\n2. **Every fact has a record.**'),
  'Every displayed fact cites one of three sites: PubChem (pubchem.ncbi.nlm.nih.gov), or LibreTexts. Every fact has a record.');

check('a wrapped bullet joins a lazy (unindented) continuation',
  text('- It agrees with Los Alamos on all 102 elements both cover, except\nlawrencium, a real dispute.\n- It is the only source.'),
  'It agrees with Los Alamos on all 102 elements both cover, except lawrencium, a real dispute. It is the only source.');

check('a wrapped paragraph joins',
  text('AtomiTron is a chemistry reference for a young learner, so a wrong fact is the\nworst possible bug.'),
  'AtomiTron is a chemistry reference for a young learner, so a wrong fact is the worst possible bug.');

check('a wrapped blockquote joins',
  text('> **Status: approved.** Where a rule is based on\n> measured evidence, the evidence is given.'),
  'Status: approved. Where a rule is based on measured evidence, the evidence is given.');

check('an unterminated item still ends at the next item',
  text('- Install\n- Run'),
  'Install. Run.');

check('a blank line still ends an item',
  text('- First item\n\nA paragraph after it.'),
  'First item. A paragraph after it.');

check('an indented continuation joins its item',
  text('- Item one\n  continues here\n- Item two'),
  'Item one continues here. Item two.');

check('a rule after an item is not a setext heading',
  md2text('- An item\n---\n\nText.').title + '|' + text('- An item\n---\n\nText.'),
  '|An item. Text.');

check('a setext heading still works after a paragraph',
  md2text('Title\n=====\n\nBody text.').title,
  'Title');

check('a quote under an item is its own block',
  text('- An item\n> A quote'),
  'An item. A quote.');

check('a heading ends an item',
  text('- An item\n## Next'),
  'An item. Next.');

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
