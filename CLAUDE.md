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
| 358–2470 | `<style>` — All CSS, including CSS variables for theming |
| 2475 | `#app-source` script block opens (all JSX below lives here) |
| 2476 | React hooks imports |
| 2478–2527 | `Icons` — SVG icon components |
| 2528–3128 | Utility functions (`APP_VERSION`, `generateId`, `safeHostname`, `stripUrlFragment`, `normalizeUrlKey`, `formatFailedLinkReport`, `formatTime`, the "explain" lookup helpers `detectAskTrigger`/`lookupTerm`/`speakText`, `fetchWithTimeout`/`raceStaggered`/`netHints`, `linkTrace`, the `NOTEBOOK_*` constants + `isNotebookSource`, `scoreSourceMatch` filename↔title matching, etc.) |
| 2683–2730 | `linkTrace` — bounded diagnostics buffer for the `[HJ:]` log stream (see **Saving a link that failed to load**) |
| 3129–3400 | `HJStore` — IndexedDB-backed persistence with an in-memory cache (localStorage fallback) |
| 3217–3225 | Legacy localStorage rename migration (`marginalia_` → `harkenjot_`) |
| 3450–3720 | `parseGitHubUrl` + `markdownToReadableText` — GitHub link recognition and the GFM-markdown-to-reading-text converter |
| 3829–3893 | `Toast` — Notification component with undo support |
| 3895–4102 | `MediaSessionManager` — Browser Media Session API integration |
| 4104–4774 | `App` — Root component, state management, tab routing, failed-link recording |
| 4776–4873 | `EditableTitle` — Inline title editing component |
| 4875–5382 | `NotebookLMModal` — Modal for tagging local audio as a Gemini Notebook podcast and linking its notebook URL/source |
| 5384–8702 | `ReaderView` — Article/PDF reader (incl. X.com posts/Articles) with TTS and voice notes |
| 8704–12405 | `MediaView` — YouTube / podcast / X.com video / local audio player with timestamped notes |
| 12407–12887 | `LibraryView` — Source and note management, the **Unloaded links** panel, import/export |
| 12889–13093 | `NoteSidebar` — Notes display, editing, and navigation |
| 13095 | `ReactDOM.createRoot` render call |

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
- `carMode` — Simplified large-button UI mode. In car mode the 2x2 button grid is
  **Volume Up / Voice / Volume Down / Car**; Type and Search are deliberately hidden
  there (they need the keyboard and a steady eye) and return the moment you leave it
- `restoredSession` — Last tab/source restored from the persisted `session` key on startup
- `selectedVoiceURI` — Global TTS voice preference (`null` = auto-select best voice)
- `volume` — Global playback volume, 0-1 (see **In-app volume** below)
- `toast` / `undoData` — Toast notification state and pending undo payload
- `isMobileDevice` — Mobile detection used to adapt UI affordances
- `pendingNotebookLMModal` — Set when a local audio file is loaded so MediaView can show the NotebookLM modal
- `failedLinks` — URLs that failed to load, with the diagnostic trace of the attempt (see **Saving a link that failed to load**)
- `retryLink` — Set when a saved failure is retried from the library; the target view consumes it, refills its input and re-runs the load

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
| `volume` | `harkenjot_volume` | Global playback volume (number, 0-1) |
| `net_hints` | `harkenjot_net_hints` | Network routing memory: last-working CORS proxy per host, hosts whose proxy chain returned no article (7-day TTL), learned custom-domain Substack hosts, show-name → RSS feed map (7-day TTL) |
| `feed_cache` | `harkenjot_feed_cache` | Parsed podcast episode lists keyed by feed URL (12 h TTL, 15 feeds LRU, ≤100 items each) so repeat loads skip refetch/reparse |
| `failed_links` | `harkenjot_failed_links` | Links that failed to load, newest first, capped at 50 — each with where it failed and the trace of the attempt |

### In-app volume

`volume` (0-1, App state, persisted under the `volume` key) is applied to **all four**
playback paths, each by its own mechanism — add any new path to all of them:

| Path | Mechanism |
|------|-----------|
| Podcast / local audio | `audioPlayerRef.current.volume`, plus `onDurationChange` for initial load |
| X.com video | `videoPlayerRef.current.volume`, plus `onLoadedMetadata` |
| YouTube | `playerRef.current.setVolume(0-100)` — **not** 0-1; re-asserted in `onReady` and on
  `PLAYING`, because YouTube resets it on some loads (same reason speed is re-asserted) |
| Reader TTS | `utterance.volume`, plus a `prevVolumeRef` effect that restarts the current
  sentence — `utterance.volume` is fixed at construction, so without it a change isn't
  heard until the next sentence |

**Never route a media element through Web Audio to do this.** A `GainNode` via
`createMediaElementSource` would be the app's only element-to-Web-Audio routing and would
change the output path that the audio-focus behaviour (and every comment around the
media-session anchor) is tuned around. Plain `element.volume` is the non-disruptive option.

`element.volume` is a **multiplier on top of the device media volume** — it can attenuate
below the phone's current media volume but never exceed it. Set the phone's media volume
high once, then trim in-app.

**Why this exists.** These buttons were built when the car's own volume knob could not
reach the app at all. **That has since changed — the knob now works** — but the in-app
control still earns its place: it works in the browser and away from Android Auto, and it
trims below the device media volume.

The history is worth keeping, because it rules out the things a future investigation would
otherwise re-test. Audio focus and stream type were never the problem: the phone's own
volume buttons have always controlled HarkenJot correctly on the "Media" stream, for every
source type. Bluetooth A2DP was ruled out too — media audio is disabled on both ends, so
the audio travels over the Android Auto link. What was actually happening is that Android
Auto bound its knob to the media app *it* had selected — one registering a
`MediaBrowserService` and appearing in AA's app list, which a browser tab cannot be — so the
AA screen showed the last selected media app rather than HarkenJot and the knob adjusted
that instead. Android Auto's multi-card dashboard rollout (17.2) changed this: AA now
surfaces Chrome's media session as its own card, and the knob reaches the app.

The lesson to carry forward is not "the knob can never work" — that framing was wrong — but
that this surface is owned by Android Auto and Chrome, and can change under the app without
any code change on our side. Re-test before assuming either way.

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
- **ForumMagnum GraphQL** — `www.lesswrong.com/graphql`, `www.alignmentforum.org/graphql`, `forum.effectivealtruism.org/graphql`. `{post(input:{selector:{documentId:"<id>"}}){result{title,htmlBody}}}` returns the post body as clean HTML — no nav, no footer, no comments. Called from a **sandboxed iframe** (see below); also as a `?query=` GET through the proxy chain, which works because these servers run Apollo with `csrfPrevention: false`
- **GreaterWrong** — `www.greaterwrong.com` / `ea.greaterwrong.com`, a server-rendered mirror of the same forums, fetched through the CORS proxy chain as the fallback when `/graphql` can't be reached. `?comments=false&hide-nav-bars=true` strips the page down to the post itself
- **GitHub** — `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` for README and in-repo markdown source (a CDN, no rate limit, `Access-Control-Allow-Origin: *`), with `api.github.com/repos/<owner>/<repo>/readme` as the authority on whatever the README is actually called. Both CORS-enabled, so neither needs a proxy
- **Wiktionary / Wikipedia** — `en.wiktionary.org/api/rest_v1/page/definition/` and `en.wikipedia.org/api/rest_v1/page/summary/` (both CORS-enabled, fetched directly with 3 s timeouts) for the voice-triggered "explain \<term\>" lookup
- **rss2json** — `api.rss2json.com` server-side RSS-to-JSON conversion (CORS-enabled) for feeds whose bot protection blocks raw CORS proxies; tried *first* for directly pasted Substack feeds (`api.substack.com/feed/podcast/*.rss`) and as a *last resort* for all other feeds (free tier only returns the ~10 newest items, so it's deprioritized when matching a specific episode title)
- **iTunes** — `itunes.apple.com/search` for podcast discovery and cover art; `itunes.apple.com/lookup` for episode lists
- **RSS feeds** — Custom parser for podcast episodes
- **Gemini Notebook** (formerly NotebookLM) — `notebook.google.com` opened in a new tab ("Open in Gemini Notebook" buttons); notebook URLs can be linked to local-audio sources. Google rebranded the product in July 2026 and moved it off `notebooklm.google.com`, which still redirects. `NOTEBOOK_URL_RE` accepts the new host plus both legacy hosts so links saved before the rebrand keep validating; `NOTEBOOK_HOME_URL` is the single home-page constant. Stored URLs are never rewritten — the redirect covers them. Internal field names (`isNotebookLM`, `notebookLMUrl`) and `Icons.NotebookLM` deliberately keep the old name so existing saved data is untouched.

  **There is no create-notebook deep link — do not go looking for one again.** The "Open in
  Gemini Notebook" buttons copy the source URL and open `NOTEBOOK_HOME_URL`, which lands on the
  notebook *list*; the screen you paste a link into is a modal on an already-created notebook
  (`/notebook/<uuid>`, a fresh id each time), so there is nothing stable to link to.
  `/notebook/new` bounces back to the list. Google documents no URL entry point either, and the
  popular NotebookLM Web Importer extension resorts to intercepting and replaying the private
  add-source API rather than using one. The toast therefore names the extra tap ("Create new")
  instead of pretending the button can skip it.

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
Articles loaded in the reader tab are saved as regular `article` sources. So are
GitHub READMEs and in-repo markdown docs. Local
audio files (e.g. Gemini Notebook podcast exports) are `podcast` sources with
`localFile: true`, and may carry a linked Gemini Notebook URL in `notebookLMUrl`.
Use the `isNotebookSource(source)` helper rather than re-testing the title —
it covers the `isNotebookLM` flag plus both the old and new brand names.

**Note object**:
```js
{ id, sourceId, text, position, timestamp, date, ... }
```

Notes reference their parent source via `sourceId`. Position anchoring differs by source type: sentence index for text, timestamp for media.

**Failed-link object** (the `failed_links` key — not a source, and never in `sources`):
```js
{ id, url, view, stage, reason, detail, trace, attempts, appVersion, firstFailedAt, lastFailedAt }
```

`view` is `reader` or `media` and decides which tab Retry opens. See **Saving a
link that failed to load** for what `stage` and `trace` carry.

### Error Handling

- CORS fetch uses a chain of proxy fallbacks
- Speech recognition falls back from Web Speech API to Whisper
- User-facing errors shown via the `Toast` component

### Saving a link that failed to load

A URL typed into the reader or player used to live only in that view's input box.
A failed fetch left it sitting there — but a tab change, a remount (both views are
keyed on `currentSource`), or a reload threw it away, so the cost of a failure was
retyping the link from wherever it came from. Every failure path now calls
`recordFailedLink` instead, and the saved entries render as the **Unloaded links**
panel at the top of the library, each with Retry / Link / Report / delete. The
panel is **collapsed by default** — the count badge is what makes the backlog
impossible to miss, so the entries don't sit between you and the library on every
visit.

Entries are keyed by `normalizeUrlKey`, so a retry updates one entry (bumping
`attempts`) rather than piling up near-duplicates. `addSource` calls
`dropFailedLink` for the source's URL, so a link that eventually loads — including
one pasted in manually after the fetch failed — clears itself off the list. The
list is capped at 50 and its panel is height-capped in CSS, so it can neither grow
without bound nor bury the library.

**Retrying re-runs the ordinary path, on purpose.** Most of these failures are not
deterministic: the CORS proxies are free services that rate-limit and go down,
Jina's keyless tier is rate-limited, `archive.org` may have no snapshot *today*,
and every tier is on a timeout. The same link often loads on a later day with no
code change — which is most of why keeping it is worth anything.

**`stage` is the part worth reading.** The pipelines fail in genuinely different
places, and the fix differs by place: `blocked` (a WAF beat every route — paste the
text), `extraction` (routes answered but nothing was article-sized — a parser
problem), `x-extract`, `pdf-fetch`, `feed-lookup` (iTunes found no feed for the
show), `feed-parse`, `spotify-metadata`, `parse` (the URL itself carried no id),
`unrecognised`, `wrong-tab` (an X post that is really a video — recorded against
the *player*, so Retry opens it where it will work), and `exception`.

**The trace comes from the logging that already existed.** Every tier narrates
itself through `console.log('[HJ:…]')`, so rather than threading a collector
through forty call sites, `linkTrace` wraps `console.log`/`warn`/`error` once and
keeps the `[HJ:]` lines in a bounded ring buffer. A loader takes `linkTrace.mark()`
before starting and `linkTrace.since(mark)` on failure, which yields exactly the
lines its own attempt emitted. The original console method is always called first,
and the capture is wrapped in its own `try`, so diagnostics can never break logging.

Two rules the buffer imposes on new logging:

- **Prefix an outcome, not an attempt.** `[HJ:]` lines are captured; unprefixed
  ones are not. The proxy chain's "Trying …" lines are deliberately left
  unprefixed — they double the volume and say nothing the outcome line doesn't.
- **An outcome line must stand on its own**, because it is read far from its
  context. `[HJ:net] <proxy> → <targetUrl> failed: …` names both ends; the bare
  `<proxy> failed:` it replaced did not say *what* it was fetching, which was
  useless once four tiers were sharing the chain.

`MediaView` takes its mark in `loadMedia`, the single entry point through which the
Spotify and RSS loaders are always reached, so one mark spans however many hops the
resolution takes and every failure reports against the URL that was actually typed.

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
That list is the hardcoded half; the other half is **learned**. When the chain
returns no article for a host, `netHints.recordProxyDead()` remembers it, and
the next article from that publisher gets the same head start instead of paying
the chain's ~15 s to lose again. A later tier-1 success clears the hint, and it
expires after a week regardless, so a temporary block doesn't stick.

**A short post is not a truncated one.** `THIN_ARTICLE_CHARS` exists to catch
paywall stubs, but company newsrooms routinely publish complete 400–900 char
announcements. Those used to pay for every fallback tier — and because no tier
can return more text than the article contains, nothing ever cleared the
threshold, so the walk awaited *all five* (Jina's 25 s included) before settling
for the tier-1 text it already had. `looksCompleteArticle()` judges shape rather
than length: at least 400 chars, four finished sentences, ending on terminal
punctuation, and no truncation/paywall marker (`TRUNCATION_MARKERS`). A post
that passes is banked immediately and skips the fallbacks entirely.

Once *any* result is in hand the rest of the walk is a hunt for a better one, so
it runs under an 8 s grace window rather than the sum of the remaining tiers'
timeouts. With nothing in hand there is no grace — the alternative to waiting is
a manual paste, so the walk runs to the end. `tryArchiveToday` races `archive.ph`
and `archive.is` through `raceStaggered` (both are front doors onto the same
archive) instead of trying them serially, where a dead first mirror cost a whole
proxy chain before the second one started.

**The article is not always in the DOM.** `extractArticleContent` reads two
Next.js shapes, and they are not interchangeable. Pages Router sites (Forbes)
carry a single `script#__NEXT_DATA__` JSON blob. **App Router** sites (Next 13+,
including `anthropic.com` and `claude.com`) have no such blob — the server
streams the React tree as an RSC flight payload chunked across
`self.__next_f.push([1,"…"])` calls, so the article text sits in `<script>`
elements that the cleanup pass deletes before any DOM strategy sees them. The
chunk sources are therefore stashed *before* removal and decoded in Strategy D2:
concatenate the chunks, `JSON.parse` each to unescape, split the payload into
`<hex id>:<json>` rows, and walk each row for React elements (`["$", tag, key,
props]`) whose tag is block-level prose. Layout wrappers and client-component
references (tags like `"$L5"`) never match, which keeps nav and footer markup out
without a furniture heuristic; identical blocks are deduped because the shell and
the streamed segment often carry the same tree.

Decoding is **deliberately gated on a thin (<900 char) DOM result**. Where the
DOM strategies worked they have already isolated the article, whereas the flight
payload is the *whole page* — letting it compete on length would trade a clean
extraction for one with the footer welded on. Do not remove that gate to "catch
more"; it is what keeps the decoder from regressing every App Router site.

**In the flight format, only `props.children` is text.** A React element is
`["$", tag, key, props]`, so walking that array as if it were a list of children
splices the tag name *and every prop value* into the middle of the sentence — a
paragraph with one inline link came out as "…the a/engineeringengineering
team…", which is what these pages are full of. Three more rules the format
imposes, each of which silently dropped or corrupted prose before:

- **A string starting with `$` is a marker, never text.** `"$L8"`/`"$8"` point at
  another row, `"$undefined"` and `"$Sreact.suspense"` are sentinels, and a
  literal leading `$` is escaped by **doubling** it — so `"$$4.2M"` is the text
  `"$4.2M"`, and blanket-dropping every `"$…"` string lost whole paragraphs that
  opened on a dollar amount.
- **Streamed prose is a reference, not inline.** A `<p>` whose `children` is
  `"$L7"` has its text in row 7, so the rows are kept by id and references are
  followed (guarded against cycles). Without that the paragraph decodes empty.
- **A `T` row is raw text, not JSON**, prefixed with its length in UTF-8
  **bytes** — and that text may contain newlines. It has to be measured by
  encoded width rather than split on `\n`, or the row swallows every row after
  it. This is why the payload is walked with a cursor instead of
  `payload.split('\n')`.

The article's own `<h1>` is short and has no terminal punctuation, so the
leading-furniture trim treated it exactly like a nav label and opened the
article mid-story. The trim now backs up to the last `<h1>` ahead of the first
prose block — a menu label is never an `h1`, so this costs nothing.

**A fragment is not part of the URL for anything downstream.** Shared links
routinely point at a section (METR's study link ends in `#motivation`). No server
ever receives the fragment, but it travels into every route that treats the URL
as *data*: `archive.org/wayback/available` and archive.today both index
fragment-free URLs and report **no snapshot** for one carrying `#motivation`, so
two fallback tiers were lost before they started, and the saved source never
matched the same article linked without it. `stripUrlFragment` canonicalises once
up front and `fetchContent` hands the result to `fetchArticleFromUrl`, so every
tier — and the saved source — works from one string. The reader renders extracted
plain text with no anchors to jump to, so nothing wants the fragment back.

Rendered-markdown wrappers (`.prose` from Tailwind Typography, `.post-body`,
`.markdown-body`, `[itemprop="articleBody"]`) sit in the content-selector list
ahead of `article`/`main`. A framework or static-site blog (METR's among them)
has no CMS class to match on; the typography wrapper is the one element that is
the article and none of the chrome around it.

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

**A custom domain hides which stack it is.** Substack serves `<origin>/api/v1/posts/<slug>`
with clean `body_html`, and the early path spends the full proxy chain on it for
hosts already known to be Substack — `SUBSTACK_SEED_HOSTS` plus whatever
`netHints.recordSubstackHost` has learned. Seeds are checked *alongside* the
stored list, never used as its default: seeding only on first load meant a host
added to the code later never reached anyone who already had a `net_hints`
record. An unrecognised `/p/<slug>` host gets a two-proxy probe instead of the
chain, and if that misses, `looksLikeSubstack()` reads the fetched page markup —
`substackcdn.com`, `window._preloads`, `available-content` — and retries the API
as a fallback tier, so a new custom domain works without a code change. An API
body under `THIN_ARTICLE_CHARS` is a subscriber preview: it is kept as a floor
for the pipeline, never banked and returned.

The fallback order is Substack API → Wayback → archive.today → AMP → WordPress → Jina. The two
archive routes lead because a WAF blocks the *publisher's* origin, not the
archive's, so a snapshot is the likeliest thing to survive. When every route
fails on a bot-walled host the toast names the host rather than claiming the
content could not be extracted — nothing was ever fetched to extract.

**A sandboxed iframe has a different origin than this page, and that is the whole
trick for LessWrong.** ForumMagnum (LessWrong / Alignment Forum / EA Forum) sends
`Access-Control-Allow-Origin` on `/graphql` only to its crosspost partner and to
the opaque origin `"null"` — a deliberate, documented allowance for its
customizable home page, which runs user code in a `srcdoc` frame. So a plain
cross-origin fetch from this app is refused, while the identical fetch from an
`<iframe sandbox="allow-scripts">` (no `allow-same-origin`, or the origin stops
being opaque) is allowed. `fetchViaNullOriginFrame` builds that frame, fetches
inside it, `postMessage`s the body back under a random token, and always removes
the frame. Verified end-to-end in Chromium against a server replicating those
CORS rules.

The second half of the win is the network path: the request leaves the reader's
own browser, so the WAF that hands every CORS proxy a challenge page never sees a
datacenter IP.

`parseForumMagnumUrl` pulls the post id out of `/posts/<id>/<slug>` or
`/s/<seq>/p/<id>`, and the tiers are: null-origin-frame GraphQL, then a race
between the same query as a proxied `?query=` GET and the **GreaterWrong** mirror
(GraphQL starts 3 s ahead — its result is cleaner). Alignment Forum posts are
mirrored from LessWrong under the same id and AF's own endpoint doesn't reliably
return `htmlBody`, so AF URLs ask lesswrong.com first. GreaterWrong HTML is
*sliced* at `.body-text.post-body` (falling back to `main.post`) before extraction
— its comment tree lives outside `<main>` in `#comments`, and the title has to be
read off `h1.post-title` because the sliced fragment carries no title metadata.

**Route the proxied GraphQL call through `fetchHtmlViaProxies`, never a bare
`fetch` loop.** A proxy will forward a compressed body without the matching
`Content-Encoding` header, so `response.text()` hands back binary and `JSON.parse`
then fails on every proxy in turn — indistinguishable from the site being down.
That is what the shared fetcher's `decodeBody` exists for, and skipping it is what
made this path look like it worked while returning nothing.

**A GitHub repo link is a README, and GitHub gives away the markdown source.**
`raw.githubusercontent.com` answers `Access-Control-Allow-Origin: *`, so the
reader fetches the README's own markdown with no proxy in the path and no page
chrome to unweld afterwards — the rendered repo page is a file tree, a commit bar
and a sidebar wrapped around the same text. The one thing raw can't do is *find*
the README: the ref and filename have to be supplied. **`HEAD` resolves to the
default branch**, which is what removes the main-vs-master guess, and `README.md`
covers all but a handful of repos, so the common case is one request. The other
spellings (`readme.md`, `README.rst`, extensionless, …) go out together on a miss
rather than in series, because they are cheap CDN 404s.

`api.github.com/repos/<owner>/<repo>/readme` is the authority on the rest — any
casing, a README in a subdirectory — and is **second, not first**, because
unauthenticated calls are capped at 60/hour per IP, which a reader tab can burn
through in an afternoon. `Accept: application/vnd.github.raw` asks for the file
rather than the base64 envelope, but both shapes are handled, and `atob` yields
bytes so the UTF-8 decode is not optional (a README is full of emoji).

There is deliberately **no proxied tier**: a proxy adds nothing to a route that is
already CORS-open. When both fail the route stands down and the standard pipeline
fetches the repo page, where `.markdown-body` — already in the content-selector
list, because it is GitHub's own class — is the rendered README.

`parseGitHubUrl` only claims links that have a doc behind them: the bare repo
(including `?tab=readme-ov-file`), `/tree/<ref>/<dir>`, `/blob/<ref>/<doc>` and
`raw.githubusercontent.com`. Issues, pull requests, releases, Actions and `/blob/`
pointing at source code return null and never touch GitHub — reading a `.js` file
aloud serves nobody. A ref carrying a slash (a `feature/*` branch) can't be told
from ref + path without asking the API, so the first segment is taken as the ref.

**`markdownToReadableText` is not a renderer.** It leaves text a TTS voice can
speak and `splitIntoSentences` can index, and two rules shape all of it:

- **Every block ends on terminal punctuation.** `splitIntoSentences` matches
  `[^.!?]+[.!?]+`, so a trailing run with no full stop is *dropped outright* —
  which silently lost the last list item of every README — and an unterminated
  heading welds onto the paragraph below it. Adding the stop also makes each
  heading and list item its own unit, which is what the reader lands on and what
  TTS pauses at.
- **Anything whose value is visual rather than spoken goes.** Badge images (their
  alt text is "build passing"), fenced code blocks, emoji shortcodes and nav rows
  of pipe-separated links. A bare URL keeps **only its host**: the reader renders
  no anchors to follow, but deleting the URL outright breaks the sentence it sat
  in ("See for a list of forums").

Four things the format imposes, each of which corrupted prose before:

- **A task-list checkbox needs the space after it checked.** `- [X](https://…)`
  is a link, not a ticked box; matching `\[[ xX]\]` without the lookahead ate the
  link text and left a stray `(`.
- **Escapes come off first.** Leave them and the emphasis rules strip the
  asterisks out of `\*literal\*` and leave the backslashes behind.
- **Outer pipes are optional in GFM**, so the `|---|:-:|` alignment row is the only
  reliable mark of a table — which makes it the thing that also rescues the header
  line still sitting unflushed above it.
- **Reference links count as links.** Nav-row detection counts closing brackets,
  not `](`, because Rust's README heads with a row built entirely out of
  `[Learn] | [Docs]` shortcut refs.

Indented (4-space) code blocks are deliberately **left as text**: telling one from
a list item's own nested content needs a real parser, and guessing wrong drops
real prose. Entities are decoded with the browser's own table via a `textarea`
(its content is RCDATA, so nothing inside is ever parsed into an element) rather
than a hand-maintained map — `&middot;` between badges and `&amp;` in a title are
routine.


## Making Changes

### Adding a New Feature

1. Identify which component section in `HarkenJot.html` to modify
2. Follow existing patterns — functional components, hooks, inline styles via CSS variables
3. Keep everything in the single file (no external modules)
4. Test in Chrome/Edge (primary targets) and verify in Firefox/Safari

### Common Modification Areas

- **UI/Theme**: CSS variables in `:root` (around line 360)
- **Icons**: `Icons` object (line 2478)
- **"explain" lookup**: `detectAskTrigger`/`lookupTerm` utilities (line 2528) plus `handleAskQuery` in both `ReaderView` and `MediaView`
- **Persistence**: `HJStore` IndexedDB module (line 3129)
- **Reader functionality (incl. X.com posts/Articles)**: `ReaderView` (line 5384)
- **GitHub READMEs**: `parseGitHubUrl` / `markdownToReadableText` (line 3450) plus the Strategy 0 block in `fetchArticleFromUrl`
- **Media/podcast/X.com/local-audio functionality**: `MediaView` (line 8704)
- **Gemini Notebook linking**: `NotebookLMModal` (line 4875); URL validation via `NOTEBOOK_URL_RE` (line 3034)
- **Library/export, Unloaded links panel**: `LibraryView` (line 12407)
- **Failed-link capture**: `recordFailedLink`/`dropFailedLink` in `App`, `linkTrace` + `formatFailedLinkReport` at top level, and the `failed(…)`/`failedLoad(…)` helpers inside `fetchArticleFromUrl` and `MediaView`
- **Notes panel**: `NoteSidebar` (line 12889)
- **App-level state/routing**: `App` (line 4104)

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
