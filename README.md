# HarkenJot

<img width="180" height="180" alt="apple-touch-icon" src="https://github.com/user-attachments/assets/7f23ddb2-2f2a-444a-a59e-0eb5636ad647" style="width: 15%;"/>

**Take Notes While You Listen**

HarkenJot is a self-contained note-taking web application for capturing notes while consuming audio, video, and text content. It supports voice recording with dual speech recognition (Web Speech API + Whisper AI), and works entirely in the browser with no backend or installation required.

## Features

- **Voice Notes** — Record voice notes with automatic speech-to-text via Web Speech API (primary) or Whisper AI (offline fallback)
- **Voice-Triggered Lookup** — Start a voice note with "explain \<term\>" to look it up on Wiktionary/Wikipedia; the answer is saved as a Q&A note at your current position and read aloud before playback resumes
- **Multiple Content Types** — Load articles, PDFs, GitHub READMEs, YouTube videos, podcasts, X.com/Twitter videos, X.com posts/articles, and local audio files in a single interface
- **Gemini Notebook Integration** (formerly NotebookLM) — Play Gemini Notebook podcast exports as local audio, link them back to their notebook URL, and jump to Gemini Notebook from any article
- **Text-to-Speech Reader** — Have articles and PDFs read aloud with sentence highlighting, speed control, and auto-scroll
- **Timestamped Notes** — Notes are linked to playback position (media) or sentence position (text), so you can jump back to context
- **Library Management** — Browse, search and filter your sources, and copy the ones you pick — with their notes — to paste elsewhere
- **Unloaded Links** — A link that fails to load is kept instead of lost. The library lists it with where the load gave up and a copyable report of the attempt, plus one-tap retry — worth trying, since most of these failures are free proxies and archives being temporarily unavailable rather than anything permanent
- **Car Mode** — Simplified, large-button interface for hands-free use while driving
- **Fully Offline-Capable** — All data stored locally in the browser (IndexedDB, with a localStorage fallback); no account or server needed
- **Optional GitHub Sync** — Keep the library in a private GitHub repo shared by your phone and desktop. Notes merge by note, deletes stick, edits made offline go up when you're back online, and agents can read the repo and add sources to it. Off unless you turn it on
- **Single-File Deployment** — The entire application is one HTML file (plus optional home-screen icons)
- **Add to Home Screen** — Installs to your phone's home screen with a proper app icon

<img width="1080" height="1800" alt="Screenshot_20260606_084227_Edge" src="https://github.com/user-attachments/assets/743b5bf1-d40b-4ddd-9b59-e691501dfe1f" style="width: 35%;"/>

<img width="1079" height="1799" alt="Screenshot_20260606_084243_Edge" src="https://github.com/user-attachments/assets/cd1512bb-76ca-4e36-8a6a-397a3b26bdf3" style="width: 35%;"/>
<br><br>
<img width="1080" height="1800" alt="Screenshot_20260606_084259_Edge" src="https://github.com/user-attachments/assets/f6a8ffb1-edc5-4506-883e-c83caa3229ed" style="width: 35%;"/>

<img width="1080" height="1800" alt="Screenshot_20260606_085538_Edge" src="https://github.com/user-attachments/assets/5a16bc6c-78c0-4816-a948-164c50077aac" style="width: 35%;"/>

## Getting Started

No installation or build step is required. Open `HarkenJot.html` in any modern browser:

```bash
# Option 1: Open directly
open HarkenJot.html

# Option 2: Serve locally (recommended for full CORS support)
python3 -m http.server 8000
# Then visit http://localhost:8000/HarkenJot.html
```

### Requirements

- A modern web browser (Chrome 90+, Edge 90+, Firefox 88+, Safari 14+)
- Microphone access for voice note recording
- Internet connection for CDN-loaded libraries and speech recognition (Whisper fallback works offline after initial model download)

## How It Works

HarkenJot has three main views:

| Tab | Purpose |
|-----|---------|
| **Reader** | Load articles, X.com posts/Articles or GitHub READMEs (via URL), PDFs, or paste text. Read along or use text-to-speech. Take voice or text notes anchored to your reading position. |
| **Media** | Play YouTube videos, podcasts (via a Spotify or Apple Podcasts episode link, RSS or an audio URL, including Substack podcast feeds), X.com/Twitter videos, or local audio files (e.g. Gemini Notebook podcast exports). Take voice or text notes anchored to the playback timestamp. |
| **Library** | Browse all saved sources and notes. Search, filter by read status, pick sources to copy with their notes, and sync. |

The **gear** in the header opens **Settings**: library backup and restore, and GitHub sync.

## Tech Stack

- **React 18 + ReactDOM 18** — UI components and rendering (loaded via CDN)
- **Babel Standalone** — In-browser JSX transpilation
- **PDF.js** — PDF rendering and text extraction
- **Transformers.js** — Local Whisper AI speech recognition
- **Web Speech API** — Primary browser-native speech recognition
- **speechSynthesis** — Browser-native text-to-speech for the reader
- **Web Audio API** — Audio processing for Whisper
- **IndexedDB** — Client-side data persistence (localStorage fallback)

All dependencies are loaded from CDN at runtime. There are no build tools, bundlers, or package managers involved.

## Deployment

Upload `HarkenJot.html` to any static file host:

- **GitHub Pages** — Serve the repo root from the default branch (the `.nojekyll` file disables Jekyll processing)
- **Netlify / Vercel** — Drop the file into a project
- **S3 + CloudFront** — Upload to a bucket with static hosting enabled
- **Any web server** — Copy the file to your server's document root

Copy `apple-touch-icon.png` alongside it to get the home-screen icon on iOS. It's
optional — without it the app works identically and iOS falls back to a
screenshot thumbnail — and the browser-tab icon is embedded in the HTML either
way.

HTTPS is recommended for full browser API support (microphone access, Media Session API).

### Adding to your home screen

- **iOS (Safari)** — Share → Add to Home Screen
- **Android (Chrome/Edge)** — ⋮ → Add to Home screen

The app opens in a normal browser tab. Launching without browser chrome would
need a web app manifest, which isn't included yet.

## GitHub sync (optional)

Sync keeps the library in a **private** GitHub repository, so every device you use sees the same sources, notes and reading state. The browser's own storage stays the primary copy: the app works offline as before, and changes made offline go up the next time it syncs.

To set it up:

1. **Create a private repository** for the library, for example `harkenjot-library`. Check that it says *Private*: the library holds every note you take.
2. **Create a fine-grained personal access token** (GitHub → Settings → Developer settings). Give it access to that one repository only, with **Contents: Read and write**, and an expiry date.
3. **On the device with your most complete library:**
   1. Open **Settings** (the gear) and enter the repository and the token. A backup downloads first.
   2. Press **Initialise repo from this library**.
   3. Set the mode to **Sync**.
4. **On every other device:** enter the same repository with its own token, then choose **Pull-only** to take the library in without sending anything back. Switch to **Sync** once you're happy.

Once it is on, sync runs:

- when the app opens;
- when the connection comes back;
- a minute after you stop editing;
- when the app goes to the background.

Notes merge note by note, and status, speed and position merge field by field, so edits on two devices never ask which copy to keep. A sync that would delete many sources at once waits for you to confirm or undo. Set the mode back to **Off** at any time: the app carries on from its own copy, and the repository keeps its full history.

The repository's `README.md` explains its layout to agents, and `INDEX.md` lists every source with a link to its folder. An agent can add an article, a YouTube or X video, or a podcast episode as just a title and a link: HarkenJot fetches the text, or finds the video or the episode's audio, the first time you open it, and syncs it to your other devices.

## Data & Privacy

All notes and sources are stored locally in the browser (IndexedDB, falling back to `localStorage`). With GitHub sync off, no library data is sent to any server. With it on, the library is also stored in the private GitHub repository you chose. The access token stays in that browser's local storage, and is never exported, synced or logged. Settings → Back up saves your full library as a JSON file, and Restore from backup reads one back in.

## License

See the repository for license details.
