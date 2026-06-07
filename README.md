# yt-direct

**Zero-dependency YouTube video downloader**
Uses the InnerTube API (same as yt-dlp). No external modules required.

```bash
npm install yt-direct
```

---

## Features

- **No external dependencies** — only uses Node.js built-in modules
- **InnerTube API** — same protocol as yt-dlp, no scraper needed
- **Quality selection** — auto, 2160p, 1440p, 1080p, 720p, 480p, 360p, audio
- **Format selection** — mp4, webm, mkv, avi, mov, m4a, aac, flac, ogg, mp3, wav
- **FFmpeg merge** — combine separate video + audio streams
- **Parallel downloads** — faster large file transfers
- **Stream interface** — pipe directly to writable streams
- **No API key required**

---

## Quick Start

```javascript
const ytdl = require('yt-direct');

(async () => {
  const video = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
    quality: '720p',
    format: 'mp4',
  });

  console.log('Title:', video.title);
  await video.download('./video.mp4');
})();
```

And don't worry, it is compatible with ESM

---

## API Reference

### `ytdl(url, options?)`

Downloads a YouTube video. Returns a `VideoResult` object.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `quality` | `string` | `'auto'` | `'auto'`, `'best'`, `'2160p'`, `'1440p'`, `'1080p'`, `'720p'`, `'480p'`, `'360p'`, `'audio'` |
| `format` | `string` | `null` | Target container (see Format Support) |
| `filter` | `string` | `'audioandvideo'` | `'audioandvideo'`, `'videoonly'`, `'audioonly'` |
| `preferMp4` | `boolean` | `true` | Prefer mp4 over webm at same quality |
| `concurrency` | `number` | `6` | Parallel download streams (1–12) |
| `merge` | `object` | `null` | FFmpeg merge config (see Merging) |
| `onProgress` | `function` | `null` | `(done, total) => {}` |

#### VideoResult

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Video title |
| `url` | `string` | Direct stream URL |
| `format` | `Format` | Selected video format |
| `audio` | `Format?` | Selected audio format (if separate) |
| `type` | `string` | `'combined'`, `'separate'`, `'video-only'`, `'audio'` |
| `stream()` | `ReadableStream` | Get a readable stream |
| `pipe(writable)` | `Writable` | Pipe to a writable stream |
| `download(path?)` | `Promise<string>` | Download to file |
| `merge(output?)` | `Promise<string>` | Download and merge via FFmpeg |

---

## Format Support

### Native (direct from YouTube)

| Container | Extension | Video | Audio | Native Source |
|-----------|-----------|-------|-------|---------------|
| MP4 | `.mp4` | H.264, AV1 | AAC | ✓ |
| WebM | `.webm` | VP9, AV1 | Opus | ✓ |
| M4A | `.m4a` | — | AAC | ✓ |

### Require Conversion (via FFmpeg)

| Container | Extension | Codec |
|-----------|-----------|-------|
| MKV | `.mkv` | Matroska |
| AVI | `.avi` | AVI |
| MOV | `.mov` | QuickTime |
| MP3 | `.mp3` | MPEG Audio |
| AAC | `.aac` | AAC |
| FLAC | `.flac` | FLAC |
| OGG | `.ogg` | Ogg Vorbis |
| WAV | `.wav` | WAV |

When requesting a container that requires conversion, yt-direct throws a `FormatError` with a clear message. Use `merge` to convert:

```javascript
const video = await ytdl(url, {
  quality: '1080p',
  format: 'mkv',
  merge: { tool: 'ffmpeg' },   // auto-detect ffmpeg
});

await video.merge('./output.mkv');
```

---

## Quality Reference

| Quality | Resolution | Typical Bitrate (Video) |
|---------|-----------|----------------------|
| 4320p | 7680×4320 | 40–80 Mbps |
| 2160p | 3840×2160 | 20–45 Mbps |
| 1440p | 2560×1440 | 10–20 Mbps |
| 1080p | 1920×1080 | 5–12 Mbps |
| 720p | 1280×720 | 2.5–6 Mbps |
| 480p | 854×480 | 1–3 Mbps |
| 360p | 640×360 | 0.5–1.5 Mbps |
| 240p | 426×240 | 0.3–0.8 Mbps |
| 144p | 256×144 | 0.1–0.4 Mbps |
| audio | — | 32–256 Kbps |

Quality fallback: if the requested quality is unavailable, the next lower tier is tried automatically.

---

## Audio-Only

```javascript
const audio = await ytdl(url, { quality: 'audio', format: 'm4a' });
await audio.download('./audio.m4a');
```

For MP3 output:
```javascript
const audio = await ytdl(url, {
  quality: 'audio',
  format: 'mp3',
  merge: { tool: 'ffmpeg' },
});
await audio.merge('./audio.mp3');
```

---

## Merging Audio + Video

For high-quality downloads (1080p+), YouTube provides separate video and audio streams. Use the `merge` option to combine them:

```javascript
const video = await ytdl(url, {
  quality: '2160p',
  format: 'mp4',
  merge: {
    tool: 'ffmpeg',          // or 'avconv'
    path: '/usr/bin/ffmpeg', // optional custom path
    output: './output.mp4',   // optional (auto-generated)
  },
});

await video.merge();
```

If format conversion is needed (e.g., mp4 → mkv), yt-direct prompts you with:

> *Format "mkv" requires a merge/convert tool. Use { merge: { tool: "ffmpeg", output: "file.mkv" } }.*

---

## Get Video Info

```javascript
const info = await ytdl.getInfo('https://youtube.com/watch?v=xxx');

console.log(info.title);
console.log(info.formats);      // all available formats
console.log(info.combined);     // audio+video formats
console.log(info.adaptive);     // separate audio/video streams
```

---

## Streaming / Piping

```javascript
const fs = require('node:fs');
const video = await ytdl(url, { quality: '720p' });
video.pipe(fs.createWriteStream('./video.mp4'));

// Or use stream()
const stream = video.stream();
stream.pipe(fs.createWriteStream('./video.mp4'));
```

---

## Error Handling

```javascript
const { FormatError, ValidationError, YouTubeError } = ytdl;

try {
  await ytdl(url, { format: 'mp3' });
} catch (err) {
  if (err instanceof FormatError) {
    console.log('Format unavailable:', err.message);
    // err.details contains resolution info
  } else if (err instanceof ValidationError) {
    console.log('Invalid options:', err.message);
  } else {
    console.log('YouTube error:', err.message);
  }
}
```

---

## Available Formats & Qualities

```javascript
console.log('Formats:', ytdl.FORMATS);
console.log('Qualities:', ytdl.QUALITIES);
```

**Formats:** `mp4`, `webm`, `mkv`, `avi`, `mov`, `m4a`, `aac`, `flac`, `ogg`, `mp3`, `wav`

**Qualities:** `4320p`, `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `240p`, `144p`, `auto`, `best`, `audio`

---

## CLI Usage

```bash
node -e "const ytdl=require('yt-direct'); (async()=>{const v=await ytdl('URL'); v.download('./v.mp4');})()"
```

---

## Requirements

- Node.js 18+ (uses native fetch-compatible modules)
