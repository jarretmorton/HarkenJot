# CLAUDE.md — HarkenJot

## Project Overview

HarkenJot is a **single-file web application** for taking notes while consuming audio, video, and text content. The entire application lives in `HarkenJot.html` (~10,750 lines). There is no build system, no package manager, and no backend server. This app is currently only for personal use.

## Architecture

### Single-File Design

Everything — HTML, CSS, and JavaScript (React/JSX) — is in one file: `HarkenJot.html`. Dependencies are loaded from CDNs at runtime. Babel Standalone transpiles JSX in the browser.

### File Structure

```
HarkenJot.html          # The entire application
README.md               # Project documentation
CLAUDE.md               # This file
NotebookLM.png          # NotebookLM logo asset (not referenced by the app or README)
.nojekyll               # Tells GitHub Pages to serve the repo root as-is (no Jekyll)
site.webmanifest        # PWA manifest (name, theme colour, icon set)
apple-touch-icon.png    # 180×180 iOS home-screen icon (full bleed)
icon-android-192.png    # Android / PWA icon (padded + badge-aware)
icon-android-512.png    # Android / PWA icon (padded + badge-aware)
```

### App Icon

The mark is an Erica One "H" in cream over an ink "J" on the accent red. Glyph
outlines are **traced to raw SVG paths**, so the icon never depends on a webfont
being available at runtime.

Two rules for regenerating it:

- **One geometry.** Layout is computed in font units and scaled once, so the
  favicon and every PNG derive from the same numbers and cannot drift.
- **Rasterise the PNGs *from* the SVG.** Do not redraw the mark with Pillow —
  its text renderer only takes integer point sizes, so the cap height lands a
  fraction off and the raster silently diverges from the vector.

The mark is centred on its **ink bounding box** (not the cap line, which leaves
the J's descender hanging and clipping), then scaled so the furthest ink sits at
90% of the half-width. That is what lets it survive the iOS squircle.

**Android needs its own render — do not point the manifest at the iOS one.**
Android masks the icon, so the full-bleed mark had its letters cut at the
squircle edge on a real device. `icon-android-*.png` is the same mark, still
centred, scaled down until the ink radius about the tile centre is **0.355** of
tile width — a margin of 0.145 to the edge, against 0.097 before. Android's
documented maskable safe circle is radius 0.40, so this clears it.

Both manifest entries are declared `"purpose": "any maskable"` deliberately.
Edge on Android picked the plain `any` icon over the maskable one, so shipping a
safe `any` icon is the only reliable fix — a correct maskable icon alongside a
full-bleed `any` icon does not help.

Known and accepted: a launcher-added web app gets the **browser's badge**
stamped over the bottom-right, roughly centred at `(0.80, 0.81)` with radius
`0.175` in tile fractions, which clips the J's tail. Avoiding it entirely means
shifting the mark up and off-centre; that was built, reviewed, and rejected in
favour of keeping the mark centred. Do not "fix" it by re-introducing the
shift.

The tab favicon is an inline `data:` URI in `<head>` so it travels with the
single-file app. When editing it by hand, note that the SVG's own `"` and `>`
must stay percent-encoded or they terminate the HTML attribute early and the
icon silently fails to load.

Known and accepted: at 16px the mark reads as a coloured shape rather than two
letters. That trade was made deliberately in favour of the heavier silhouette.

The in-app header mark is `Icons.Logo`, which carries the **same traced paths
and the same group transform** as the generated assets — regenerate it from the
same script rather than editing it by hand, or the header and the home-screen
icon will drift. It deliberately omits the background `<rect>`: the red ground
comes from the `.logo-icon` CSS background so it keeps following `--accent`.

The PNGs are the one exception to strict single-file deployment, and should be
deployed alongside `HarkenJot.html`. Nothing breaks without them — iOS falls
back to a screenshot thumbnail, and the inline favicon means the HTML file still
has an icon on its own. Keep them **full bleed with square corners**: iOS
applies its own superellipse mask, so pre-rounded corners get double-rounded and
transparent corners render black.

### Safe-area insets (installed PWA)

The manifest declares `"display": "standalone"`, and Chrome runs an installed PWA
**edge-to-edge** — the layout viewport extends behind the Android status and
navigation bars. `100dvh` therefore measures the *whole screen*, not the visible
area, so without compensation the bottom of the app (the playback controls) sits
underneath the nav bar. This reproduces **only** in the installed app; a browser
tab insets the viewport itself.

Two pieces, and they are a matched pair — **never ship one without the other**:

- `viewport-fit=cover` on the viewport meta. Without it `env(safe-area-inset-*)`
  resolves to `0` and the padding below is inert; with it, the page also extends
  under the *status* bar, which is why all four edges are padded, not just the bottom.
- `padding: env(safe-area-inset-*)` on `.app-container`. Safe alongside
  `height: 100dvh` because `box-sizing: border-box` is global.

`position: fixed` overlays sit outside `.app-container` and each carries its own
inset: `.toast` (`bottom`), `.sidebar` (`top` + `height`), and `.modal-overlay`
(`padding`). `.modal` uses `80dvh` with an `80vh` fallback — plain `vh` is the
*large* viewport and overflows behind the bars.

Known and accepted: at ≥140% Android font scale the media player still clips, in
the browser too. That is a separate, older bug — this view has no scroll container
(`overflow: hidden` from `html` down through `.reader-container`) while
`.reader-header` and `.playback-bar` are both `flex-shrink: 0`, so content past the
bottom edge is unreachable. Fixing it means giving the banner + artwork region
`overflow-y: auto` so `.playback-bar` stays pinned.

Measured at 388×744 with the relink banner showing: 42px clipped at 140%, 87px at
145%. The artwork wrapper is the only elastic child, and it has already collapsed to
zero height by that point — so anything that makes `.source-meta` wrap adds its full
height on top. The "Gemini Notebook" text link costs 27px there. Do not "fix" that by
taking the link back out; it is the same source-attribution slot every other media
type uses, and the real fix is the scroll container above.

### Orientation lock (installed PWA)

`site.webmanifest` declares `"orientation": "portrait"`, so the installed app stays upright
however the phone is held. Two things to know before changing it:

- **The lock belongs in the manifest, not in JS.** `screen.orientation.lock()` needs a
  fullscreen browsing context on Chrome for Android and throws `NotSupportedError` in a
  plain `standalone` PWA; MDN also flags `lock()` as not Baseline. There is deliberately no
  orientation code in `HarkenJot.html` — no `screen.orientation`, no `orientationchange`, no
  `@media (orientation: …)`.
- **It overrides the user's auto-rotate, for this app only.** That is the point, but it does
  mean the app cannot be deliberately rotated either.

`"portrait"` rather than `"portrait-primary"` so `portrait-secondary` is still allowed.

The lock also matches what car mode already assumes: `.playback-bar.car-mode` is a
full-height column ending in a 2×2 grid of `min-height: 80px` buttons (70px under 500px),
which does not fit in a phone's landscape height, and no car-mode rule is height-keyed.

**Expect a delay after deploying.** Chrome does not re-read the manifest on next launch —
`ORIENTATION_DIFFERS` triggers a WebAPK update, but the check runs on roughly a 1-day timer
(Chrome 76+) and applies on a later launch. Removing and re-adding the home-screen app
applies it immediately, which is the quick way to confirm the change took rather than
concluding it did not work.

### Key Sections in HarkenJot.html

Line numbers are approximate — they drift as the file grows. Search for the named symbol if a range is stale.

| Line Range | Section |
|------------|---------|
| 3–115 | Head — dependency **bootstrap loader** (pinned versions, multi-CDN fallback, explicit JSX transpile, blank-screen watchdog/error UI) |
| 140–191 | `webSpeechAPI` — Browser-native speech recognition module |
| 193–351 | `whisperASR` — Offline Whisper AI fallback (Transformers.js, loaded via dynamic `import()`) |
| 357 | Google Fonts `<link>` (Crimson Pro, DM Sans, JetBrains Mono) |
| 358–2294 | `<style>` — All CSS, including CSS variables for theming |
| 2301 | `#app-source` script block opens (all JSX below lives here) |
| 2302 | React hooks imports |
| 2305–2352 | `Icons` — SVG icon components |
| 2353–2698 | Utility functions (`generateId`, `safeHostname`, `formatTime`, the "explain" lookup helpers `detectAskTrigger`/`lookupTerm`/`speakText`, the `NOTEBOOK_*` constants + `isNotebookSource`, `scoreSourceMatch` filename↔title matching, etc.) |
| 2699–2956 | `HJStore` — IndexedDB-backed persistence with an in-memory cache (localStorage fallback) |
| 2785–2793 | Legacy localStorage rename migration (`marginalia_` → `harkenjot_`) |
| 2958–3021 | `Toast` — Notification component with undo support |
| 3023–3174 | `MediaSessionManager` — Browser Media Session API integration |
| 3176–3746 | `App` — Root component, state management, tab routing |
| 3748–3845 | `EditableTitle` — Inline title editing component |
| 3847–4001 | `NotebookLMModal` — Modal for tagging local audio as a Gemini Notebook podcast and linking its notebook URL/source |
| 4313–6797 | `ReaderView` — Article/PDF reader (incl. X.com posts/Articles) with TTS and voice notes |
| 6799–10144 | `MediaView` — YouTube / podcast / X.com video / local audio player with timestamped notes |
| 10146–10560 | `LibraryView` — Source and note management, import/export |
| 10562–10762 | `NoteSidebar` — Notes display, editing, and navigation |
| 10764 | `ReactDOM.createRoot` render call |

### Component Hierarchy

```
App
├── Toast
├── ReaderView (forwardRef)
│   └── EditableTitle
├── MediaView (forwardRef)
│   ├── EditableTitle
│   └── NotebookLMModal
├── LibraryView
└── NoteSidebar
```

### State Management

All state lives in the `App` component via `useState` hooks. There is no external state library. Key state:

- `sources` — Array of source objects (articles, PDFs, YouTube videos, podcasts, X.com/Twitter videos, pasted text, voice notes)
- `notes` — Array of note objects linked to sources
- `activeTab` — Current view (`reader`, `media`, `library`)
- `currentSource` — The active source being consumed
- `sidebarOpen` — Notes sidebar visibility
- `carMode` — Simplified large-button UI mode
- `restoredSession` — Last tab/source restored from the persisted `session` key on startup
- `selectedVoiceURI` — Global TTS voice preference (`null` = auto-select best voice)
- `toast` / `undoData` — Toast notification state and pending undo payload
- `isMobileDevice` — Mobile detection used to adapt UI affordances
- `pendingNotebookLMModal` — Set when a local audio file is loaded so MediaView can show the NotebookLM modal

State is persisted via the `HJStore` module, which is backed by **IndexedDB**
(object store `kv` in database `harkenjot`) to avoid the ~5 MB localStorage cap.
`HJStore` hydrates the entire keyspace into an in-memory cache on `init()` so
callers get a synchronous `get()`, then writes through to IndexedDB
asynchronously on each `set()`. If IndexedDB is unavailable, it seeds the cache
from `localStorage` (using the `harkenjot_*` keys below); note this fallback is
read-only — `set()` does not write back to `localStorage`. On first run it
migrates any existing `localStorage` values into IndexedDB, after first honoring
the legacy `marginalia_` → `harkenjot_` rename. The `session` key is written via
`HJStore.setIfNewer()`, which compares `.ts` timestamps inside one IDB
transaction so a stale background tab can't clobber the session saved by the tab
the user actually used last.

| Key | localStorage fallback key | Content |
|-----|---------------------------|---------|
| `sources` | `harkenjot_sources` | All source objects (JSON) |
| `notes` | `harkenjot_notes` | All note objects (JSON) |
| `positions` | `harkenjot_positions` | Reading positions in articles/PDFs |
| `media_positions` | `harkenjot_media_positions` | Playback positions in media |
| `session` | `harkenjot_session` | Last active tab/source (timestamped) for restore-on-reload |
| `voice_uri` | `harkenjot_voice_uri` | Global TTS voice preference (voiceURI string) |
| `net_hints` | `harkenjot_net_hints` | Network routing memory: last-working CORS proxy per host, learned custom-domain Substack hosts, show-name → RSS feed map (7-day TTL) |
| `feed_cache` | `harkenjot_feed_cache` | Parsed podcast episode lists keyed by feed URL (12 h TTL, 15 feeds LRU, ≤100 items each) so repeat loads skip refetch/reparse |

### Speech Recognition

Two recognition systems with automatic fallback:

1. **Web Speech API** (`webSpeechAPI`) — Primary. Uses browser-native recognition (Google's service on Chrome/Edge). Requires network.
2. **Whisper AI** (`whisperASR`) — Fallback. Runs `Xenova/whisper-tiny.en` model locally via Transformers.js. Works offline after initial model download.

### Voice-Triggered Lookup ("explain" command)

A voice note that starts with **"explain \<term\>"** is not saved as a raw
transcript. Instead, `detectAskTrigger` strips the trigger word and
`lookupTerm` runs a two-tier lookup — Wiktionary definitions first, then a
Wikipedia summary (retried in Title Case, since Wikipedia titles are
case-sensitive), each request capped at 3 s. The result is saved as a
first-class `Q: … / A: …` voice note anchored at the current sentence
(ReaderView) or playback timestamp (MediaView), then spoken aloud via
`speakText` using the global TTS voice; reading/playback resumes only after
the answer finishes. Both views implement this in their `handleAskQuery`.
A bare "explain" with no term is saved as a normal note.

### External Dependencies (CDN)

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.3.1 (production build) | UI framework |
| ReactDOM | 18.3.1 (production build) | React rendering |
| Babel Standalone | 7.26.4 (pinned) | In-browser JSX transpilation |
| PDF.js | 3.11.174 | PDF rendering and text extraction |
| Transformers.js | 2.17.1 | Whisper AI speech recognition (loaded async via `import()` from jsDelivr only when the Whisper fallback is needed) |

**All versions are pinned** — an unpinned `@babel/standalone` once auto-upgraded to a
build that defaulted JSX to the *automatic* runtime (emitting `import "react/jsx-runtime"`),
which broke transpilation and blanked the app. The `<head>` bootstrap loader loads each
render-critical library (React → ReactDOM → Babel) with **multi-CDN fallback**
(`unpkg` → `cdn.jsdelivr.net` → `cdnjs`), then transpiles the inert `#app-source` JSX
block exactly once using the **classic** JSX runtime (`React.createElement`, no imports)
and injects the result. PDF.js is loaded opportunistically (not boot-critical). If all
CDNs for a core library fail — or nothing mounts within a watchdog timeout — the loader
renders a visible error + Reload button instead of a blank screen. Transformers.js still
loads on demand from `cdn.jsdelivr.net`.

### External APIs Consumed

- **CORS proxies** — `corsproxy.io` (both the bare `?<url>` and the newer `?url=` forms), `api.allorigins.win`, `api.codetabs.com`, `thingproxy.freeboard.io` for fetching articles, RSS feeds, and oEmbed/scraped metadata
- **Jina Reader** — `r.jina.ai` as a fallback for article text extraction
- **Wayback Machine** — `archive.org/wayback/available` to locate the closest snapshot, then `web.archive.org/web/<ts>id_/<url>` for the bytes as originally crawled (the `id_` modifier skips the injected toolbar). CORS-enabled, so no proxy needed
- **archive.today** — `archive.ph` / `archive.is` `/newest/<url>` snapshots via the proxy chain; archived with a real browser, so these hold the rendered article for publishers that wall every proxy
- **YouTube** — IFrame API for playback; `youtube.com/oembed` for video metadata
- **Spotify oEmbed** — `open.spotify.com/oembed` for podcast/episode metadata
- **X.com / Twitter oEmbed** — `publish.twitter.com/oembed` for embedding X.com videos and tweets
- **FxTwitter / vxTwitter / Twitter syndication** — `api.fxtwitter.com`, `api.vxtwitter.com`, and `cdn.syndication.twimg.com` for extracting X.com post and Article text in the reader tab (x.com serves an empty JS shell to CORS proxies, so the page itself is never scraped); Jina Reader and `archive.ph` snapshots are rendered-page fallbacks for X Article bodies the mirror APIs don't carry
- **Wiktionary / Wikipedia** — `en.wiktionary.org/api/rest_v1/page/definition/` and `en.wikipedia.org/api/rest_v1/page/summary/` (both CORS-enabled, fetched directly with 3 s timeouts) for the voice-triggered "explain \<term\>" lookup
- **rss2json** — `api.rss2json.com` server-side RSS-to-JSON conversion (CORS-enabled) for feeds whose bot protection blocks raw CORS proxies; tried *first* for directly pasted Substack feeds (`api.substack.com/feed/podcast/*.rss`) and as a *last resort* for all other feeds (free tier only returns the ~10 newest items, so it's deprioritized when matching a specific episode title)
- **iTunes** — `itunes.apple.com/search` for podcast discovery and cover art; `itunes.apple.com/lookup` for episode lists
- **RSS feeds** — Custom parser for podcast episodes
- **Gemini Notebook** (formerly NotebookLM) — `notebook.google.com` opened in a new tab ("Open in Gemini Notebook" buttons); notebook URLs can be linked to local-audio sources. Google rebranded the product in July 2026 and moved it off `notebooklm.google.com`, which still redirects. `NOTEBOOK_URL_RE` accepts the new host plus both legacy hosts so links saved before the rebrand keep validating; `NOTEBOOK_HOME_URL` is the single home-page constant. Stored URLs are never rewritten — the redirect covers them. Internal field names (`isNotebookLM`, `notebookLMUrl`) and `Icons.NotebookLM` deliberately keep the old name so existing saved data is untouched.

### Browser APIs Used

- Web Speech API, Web Audio API, MediaRecorder (speech recognition / voice capture)
- `speechSynthesis` (text-to-speech in ReaderView)
- IndexedDB (primary persistence), localStorage (fallback); `navigator.storage.persist()` to request non-evictable storage
- Media Session API (hardware media controls)
- Screen Wake Lock API (prevent sleep during playback)
- Clipboard API (copy notes)
- FileReader (PDF, local audio, and library JSON import)
- Fetch API with CORS proxy fallbacks

## Development Workflow

### Running Locally

```bash
# Option 1: Open directly in browser
open HarkenJot.html

# Option 2: Serve locally (recommended for full CORS support)
python3 -m http.server 8000
# Visit http://localhost:8000/HarkenJot.html
```

### No Build Step

There is no build, compile, or transpile step. Edit `HarkenJot.html` directly and reload the browser. Babel transpiles JSX at runtime.

### No Tests

There is no test suite. Verify changes manually in the browser.

### No Linter or Formatter

There are no linting or formatting tools configured.

## Conventions and Patterns

### Code Style

- **JavaScript**: ES6+ with JSX, transpiled by Babel Standalone in the browser
- **React**: Functional components with hooks (`useState`, `useEffect`, `useRef`, `useCallback`, `useImperativeHandle`)
- **CSS**: All styles in a single `<style>` block using CSS variables (`:root`) for theming
- **IDs**: Generated via `Math.random().toString(36).substr(2, 9)`
- **Naming**: camelCase for functions/variables, PascalCase for React components

### Component Patterns

- `ReaderView` and `MediaView` use `React.forwardRef` with `useImperativeHandle` so `App` can call methods on them (e.g., resuming playback)
- `LibraryView` and `NoteSidebar` are plain function components receiving props
- All inter-component communication is via props (no context or event bus)

### Data Model

**Source object**:
```js
{ id, type, title, url, content, date, ... }
```

`type` is one of `article`, `text` (pasted), `pdf` (uploaded file), `youtube`,
`podcast`, `xvideo` (X.com/Twitter — itself either a `broadcast` or a `tweet`
video), or `voice` (standalone voice-note recordings). X.com posts and X
Articles loaded in the reader tab are saved as regular `article` sources. Local
audio files (e.g. Gemini Notebook podcast exports) are `podcast` sources with
`localFile: true`, and may carry a linked Gemini Notebook URL in `notebookLMUrl`.
Use the `isNotebookSource(source)` helper rather than re-testing the title —
it covers the `isNotebookLM` flag plus both the old and new brand names.

**Note object**:
```js
{ id, sourceId, text, position, timestamp, date, ... }
```

Notes reference their parent source via `sourceId`. Position anchoring differs by source type: sentence index for text, timestamp for media.

### Error Handling

- CORS fetch uses a chain of proxy fallbacks
- Speech recognition falls back from Web Speech API to Whisper
- User-facing errors shown via the `Toast` component

### Network Fetch Conventions

Every outbound fetch in the article/podcast pipelines must be bounded: use the
shared top-level `fetchWithTimeout(url, ms, options)` (default 8 s; supports an
external `options.signal` for race cancellation) — never a bare `fetch()`.
Multi-proxy attempts go through `raceStaggered(taskFns, {staggerMs})`, which
starts task N after N×stagger (2–2.5 s), lets the first non-null result win, and
aborts the losers — polite to free CORS proxies while bounding worst-case
latency. `netHints` (persisted under the `net_hints` key) remembers the
last-working proxy per host so it is tried first next time. In `fetchContent`'s
article fallbacks, Wayback/AMP/WordPress/Jina run concurrently but are awaited
in preference order; Jina is only started after tier-1 extraction fails (its
keyless tier is rate-limited).

**A bot wall is not an article.** WAF challenge pages (PerimeterX, Cloudflare,
"access denied" shells) come back as HTTP 200 with enough boilerplate to clear
a length gate, so accepting one saves the wall as the article body *and* skips
every fallback. `looksLikeBlockedPage()` gates every extraction result:
`BLOCKED_PAGE_HARD` phrases never appear in real prose and reject outright,
while `BLOCKED_PAGE_SOFT` ones (a security column may genuinely discuss
CAPTCHAs) only count against documents under 1500 chars. Extraction results
thinner than `THIN_ARTICLE_CHARS` (900) do not end the search either — the
fallback tiers still run and the longest result wins, which is what catches
paywall stubs and consent shells.

Hosts in `BOT_WALLED_HOSTS` (currently `forbes.com`) start Wayback,
archive.today and Jina *before* the proxy chain rather than after it. The chain
still runs — a proxy that slips past the wall yields the best copy of the
article — but its latency no longer stacks on top of the routes that work.

**Page furniture is not the article.** Jina returns the whole rendered page as
markdown, and an archive capture carries the publisher's masthead (plus, without
`id_`, Wayback's own toolbar). Unwrapping links and collapsing whitespace in one
pass welds all of it onto the front of the story as a preamble of stray link
text. `tryJinaReader` therefore classifies markdown **line by line** before
collapsing — link-dense lines, and short lines without sentence punctuation, are
furniture — and starts the article at the first line that isn't; it keeps the
untrimmed text if the trim would leave under 300 chars. `extractArticleContent`
does the DOM-side equivalent, removing elements with 5+ links where 70%+ of the
text sits inside them and no real paragraph does.

The fallback order is Wayback → archive.today → AMP → WordPress → Jina. The two
archive routes lead because a WAF blocks the *publisher's* origin, not the
archive's, so a snapshot is the likeliest thing to survive. When every route
fails on a bot-walled host the toast names the host rather than claiming the
content could not be extracted — nothing was ever fetched to extract.

## Making Changes

### Adding a New Feature

1. Identify which component section in `HarkenJot.html` to modify
2. Follow existing patterns — functional components, hooks, inline styles via CSS variables
3. Keep everything in the single file (no external modules)
4. Test in Chrome/Edge (primary targets) and verify in Firefox/Safari

### Common Modification Areas

- **UI/Theme**: CSS variables in `:root` (around line 359)
- **Icons**: `Icons` object (line 2305)
- **"explain" lookup**: `detectAskTrigger`/`lookupTerm` utilities (line 2425) plus `handleAskQuery` in both `ReaderView` and `MediaView`
- **Persistence**: `HJStore` IndexedDB module (line 2699)
- **Reader functionality (incl. X.com posts/Articles)**: `ReaderView` (line 4313)
- **Media/podcast/X.com/local-audio functionality**: `MediaView` (line 6799)
- **Gemini Notebook linking**: `NotebookLMModal` (line 3847); URL validation via `NOTEBOOK_URL_RE` (line 2643)
- **Library/export**: `LibraryView` (line 10146)
- **Notes panel**: `NoteSidebar` (line 10562)
- **App-level state/routing**: `App` (line 3176)

### Version

The current version is shown in the app header. Update it in the `App` component's JSX. **Always increment the version number with every change** using semantic versioning (`MAJOR.MINOR.PATCH`):

- **Patch** (`1.8.x` → `1.8.x+1`) — Small changes and bug fixes
- **Minor** (`1.x.1` → `1.x+1.0`) — New features or functional enhancements
- **Major** (`x.1.1` → `x+1.0.0`) — Only when explicitly requested by the user, or Claude may suggest a major bump for approval when a large portion of the codebase is affected

## Git Conventions

- Branches follow the pattern `claude/<description>-<id>`
- Commit messages are concise and describe the "why" (e.g., "Fix podcast audio missing wake lock on play/pause/end")
- **PR titles MUST ALWAYS include the new version number** as a prefix (e.g., "v1.8.7 — Fix podcast loading"). Never omit the version — every PR title starts with `vX.Y.Z — `
- PRs are merged via GitHub merge commits
- **CRITICAL: After EVERY `git push`, you MUST provide the GitHub PR URL.** This is non-negotiable. Always include the link in your response immediately after pushing:
  - PR creation link: `https://github.com/jarretmorton/HarkenJot/pull/new/<branch-name>`
  - If a PR already exists: `https://github.com/jarretmorton/HarkenJot/pull/<pr-number>`
- **MANDATORY post-push sequence — do these in order, every time, no exceptions:**
  1. **Check the state of any existing PR for the branch FIRST**, before doing anything else with PRs. Use `pull_request_read` (or `gh pr view`) to read the `state` and `merged` fields. Do NOT skip this step even if you opened the PR earlier in the same session — it may have been merged between your last action and now.
  2. **If the most recent PR for the branch is `closed` or `merged`:** open a NEW PR for the unmerged commits with `create_pull_request` (or `gh pr create`). Do NOT update or link the closed PR — its link is not executable.
  3. **If the most recent PR is `open`:** update its title/body with `update_pull_request` (or `gh pr edit`) so the in-app "Update PR" button reflects the latest pushed changes.
  4. **Only link a PR whose state you just verified as `open`.** A merged or closed PR link is "not executable" — the user cannot act on it from mobile, and forcing them to ask for a fresh link is a hard failure of this workflow.
- After every push, the PR link in your response MUST be to a currently-open PR. If you cannot produce one (e.g. the create call failed), say so explicitly rather than linking a stale PR.

## Deployment

Upload `HarkenJot.html` to any static file host (GitHub Pages, Netlify, Vercel, S3, or any web server). HTTPS is recommended for full browser API support (microphone, Media Session).
