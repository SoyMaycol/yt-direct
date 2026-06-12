# yt-direct

**Zero-dependency YouTube video downloader** — InnerTube API (same as yt-dlp). No external modules.

```bash
npm install yt-direct
```

```js
const ytdl = require('yt-direct');
// or: import ytdl from 'yt-direct';
```

---

## Features

- **No dependencies** — only Node.js built-ins
- **InnerTube API** — no scraper, no API key
- **Quality selection** — auto, 2160p, 1440p, 1080p, 720p, 480p, 360p, audio
- **Format selection** — mp4, webm, mkv, avi, mov, m4a, aac, flac, ogg, mp3, wav
- **Merge tools** — auto-detects ffmpeg, avconv, mkvmerge, gstreamer
- **Streaming** — pipe directly to any writable stream
- **Custom headers, cookies, timeout, retries**
- **Download result includes statusCode + timing + speed**

---

## Quick Start

```javascript
const video = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  quality: '720p',
  format: 'mp4',
});

console.log('Title:', video.title);
const result = await video.download('./video.mp4');
console.log('Downloaded:', result.size, 'bytes in', result.time, 'ms');
console.log('Status:', result.statusCode, '| Speed:', result.speed, 'MB/s');
```

---

## API Reference

### `ytdl(url, options?)`

Returns a `VideoResult` object.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `quality` | `string` | `'auto'` | `auto`, `best`, `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `audio` |
| `format` | `string` | `null` | Target container (see Format Support) |
| `filter` | `string` | `'audioandvideo'` | `audioandvideo`, `videoonly`, `audioonly` |
| `language` | `string` | `'en'` | ISO code: `en`, `es`, `pt`, `fr`, `de`, `ja`, etc |
| `preferMp4` | `boolean` | `true` | Prefer mp4 over webm at same quality |
| `concurrency` | `number` | `1` | Parallel chunks (1–12). `1` = sequential, starts instantly |
| `timeout` | `number` | `30000` | Per-request timeout in ms (5000–600000) |
| `retries` | `number` | `3` | Retry attempts on failure (0–10) |
| `headers` | `object` | `null` | Extra HTTP headers `{ 'X-Custom': 'value' }` |
| `cookies` | `string\|object` | `null` | Cookie string or `{ name: value }` object |
| `merge` | `object` | `null` | Merge config (see Merging) |
| `onProgress` | `function` | `null` | `(downloaded, total)` called during download |

#### VideoResult

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Video title |
| `url` | `string` | Direct stream URL |
| `format` | `Format` | Selected video format |
| `audio` | `Format?` | Audio format (if separate stream) |
| `type` | `string` | `combined`, `separate`, `video-only`, `audio` |
| `stream()` | `ReadableStream` | Get a readable stream |
| `pipe(w)` | `Writable` | Pipe to a writable stream |
| `download(path?)` | `Promise<DownloadResult>` | Download to file |

#### DownloadResult

```javascript
{
  path: '/tmp/video.mp4',
  size: 26455880,          // bytes
  statusCode: 206,          // HTTP status from CDN
  time: 3120,               // download time in ms
  speed: 8.1,               // MB/s
}
```

---

## Download URL Only (no download)

```javascript
const video = await ytdl('https://www.youtube.com/watch?v=xxx', {
  quality: '1080p',
});

console.log('Video URL:', video.url);
if (video.audio) console.log('Audio URL:', video.audio.url);
```

---

## Streaming

```javascript
const video = await ytdl(url, { quality: '720p' });
video.pipe(fs.createWriteStream('./video.mp4'));
```

---

## Merging Audio + Video

1080p+ requires merging separate streams. yt-direct auto-detects: `ffmpeg`, `avconv`, `mkvmerge`, `gstreamer`.

```javascript
const video = await ytdl(url, {
  quality: '2160p',
  format: 'mp4',
  merge: {
    tool: 'ffmpeg',          // auto-detect from PATH
    path: '/usr/bin/ffmpeg', // or specify custom path
  },
});

const result = await video.merge('./output.mp4');
console.log('Merged in', result.time, 'ms');
```

---

## Audio-Only

```javascript
const audio = await ytdl(url, { quality: 'audio', format: 'm4a' });
await audio.download('./audio.m4a');

// MP3 requires conversion:
const audio = await ytdl(url, { quality: 'audio', format: 'mp3', merge: { tool: 'ffmpeg' } });
await audio.merge('./audio.mp3');
```

---

## Custom Headers, Cookies & Timeout

```javascript
const video = await ytdl(url, {
  quality: '1080p',
  headers: { 'X-Forwarded-For': '1.2.3.4' },
  cookies: { 'CONSENT': 'YES+1' },
  timeout: 60000,
  retries: 5,
});
```

---

## Get Video Info

```javascript
const info = await ytdl.getInfo('https://youtube.com/watch?v=xxx');

console.log(info.title);
console.log(info.formats);   // [{ itag, quality, container, codec, size, type, hasUrl }]
console.log(info.combined);  // audio+video formats
console.log(info.adaptive);  // separate audio/video
console.log(info.clientUsed); // 'ANDROID' or 'ANDROID_VR'
```

---

## Verify URL

```javascript
const ok = await ytdl.verifyURL(url);
console.log(ok); // true if CDN returns 200/206
```

---

## Error Handling

```javascript
const { YouTubeError, FormatError, ValidationError, QualityError, MergeError, NetworkError } = ytdl;

try {
  await ytdl(url, { format: 'mp3' });
} catch (err) {
  if (err instanceof FormatError) {
    console.log('Requires conversion:', err.details);
  }
}
```

---

## Format Support

### Native (direct from YouTube)

| Container | Extension | Video Codecs | Audio |
|-----------|-----------|-------------|-------|
| MP4 | `.mp4` | H.264, AV1 | AAC |
| WebM | `.webm` | VP9, AV1 | Opus |
| M4A | `.m4a` | — | AAC |

### Require Conversion (merge tool needed)

| Container | Extension |
|-----------|-----------|
| MKV | `.mkv` |
| AVI | `.avi` |
| MOV | `.mov` |
| MP3 | `.mp3` |
| AAC | `.aac` |
| FLAC | `.flac` |
| OGG | `.ogg` |
| WAV | `.wav` |

---

## Quality Reference

| Quality | Resolution | Bitrate |
|---------|-----------|---------|
| 4320p | 7680×4320 | 40–80 Mbps |
| 2160p | 3840×2160 | 20–45 Mbps |
| 1440p | 2560×1440 | 10–20 Mbps |
| 1080p | 1920×1080 | 5–12 Mbps |
| 720p | 1280×720 | 2.5–6 Mbps |
| 480p | 854×480 | 1–3 Mbps |
| 360p | 640×360 | 0.5–1.5 Mbps |
| audio | — | 32–256 Kbps |

Fallback: if requested quality is unavailable, next lower tier is tried automatically.

---

## Available Constants

```javascript
console.log('Formats:', ytdl.FORMATS);    // ['mp4','webm','mkv',...]
console.log('Qualities:', ytdl.QUALITIES); // ['4320p','2160p',...,'auto','best','audio']
console.log('Version:', ytdl.version);
```

---

## Requirements

- Node.js 18+
