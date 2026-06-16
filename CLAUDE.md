# CLAUDE.md — HarkenJot

## Project Overview

HarkenJot is a **single-file web application** for taking notes while consuming audio, video, and text content. The entire application lives in `HarkenJot.html` (~9,700 lines). There is no build system, no package manager, and no backend server. This app is currently only for personal use.

## Architecture

### Single-File Design

Everything — HTML, CSS, and JavaScript (React/JSX) — is in one file: `HarkenJot.html`. Dependencies are loaded from CDNs at runtime. Babel Standalone transpiles JSX in the browser.

### File Structure

```
HarkenJot.html   # The entire application
README.md        # Project documentation
CLAUDE.md        # This file
NotebookLM.png   # NotebookLM logo asset (not referenced by the app or README)
.nojekyll        # Tells GitHub Pages to serve the repo root as-is (no Jekyll)
```

### Key Sections in HarkenJot.html

Line numbers are approximate — they drift as the file grows. Search for the named symbol if a range is stale.

| Line Range | Section |
|------------|---------|
| 3–~135 | Head — dependency **bootstrap loader** (pinned versions, multi-CDN fallback, explicit JSX transpile, blank-screen watchdog/error UI) |
| 14–57 | `webSpeechAPI` — Browser-native speech recognition module |
| 62–227 | `whisperASR` — Offline Whisper AI fallback (Transformers.js, loaded via dynamic `import()`) |
| 231 | Google Fonts `<link>` (Crimson Pro, DM Sans, JetBrains Mono) |
| 232–2115 | `<style>` — All CSS, including CSS variables for theming |
| 2121 | React hooks imports |
| 2124–2163 | `Icons` — SVG icon components |
| 2166–2282 | Utility functions (`generateId`, `safeHostname`, `formatTime`, NotebookLM filename↔title matching, etc.) |
| 2283–2453 | `HJStore` — IndexedDB-backed persistence with an in-memory cache (localStorage fallback) |
| 2330–2339 | Legacy localStorage rename migration (`marginalia_` → `harkenjot_`) |
| 2503–2566 | `Toast` — Notification component with undo support |
| 2568–2705 | `MediaSessionManager` — Browser Media Session API integration |
| 2721–3285 | `App` — Root component, state management, tab routing |
| 3288–3385 | `EditableTitle` — Inline title editing component |
| 3387–3793 | `NotebookLMModal` — Modal for tagging local audio as a NotebookLM podcast and linking its notebook URL/source |
| 3795–6076 | `ReaderView` — Article/PDF reader with TTS and voice notes |
| 6077–9106 | `MediaView` — YouTube / podcast / X.com video / local audio player with timestamped notes |
| 9107–9456 | `LibraryView` — Source and note management, import/export |
| 9457–9658 | `NoteSidebar` — Notes display, editing, and navigation |
| 9659 | `ReactDOM.createRoot` render call |

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

### Speech Recognition

Two recognition systems with automatic fallback:

1. **Web Speech API** (`webSpeechAPI`) — Primary. Uses browser-native recognition (Google's service on Chrome/Edge). Requires network.
2. **Whisper AI** (`whisperASR`) — Fallback. Runs `Xenova/whisper-tiny.en` model locally via Transformers.js. Works offline after initial model download.

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

- **CORS proxies** — `corsproxy.io`, `api.allorigins.win`, `api.codetabs.com`, `thingproxy.freeboard.io` for fetching articles, RSS feeds, and oEmbed/scraped metadata
- **Jina Reader** — `r.jina.ai` as a fallback for article text extraction
- **YouTube** — IFrame API for playback; `youtube.com/oembed` for video metadata
- **Spotify oEmbed** — `open.spotify.com/oembed` for podcast/episode metadata
- **X.com / Twitter oEmbed** — `publish.twitter.com/oembed` for embedding X.com videos and tweets
- **iTunes** — `itunes.apple.com/search` for podcast discovery and cover art; `itunes.apple.com/lookup` for episode lists
- **RSS feeds** — Custom parser for podcast episodes
- **NotebookLM** — `notebooklm.google.com` opened in a new tab ("Open in NotebookLM" buttons); notebook URLs can be linked to local-audio sources

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
video), or `voice` (standalone voice-note recordings). Local audio files (e.g.
NotebookLM podcast exports) are `podcast` sources with `localFile: true`, and may
carry a linked NotebookLM notebook URL.

**Note object**:
```js
{ id, sourceId, text, position, timestamp, date, ... }
```

Notes reference their parent source via `sourceId`. Position anchoring differs by source type: sentence index for text, timestamp for media.

### Error Handling

- CORS fetch uses a chain of proxy fallbacks
- Speech recognition falls back from Web Speech API to Whisper
- User-facing errors shown via the `Toast` component

## Making Changes

### Adding a New Feature

1. Identify which component section in `HarkenJot.html` to modify
2. Follow existing patterns — functional components, hooks, inline styles via CSS variables
3. Keep everything in the single file (no external modules)
4. Test in Chrome/Edge (primary targets) and verify in Firefox/Safari

### Common Modification Areas

- **UI/Theme**: CSS variables in `:root` (around line 233)
- **Icons**: `Icons` object (line 2124)
- **Persistence**: `HJStore` IndexedDB module (line 2283)
- **Reader functionality**: `ReaderView` (line 3795)
- **Media/podcast/X.com/local-audio functionality**: `MediaView` (line 6077)
- **NotebookLM linking**: `NotebookLMModal` (line 3387)
- **Library/export**: `LibraryView` (line 9107)
- **Notes panel**: `NoteSidebar` (line 9457)
- **App-level state/routing**: `App` (line 2721)

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
  - PR creation link: `https://github.com/jarretmorton/Research-App/pull/new/<branch-name>`
  - If a PR already exists: `https://github.com/jarretmorton/Research-App/pull/<pr-number>`
- **MANDATORY post-push sequence — do these in order, every time, no exceptions:**
  1. **Check the state of any existing PR for the branch FIRST**, before doing anything else with PRs. Use `pull_request_read` (or `gh pr view`) to read the `state` and `merged` fields. Do NOT skip this step even if you opened the PR earlier in the same session — it may have been merged between your last action and now.
  2. **If the most recent PR for the branch is `closed` or `merged`:** open a NEW PR for the unmerged commits with `create_pull_request` (or `gh pr create`). Do NOT update or link the closed PR — its link is not executable.
  3. **If the most recent PR is `open`:** update its title/body with `update_pull_request` (or `gh pr edit`) so the in-app "Update PR" button reflects the latest pushed changes.
  4. **Only link a PR whose state you just verified as `open`.** A merged or closed PR link is "not executable" — the user cannot act on it from mobile, and forcing them to ask for a fresh link is a hard failure of this workflow.
- After every push, the PR link in your response MUST be to a currently-open PR. If you cannot produce one (e.g. the create call failed), say so explicitly rather than linking a stale PR.

## Deployment

Upload `HarkenJot.html` to any static file host (GitHub Pages, Netlify, Vercel, S3, or any web server). HTTPS is recommended for full browser API support (microphone, Media Session).
