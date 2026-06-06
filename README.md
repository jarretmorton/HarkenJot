# HarkenJot

**Take Notes While You Listen**

HarkenJot is a self-contained note-taking web application for capturing notes while consuming audio, video, and text content. It supports voice recording with dual speech recognition (Web Speech API + Whisper AI), and works entirely in the browser with no backend or installation required.

## Features

- **Voice Notes** — Record voice notes with automatic speech-to-text via Web Speech API (primary) or Whisper AI (offline fallback)
- **Multiple Content Types** — Load articles, PDFs, YouTube videos, podcasts, and X.com/Twitter videos in a single interface
- **Text-to-Speech Reader** — Have articles and PDFs read aloud with sentence highlighting, speed control, and auto-scroll
- **Timestamped Notes** — Notes are linked to playback position (media) or sentence position (text), so you can jump back to context
- **Library Management** — Browse, search, export, and import your notes and sources
- **Car Mode** — Simplified, large-button interface for hands-free use while driving
- **Fully Offline-Capable** — All data stored locally in the browser (IndexedDB, with a localStorage fallback); no account or server needed
- **Single-File Deployment** — The entire application is one HTML file

<img width="1080" height="1800" alt="Screenshot_20260606_084227_Edge" src="https://github.com/user-attachments/assets/743b5bf1-d40b-4ddd-9b59-e691501dfe1f" />

<img width="1079" height="1799" alt="Screenshot_20260606_084243_Edge" src="https://github.com/user-attachments/assets/cd1512bb-76ca-4e36-8a6a-397a3b26bdf3" />

<img width="1080" height="1800" alt="Screenshot_20260606_084259_Edge" src="https://github.com/user-attachments/assets/f6a8ffb1-edc5-4506-883e-c83caa3229ed" />

<img width="1080" height="1800" alt="Screenshot_20260606_084322_Edge" src="https://github.com/user-attachments/assets/051e10a5-2bc9-466b-b8b2-c55ce6cb21bf" />


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
| **Reader** | Load articles (via URL), PDFs, or paste text. Read along or use text-to-speech. Take voice or text notes anchored to your reading position. |
| **Media** | Play YouTube videos, podcasts (via RSS/audio URL), or X.com/Twitter videos. Take voice or text notes anchored to the playback timestamp. |
| **Library** | Browse all saved sources and notes. Search, edit, export to JSON, or copy notes to clipboard. |

## Tech Stack

- **React 18** — UI components (loaded via CDN)
- **Babel Standalone** — In-browser JSX transpilation
- **PDF.js** — PDF rendering and text extraction
- **Transformers.js** — Local Whisper AI speech recognition
- **Web Speech API** — Primary browser-native speech recognition
- **Web Audio API** — Audio processing for Whisper
- **IndexedDB** — Client-side data persistence (localStorage fallback)

All dependencies are loaded from CDN at runtime. There are no build tools, bundlers, or package managers involved.

## Deployment

Upload `HarkenJot.html` to any static file host:

- **GitHub Pages** — Push to a `gh-pages` branch
- **Netlify / Vercel** — Drop the file into a project
- **S3 + CloudFront** — Upload to a bucket with static hosting enabled
- **Any web server** — Copy the file to your server's document root

HTTPS is recommended for full browser API support (microphone access, Media Session API).

## Data & Privacy

All notes and sources are stored locally in the browser (IndexedDB, falling back to `localStorage`). No data is sent to any server. You can export your full library as a JSON file for backup or transfer between browsers.

## License

See the repository for license details.
