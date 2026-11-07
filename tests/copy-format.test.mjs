// Copy-format checks for HarkenJot. Run with: node tests/copy-format.test.mjs
// Slices the pure copy helpers out of HarkenJot.html between the HJCOPY markers
// (the same way HJSyncCore is sliced) and checks them against expected output.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../HarkenJot.html', import.meta.url), 'utf8');
const m = html.match(/\/\* HJCOPY-START \*\/([\s\S]*?)\/\* HJCOPY-END \*\//);
assert.ok(m, 'HJCOPY markers not found in HarkenJot.html');
const { formatSourceForCopy, formatNoteForCopy } =
  new Function(`${m[1]}\nreturn { formatSourceForCopy, formatNoteForCopy };`)();

let failed = 0;
const check = (name, actual, expected) => {
  try { assert.equal(actual, expected); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n--- expected\n${expected}\n--- actual\n${actual}`); }
};

// 1) Article with a highlighted sentence, an odd anchor and a normal note.
const article = { id: 'a1', type: 'article', title: 'Neural Networks Are Already Clean', url: 'https://already-clean.goodfire.com/' };
const articleNotes = [
  { position: 170, fullSentenceCaptured: true, text: '',
    context: ' That’s been the pattern for deep learning in general: the simple thing at absurd scale beats the clever one. ' },
  { position: 172, fullSentenceCaptured: false, text: 'simple thing at absurd scale beats the complicated thing', context: ', 2019....' },
  { position: 267, text: 'neuron is better described as a verb than a noun', context: 'Its job isn’t to detect a feature.' },
];
const expected1 = [
  '- [Neural Networks Are Already Clean](https://already-clean.goodfire.com/)',
  '  - [Sentence 171 "That’s been the pattern for deep learning in general: the simple thing at absurd scale beats the clever one."]',
  '  - [Sentence 173 ", 2019..."] simple thing at absurd scale beats the complicated thing',
  '  - [Sentence 268 "Its job isn’t..."] neuron is better described as a verb than a noun',
].join('\n');
check('1 article with notes', formatSourceForCopy(article, articleNotes, []), expected1);

// 2) Podcast with show name.
const podcast = { id: 'p1', type: 'podcast', showName: 'AI Explained Official Podcast',
  title: 'AI Labs Warn Race Makes Breach ‘Inevitable’', url: 'https://open.spotify.com/episode/5i8C3IlgO49IkElz1468Ie' };
const expected2 = [
  '- AI Explained Official Podcast — [AI Labs Warn Race Makes Breach ‘Inevitable’](https://open.spotify.com/episode/5i8C3IlgO49IkElz1468Ie)',
  '  - [22:02] does taste effectively equal idea efficiency',
].join('\n');
check('2 podcast with show name', formatSourceForCopy(podcast, [{ timestamp: 1322.6, text: 'does taste effectively equal idea efficiency' }], []), expected2);

// 3) NotebookLM audio linked to an article.
const linkedArticle = { id: 'src9', type: 'article', title: 'Closed-loop evaluation of LLM agents for embedded software development', url: 'https://example.org/paper' };
const nbAudio = { id: 'nb1', type: 'podcast', localFile: true, url: '', isNotebookLM: true, linkedSourceId: 'src9',
  title: 'Can_AI_Agents_Write_Safe_Firmware', notebookLMUrl: 'https://notebook.google.com/notebook/1762bc0d-ef0b-4945-9602-345eba905c55' };
check('3 NotebookLM audio, linked source present', formatSourceForCopy(nbAudio, [], [linkedArticle, nbAudio]),
  '- [Can_AI_Agents_Write_Safe_Firmware](https://notebook.google.com/notebook/1762bc0d-ef0b-4945-9602-345eba905c55) — NotebookLM audio of *Closed-loop evaluation of LLM agents for embedded software development*');
check('3b NotebookLM audio, linked source missing', formatSourceForCopy(nbAudio, [], [nbAudio]),
  '- [Can_AI_Agents_Write_Safe_Firmware](https://notebook.google.com/notebook/1762bc0d-ef0b-4945-9602-345eba905c55)');

// 4) No notes, no link.
check('4 no notes, no link', formatSourceForCopy({ id: 't1', type: 'text', title: '  Some title ', url: '' }, [], []), '- Some title');

// 5) Title with brackets; URL with a space.
const bracketed = { id: 'b1', type: 'article', title: 'Notes [draft] v2', url: 'https://example.com/a b' };
check('5 brackets escaped, url encoded', formatSourceForCopy(bracketed, [], []), '- [Notes \\[draft\\] v2](https://example.com/a%20b)');

// 6) Two sources selected: joined by "\n" into one nested list.
check('6 two sources', [[article, articleNotes], [podcast, [{ timestamp: 1322, text: 'does taste effectively equal idea efficiency' }]]]
  .map(([s, n]) => formatSourceForCopy(s, n, [])).join('\n'), `${expected1}\n${expected2}`);

// Further rules from the spec.
check('url + notebookLMUrl', formatSourceForCopy({ type: 'article', title: 'T', url: 'https://x.com/a', notebookLMUrl: 'https://notebook.google.com/notebook/n' }, [], []),
  '- [T](https://x.com/a) · [NotebookLM](https://notebook.google.com/notebook/n)');
check('link falls back to source.link', formatSourceForCopy({ type: 'youtube', title: 'V', link: 'https://youtu.be/x' }, [], []), '- [V](https://youtu.be/x)');
check('parens in url encoded', formatSourceForCopy({ type: 'article', title: 'W', url: 'https://en.wikipedia.org/wiki/Mercury_(planet)' }, [], []),
  '- [W](https://en.wikipedia.org/wiki/Mercury_%28planet%29)');
check('timestamp past an hour', formatNoteForCopy({ timestamp: 98 * 60 + 14, text: 'late' }), '  - [98:14] late');
check('timestamp zero', formatNoteForCopy({ timestamp: 0, text: 'start' }), '  - [0:00] start');
check('plain note', formatNoteForCopy({ text: 'just text' }), '  - just text');
check('position without context', formatNoteForCopy({ position: 4, text: 'no anchor' }), '  - no anchor');
check('ellipsis char stripped', formatNoteForCopy({ position: 0, context: 'One two…', text: 'x' }), '  - [Sentence 1 "One two..."] x');
check('highlight with text', formatNoteForCopy({ position: 1, fullSentenceCaptured: true, context: 'A whole sentence.', text: 'why' }),
  '  - [Sentence 2 "A whole sentence."] why');
check('multi-line note', formatNoteForCopy({ timestamp: 5, text: 'first line\nsecond line\n\nfourth' }),
  '  - [0:05] first line\n    second line\n\n    fourth');
check('no soft breaks anywhere', formatSourceForCopy(article, articleNotes, []).includes(String.fromCharCode(0x2028)), false);

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
