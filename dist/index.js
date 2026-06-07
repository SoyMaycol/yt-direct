/*! yt-direct v1.0.0 */
// index.js
// core/InnerTube.js
// core/Client.js
const https = require('node:https');
const zlib = require('node:zlib');
const { URL } = require('node:url');

const UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';
const API_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const HOST = 'www.youtube.com';
const PATH = '/youtubei/v1/player';
const TIMEOUT = 20000;

function buildOptions(videoId) {
  return JSON.stringify({
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 30,
        osName: 'Android',
        osVersion: '11',
        userAgent: UA,
        hl: 'en',
        gl: 'US',
      },
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  });
}

function request(payload) {
  return new Promise((resolve, reject) => {
    const body = typeof payload === 'string' ? payload : buildOptions(payload);
    const opts = {
      hostname: HOST,
      path: `${PATH}?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        'Content-Length': Buffer.byteLength(body),
        'Accept-Encoding': 'gzip',
        'Origin': `https://${HOST}`,
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        if (res.headers['content-encoding'] === 'gzip') {
          try { buf = zlib.gunzipSync(buf); } catch {}
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`YouTube API returned HTTP ${res.statusCode}`));
        }
        resolve(JSON.parse(buf.toString('utf8')));
      });
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT, () => { req.destroy(new Error('YouTube API request timed out')); });
    req.write(body);
    req.end();
  });
}

function head(url) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { resolve(false); return; }
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
        'Range': 'bytes=0-0',
      },
    }, (res) => {
      resolve(res.statusCode === 206 || res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(8000, () => { req.destroy(); resolve(false); });
  });
}

function stream(url) {
  const u = new URL(url);
  return https.get({
    hostname: u.hostname,
    path: u.pathname + u.search,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.youtube.com/',
    },
  });
}

module.exports = { request, head, stream, buildOptions, UA, API_KEY, HOST, PATH };

// core/Errors.js
class YouTubeError extends Error {
  constructor(message, code = 'YOUTUBE_ERROR', details = null) {
    super(message);
    this.name = 'YouTubeError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class FormatError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'FORMAT_ERROR', details);
    this.name = 'FormatError';
  }
}

class QualityError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'QUALITY_ERROR', details);
    this.name = 'QualityError';
  }
}

class MergeError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'MERGE_ERROR', details);
    this.name = 'MergeError';
  }
}

class NetworkError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

class ValidationError extends YouTubeError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

module.exports = {
  YouTubeError,
  FormatError,
  QualityError,
  MergeError,
  NetworkError,
  ValidationError,
};

const { request } = require('./Client');
const { YouTubeError } = require('./Errors');

const CLIENT_PROFILES = [
  {
    name: 'ANDROID',
    version: '20.10.38',
    sdk: 30,
    os: 'Android',
    osVer: '11',
    ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
  },
  {
    name: 'ANDROID_VR',
    version: '1.71.26',
    sdk: 32,
    os: 'Android',
    osVer: '12L',
    ua: 'com.google.android.apps.youtube.vr.oculus/1.71.26 (Linux; U; Android 12L) gzip',
  },
];

function buildContext(client) {
  return {
    client: {
      clientName: client.name,
      clientVersion: client.version,
      androidSdkVersion: client.sdk,
      osName: client.os,
      osVersion: client.osVer,
      userAgent: client.ua,
      hl: 'en',
      gl: 'US',
      timeZone: 'UTC',
      utcOffsetMinutes: 0,
    },
  };
}

function playerPayload(videoId, client) {
  return JSON.stringify({
    context: buildContext(client),
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  });
}

function parseStreamingData(raw) {
  if (!raw || raw.error) {
    const msg = raw?.error?.message || 'Unknown API error';
    throw new YouTubeError(msg, 'API_ERROR', raw?.error);
  }
  const sd = raw.streamingData;
  if (!sd) {
    throw new YouTubeError('No streaming data in response', 'NO_STREAMING_DATA');
  }
  return sd;
}

function extractFormats(streamingData) {
  return {
    combined: (streamingData.formats || []).filter((f) => f.url),
    adaptive: (streamingData.adaptiveFormats || []).filter((f) => f.url),
  };
}

async function fetch(videoId) {
  let lastError = null;

  for (const client of CLIENT_PROFILES) {
    try {
      const payload = playerPayload(videoId, client);
      const raw = await request(payload);
      const sd = parseStreamingData(raw);
      const { combined, adaptive } = extractFormats(sd);

      if (combined.length > 0 || adaptive.length > 0) {
        return {
          raw,
          videoDetails: raw.videoDetails || {},
          streamingData: sd,
          combined,
          adaptive,
          clientUsed: client.name,
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new YouTubeError('All InnerTube clients failed', 'ALL_CLIENTS_FAILED');
}

module.exports = { fetch, CLIENT_PROFILES };

// formats/Selector.js
// formats/Format.js
// formats/Registry.js
const { FormatError } = require('../core/Errors');

const ITAG_REGISTRY = {
  '18':  { quality: '360p',  container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '22':  { quality: '720p',  container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '37':  { quality: '1080p', container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '38':  { quality: '4K',    container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '59':  { quality: '480p',  container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '78':  { quality: '480p',  container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '133': { quality: '240p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '134': { quality: '360p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '135': { quality: '480p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '136': { quality: '720p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '137': { quality: '1080p', container: 'mp4',  type: 'video',    codec: 'H.264' },
  '138': { quality: '2160p', container: 'mp4',  type: 'video',    codec: 'H.264' },
  '139': { quality: '48kbps',container: 'mp4',  type: 'audio',    codec: 'AAC' },
  '140': { quality: '128kbps',container: 'mp4', type: 'audio',    codec: 'AAC' },
  '141': { quality: '256kbps',container: 'mp4', type: 'audio',    codec: 'AAC' },
  '160': { quality: '144p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '242': { quality: '240p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '243': { quality: '360p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '244': { quality: '480p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '247': { quality: '720p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '248': { quality: '1080p', container: 'webm', type: 'video',    codec: 'VP9' },
  '249': { quality: '50kbps',container: 'webm', type: 'audio',    codec: 'Opus' },
  '250': { quality: '70kbps',container: 'webm', type: 'audio',    codec: 'Opus' },
  '251': { quality: '160kbps',container: 'webm',type: 'audio',    codec: 'Opus' },
  '271': { quality: '1440p', container: 'webm', type: 'video',    codec: 'VP9' },
  '272': { quality: '2160p', container: 'webm', type: 'video',    codec: 'VP9' },
  '278': { quality: '144p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '298': { quality: '720p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '299': { quality: '1080p', container: 'mp4',  type: 'video',    codec: 'H.264' },
  '302': { quality: '720p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '303': { quality: '1080p', container: 'webm', type: 'video',    codec: 'VP9' },
  '308': { quality: '1440p', container: 'webm', type: 'video',    codec: 'VP9' },
  '313': { quality: '2160p', container: 'webm', type: 'video',    codec: 'VP9' },
  '315': { quality: '2160p', container: 'webm', type: 'video',    codec: 'VP9' },
  '394': { quality: '144p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '395': { quality: '240p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '396': { quality: '360p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '397': { quality: '480p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '398': { quality: '720p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '399': { quality: '1080p', container: 'mp4',  type: 'video',    codec: 'AV1' },
  '400': { quality: '1440p', container: 'mp4',  type: 'video',    codec: 'AV1' },
  '401': { quality: '2160p', container: 'mp4',  type: 'video',    codec: 'AV1' },
  '402': { quality: '4320p', container: 'mp4',  type: 'video',    codec: 'AV1' },
  '571': { quality: '48kbps',container: 'mp4',  type: 'audio',    codec: 'AAC' },
  '597': { quality: '48kbps',container: 'mp4',  type: 'audio',    codec: 'AAC' },
  '598': { quality: '144p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '599': { quality: '32kbps',container: 'mp4',  type: 'audio',    codec: 'AAC' },
  '600': { quality: '32kbps',container: 'webm', type: 'audio',    codec: 'Opus' },
};

const CONTAINER_MAP = {
  mp4:  { mime: 'video/mp4',  extension: '.mp4',  default: true },
  webm: { mime: 'video/webm', extension: '.webm', default: false },
  mkv:  { mime: 'video/x-matroska', extension: '.mkv', default: false, requiresMerge: true },
  avi:  { mime: 'video/x-msvideo',  extension: '.avi', default: false, requiresMerge: true },
  mov:  { mime: 'video/quicktime',  extension: '.mov', default: false, requiresMerge: true },
  m4a:  { mime: 'audio/mp4',       extension: '.m4a', default: false },
  aac:  { mime: 'audio/aac',       extension: '.aac', default: false, requiresMerge: true },
  flac: { mime: 'audio/flac',      extension: '.flac', default: false, requiresMerge: true },
  ogg:  { mime: 'audio/ogg',       extension: '.ogg',  default: false, requiresMerge: true },
  mp3:  { mime: 'audio/mpeg',      extension: '.mp3',  default: false, requiresMerge: true },
  wav:  { mime: 'audio/wav',       extension: '.wav',  default: false, requiresMerge: true },
};

const QUALITY_TIERS = ['4320p', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];

function getItagMeta(itag) {
  return ITAG_REGISTRY[String(itag)] || null;
}

function resolveContainer(name) {
  const key = String(name).toLowerCase().replace(/^\./, '');
  return CONTAINER_MAP[key] || null;
}

function requiresConversion(format, targetContainer) {
  const container = resolveContainer(targetContainer);
  if (!container) return false;
  if (container.requiresMerge) return true;
  const fmtContainer = resolveContainer(format.container || 'mp4');
  if (!fmtContainer) return true;
  return fmtContainer.extension !== container.extension;
}

function qualityIndex(label) {
  const idx = QUALITY_TIERS.indexOf(label);
  if (idx !== -1) return idx;
  if (/^\d+p$/.test(label)) return QUALITY_TIERS.indexOf(label) !== -1 ? QUALITY_TIERS.indexOf(label) : -1;
  return -1;
}

function isQualitySupported(label) {
  return QUALITY_TIERS.includes(label) || ['audio', 'best', 'auto'].includes(label);
}

function isContainerSupported(name) {
  return !!resolveContainer(name);
}

module.exports = {
  ITAG_REGISTRY,
  CONTAINER_MAP,
  QUALITY_TIERS,
  getItagMeta,
  resolveContainer,
  requiresConversion,
  qualityIndex,
  isQualitySupported,
  isContainerSupported,
};

const { getItagMeta, resolveContainer } = require('./Registry');

class Format {
  #raw;
  #meta;

  constructor(rawFormat) {
    this.#raw = rawFormat;
    this.#meta = getItagMeta(rawFormat.itag) || {};

    this.itag = rawFormat.itag;
    this.url = rawFormat.url || null;
    this.mimeType = rawFormat.mimeType || '';
    this.contentLength = rawFormat.contentLength ? Number(rawFormat.contentLength) : 0;
    this.bitrate = rawFormat.bitrate || 0;
    this.width = rawFormat.width || 0;
    this.height = rawFormat.height || 0;
    this.fps = rawFormat.fps || 0;
    this.qualityLabel = rawFormat.qualityLabel || this.#meta.quality || null;
    this.container = rawFormat.container || this.#meta.container || 'mp4';
    this.codec = rawFormat.codecs || this.#meta.codec || 'unknown';
    this.isAudio = this.mimeType.includes('audio');
    this.isVideo = this.mimeType.includes('video');
    this.isCombined = this.#meta.type === 'combined' || (this.isVideo && this.mimeType.includes('mp4a'));
    this.source = rawFormat._source || 'adaptive';
  }

  get hasUrl() {
    return !!this.url;
  }

  get sizeMB() {
    return this.contentLength > 0 ? (this.contentLength / 1024 / 1024).toFixed(1) : '?';
  }

  get qualityRank() {
    if (this.isAudio) return this.bitrate;
    return (this.height || 0) * (this.width || 0);
  }

  toJSON() {
    return {
      itag: this.itag,
      quality: this.qualityLabel,
      container: this.container,
      codec: this.codec,
      size: this.sizeMB,
      width: this.width,
      height: this.height,
      fps: this.fps,
      bitrate: this.bitrate,
      type: this.isCombined ? 'combined' : this.isAudio ? 'audio' : 'video',
      hasUrl: this.hasUrl,
    };
  }

  inspect() {
    return `Format(${this.itag} | ${this.qualityLabel} | ${this.container} | ${this.codec})`;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.inspect();
  }
}

module.exports = { Format };

// formats/Qualities.js
const { QualityError } = require('../core/Errors');

const QUALITY_MAP = {
  '4320p': 4320,
  '2160p': 2160,
  '1440p': 1440,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
  '240p': 240,
  '144p': 144,
};

const QUALITY_TIERS = Object.keys(QUALITY_MAP);

function toHeight(label) {
  if (!label) return 0;
  const cleaned = String(label).toLowerCase().replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

function matchQualityRank(format, targetHeight, tolerance = 72) {
  if (!targetHeight) return true;
  const h = format.height || toHeight(format.qualityLabel);
  if (!h) return false;
  return Math.abs(h - targetHeight) <= tolerance;
}

function getFallbackChain(requested) {
  const t = String(requested || '').toLowerCase();
  if (t === 'auto' || t === 'best') return [...QUALITY_TIERS];
  if (t === 'audio') return ['audio'];
  const idx = QUALITY_TIERS.indexOf(t);
  if (idx !== -1) return QUALITY_TIERS.slice(idx);
  return [...QUALITY_TIERS];
}

function validateQuality(requested) {
  if (!requested) return 'auto';
  const t = String(requested).toLowerCase();
  if (t === 'auto' || t === 'best' || t === 'audio') return t;
  if (QUALITY_TIERS.includes(t)) return t;
  throw new QualityError(
    `Unsupported quality "${requested}". Available: ${QUALITY_TIERS.join(', ')}, auto, best, audio`,
    { requested, supported: [...QUALITY_TIERS, 'auto', 'best', 'audio'] }
  );
}

module.exports = {
  QUALITY_MAP,
  QUALITY_TIERS,
  toHeight,
  matchQualityRank,
  getFallbackChain,
  validateQuality,
};

// formats/mime.js
const { resolveContainer, requiresConversion } = require('./Registry');

function mimeTypeToContainer(mimeType) {
  if (!mimeType) return 'mp4';
  const parts = mimeType.split('/');
  if (parts.length < 2) return 'mp4';
  const sub = parts[1].split(';')[0].trim().toLowerCase();
  const map = {
    mp4: 'mp4',
    webm: 'webm',
    'x-matroska': 'mkv',
    'x-msvideo': 'avi',
    quicktime: 'mov',
    aac: 'aac',
    mpeg: 'mp3',
    wav: 'wav',
    ogg: 'ogg',
    flac: 'flac',
    '3gpp': '3gp',
  };
  return map[sub] || sub;
}

function checkContainer(format, targetContainer) {
  const current = format.container || mimeTypeToContainer(format.mimeType);
  if (!targetContainer) return { compatible: true, current, needsConversion: false };
  const tc = resolveContainer(targetContainer);
  if (!tc) return { compatible: false, current, target: targetContainer, needsConversion: false };
  if (current === targetContainer) return { compatible: true, current, target: targetContainer, needsConversion: false };
  return {
    compatible: false,
    current,
    target: targetContainer,
    needsConversion: true,
    requiresTool: requiresConversion(format, targetContainer),
  };
}

module.exports = { mimeTypeToContainer, checkContainer };

const { Format } = require('./Format');
const { getFallbackChain, matchQualityRank, toHeight, validateQuality } = require('./Qualities');
const { checkContainer, mimeTypeToContainer } = require('./mime');
const { requiresConversion } = require('./Registry');
const { FormatError, QualityError } = require('../core/Errors');

class FormatSelector {
  #combined;
  #adaptive;
  #all;

  constructor(streamingData) {
    this.#combined = (streamingData.formats || []).map((f) => new Format({ ...f, _source: 'combined' }));
    this.#adaptive = (streamingData.adaptiveFormats || []).map((f) => new Format({ ...f, _source: 'adaptive' }));
    this.#all = [...this.#combined, ...this.#adaptive];
  }

  get formats() {
    return [...this.#all];
  }

  get combined() {
    return [...this.#combined];
  }

  get adaptive() {
    return [...this.#adaptive];
  }

  list(options = {}) {
    let list = [...this.#all];

    if (options.type === 'video') list = list.filter((f) => f.isVideo);
    else if (options.type === 'audio') list = list.filter((f) => f.isAudio);
    else if (options.type === 'combined') list = list.filter((f) => f.isCombined);

    if (options.minHeight) list = list.filter((f) => f.height >= options.minHeight);
    if (options.minBitrate) list = list.filter((f) => f.bitrate >= options.minBitrate);
    if (options.container) list = list.filter((f) => f.container === options.container);
    if (options.codec) list = list.filter((f) => f.codec.toLowerCase().includes(options.codec.toLowerCase()));

    return list.map((f) => f.toJSON());
  }

  select(options = {}) {
    const quality = validateQuality(options.quality || 'auto');
    const container = options.format || options.container || null;

    if (quality === 'audio') {
      return this.#selectAudio(options);
    }

    const chain = getFallbackChain(quality);

    for (const q of chain) {
      const targetH = toHeight(q);
      const result = this.#tryQuality(targetH, container, options);
      if (result) return result;
    }

    return this.#lastResort(container, options);
  }

  #tryQuality(targetH, container, options) {
    const preferMp4 = options.preferMp4 !== false;

    let candidates = this.#combined
      .filter((f) => f.hasUrl && matchQualityRank(f, targetH))
      .sort(this.#sortFn(preferMp4));

    if (candidates.length) {
      const picked = candidates[0];
      const cc = container ? checkContainer(picked, container) : null;

      if (container && cc && cc.needsConversion && !options.merge) {
        throw new FormatError(
          `Format "${container}" requires a merge/convert tool for itag ${picked.itag} (${picked.qualityLabel}, ${picked.container}). ` +
          `Available source: ${picked.container}. Use { merge: { tool: 'ffmpeg', output: 'file.${container}' } } to convert.`,
          {
            itag: picked.itag,
            sourceContainer: picked.container,
            targetContainer: container,
            requiresConversion: true,
            suggestedTool: 'ffmpeg',
          }
        );
      }

      return { format: picked, type: 'combined' };
    }

    const videos = this.#adaptive
      .filter((f) => f.isVideo && f.hasUrl && matchQualityRank(f, targetH))
      .sort(this.#sortFn(preferMp4));

    if (videos.length) {
      const video = videos[0];
      const audios = this.#adaptive
        .filter((f) => f.isAudio && f.hasUrl)
        .sort((a, b) => b.bitrate - a.bitrate);

      const cc = container ? checkContainer(video, container) : null;

      if (container && cc && cc.needsConversion && !options.merge) {
        throw new FormatError(
          `Format "${container}" requires a merge/convert tool. ` +
          `Source: ${video.container}. Use { merge: { tool: 'ffmpeg', output: 'file.${container}' } }.`,
          {
            itag: video.itag,
            sourceContainer: video.container,
            targetContainer: container,
            requiresConversion: true,
            suggestedTool: 'ffmpeg',
          }
        );
      }

      const result = { format: video, type: 'video-only' };

      if (audios.length) {
        result.audio = audios[0];
        result.type = 'separate';
      }

      return result;
    }

    return null;
  }

  #selectAudio(options) {
    const container = options.format || options.container || null;
    const audios = this.#all
      .filter((f) => f.isAudio && f.hasUrl)
      .sort((a, b) => b.bitrate - a.bitrate);

    if (!audios.length) throw new FormatError('No audio formats available');

    if (container) {
      const match = audios.find((f) => f.container === container);
      if (match) return { format: match, type: 'audio', audio: null };

      const best = audios[0];
      throw new FormatError(
        `No audio format in "${container}" available. Best available: ${best.container} (${best.qualityLabel}). ` +
        `Use { merge: { tool: 'ffmpeg', output: 'file.${container}' } } to convert.`,
        {
          sourceContainer: best.container,
          targetContainer: container,
          requiresConversion: true,
          suggestedTool: 'ffmpeg',
        }
      );
    }

    return { format: audios[0], type: 'audio', audio: null };
  }

  #lastResort(container, options) {
    if (this.#combined.length) {
      return { format: this.#combined[0], type: 'combined' };
    }
    const video = this.#adaptive.find((f) => f.isVideo && f.hasUrl);
    if (video) {
      const audio = this.#adaptive.find((f) => f.isAudio && f.hasUrl);
      return { format: video, type: audio ? 'separate' : 'video-only', audio };
    }
    throw new FormatError('No compatible formats found for this video');
  }

  #sortFn(preferMp4) {
    return (a, b) => {
      if (preferMp4) {
        const aMp4 = a.container === 'mp4' ? 1 : 0;
        const bMp4 = b.container === 'mp4' ? 1 : 0;
        if (aMp4 !== bMp4) return bMp4 - aMp4;
      }
      return b.qualityRank - a.qualityRank;
    };
  }
}

module.exports = { FormatSelector };

// utils/validators.js
const { ValidationError } = require('../core/Errors');

const VALID_QUALITIES = ['4320p', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p', 'auto', 'best', 'audio'];
const VALID_CONTAINERS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4a', 'aac', 'flac', 'ogg', 'mp3', 'wav'];

function validateOptions(options = {}) {
  const errors = [];

  if (options.quality && !VALID_QUALITIES.includes(String(options.quality).toLowerCase())) {
    errors.push(`Invalid quality "${options.quality}". Valid: ${VALID_QUALITIES.join(', ')}`);
  }

  if (options.format && !VALID_CONTAINERS.includes(String(options.format).toLowerCase())) {
    errors.push(`Invalid format "${options.format}". Valid: ${VALID_CONTAINERS.join(', ')}`);
  }

  if (options.filter && !['audioandvideo', 'videoonly', 'audioonly'].includes(options.filter)) {
    errors.push('filter must be "audioandvideo", "videoonly", or "audioonly"');
  }

  if (options.merge) {
    if (typeof options.merge !== 'object' || Array.isArray(options.merge)) {
      errors.push('merge must be an object with optional { tool, path, output }');
    }
  }

  if (errors.length) {
    throw new ValidationError(`Invalid options:\n  - ${errors.join('\n  - ')}`, { errors });
  }

  return {
    quality: String(options.quality || 'auto').toLowerCase(),
    format: options.format ? String(options.format).toLowerCase() : null,
    filter: options.filter || 'audioandvideo',
    preferMp4: options.preferMp4 !== false,
    merge: options.merge || null,
    concurrency: Math.min(Math.max(parseInt(options.concurrency) || 6, 1), 12),
    onProgress: typeof options.onProgress === 'function' ? options.onProgress : null,
  };
}

module.exports = { validateOptions, VALID_QUALITIES, VALID_CONTAINERS };

// utils/url.js
const { URL } = require('node:url');

function extractVideoId(input) {
  if (!input) return null;

  const trimmed = String(input).trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace('www.', '').replace('m.', '');

    if (host === 'youtu.be') {
      return u.pathname.replace(/^\//, '').split(/[?&#]/)[0] || null;
    }

    if (host === 'youtube.com') {
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/live/')) {
        return u.pathname.split('/')[2]?.split(/[?&#]/)[0] || null;
      }
      return u.searchParams.get('v') || null;
    }
  } catch {}

  return null;
}

function isValidVideoId(id) {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

module.exports = { extractVideoId, isValidVideoId };

// download/Merge.js
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { MergeError } = require('../core/Errors');

const TOOLS = {
  ffmpeg: {
    cmd: 'ffmpeg',
    label: 'FFmpeg',
    check: () => {
      return new Promise((resolve) => {
        const proc = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      });
    },
  },
  avconv: {
    cmd: 'avconv',
    label: 'avconv (Libav)',
    check: () => {
      return new Promise((resolve) => {
        const proc = spawn('avconv', ['-version'], { stdio: 'ignore' });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      });
    },
  },
};

async function detectTool(name) {
  if (name) {
    const tool = TOOLS[name.toLowerCase()];
    if (!tool) throw new MergeError(`Unknown merge tool "${name}". Supported: ${Object.keys(TOOLS).join(', ')}`);
    const available = await tool.check();
    if (!available) throw new MergeError(`"${tool.label}" not found in PATH. Install it or provide a custom path.`);
    return tool;
  }

  for (const [key, tool] of Object.entries(TOOLS)) {
    if (await tool.check()) return tool;
  }

  return null;
}

function buildArgs(tool, videoPath, audioPath, outputPath) {
  const cmd = tool.cmd || 'ffmpeg';
  return {
    cmd,
    args: [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      '-y',
      outputPath,
    ],
  };
}

async function merge(videoPath, audioPath, outputPath, options = {}) {
  const toolName = options.tool || null;
  const customPath = options.path || null;

  let tool;
  if (customPath) {
    tool = { cmd: customPath, label: customPath };
  } else {
    tool = await detectTool(toolName);
  }

  if (!tool) {
    throw new MergeError(
      'No merge/conversion tool detected. Install FFmpeg (https://ffmpeg.org) or avconv. ' +
      'Alternatively, use { merge: { path: "/path/to/ffmpeg" } } to specify a custom binary.'
    );
  }

  const { cmd, args } = buildArgs(tool, videoPath, audioPath, outputPath);

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new MergeError(`Merge failed (exit ${code}): ${stderr.slice(-300)}`));
    });
    proc.on('error', (err) => reject(new MergeError(`Failed to start ${cmd}: ${err.message}`)));
  });
}

async function checkAvailable(toolName) {
  const tool = await detectTool(toolName);
  return !!tool;
}

module.exports = {
  merge,
  detectTool,
  checkAvailable,
  TOOLS,
};

// download/Downloader.js
const fs = require('node:fs');
const https = require('node:https');
const { URL } = require('node:url');
const { head, stream } = require('../core/Client');
const { NetworkError } = require('../core/Errors');

const CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_CONCURRENCY = 6;

async function verify(url) {
  return head(url);
}

function createReadStream(url) {
  return stream(url);
}

async function downloadToFile(url, filePath, options = {}) {
  const concurrency = options.concurrency || MAX_CONCURRENCY;
  const onProgress = options.onProgress || null;
  const chunkSize = options.chunkSize || CHUNK_SIZE;

  const size = await getContentLength(url);

  if (!size || size < chunkSize) {
    return simpleDownload(url, filePath, onProgress);
  }

  return parallelDownload(url, filePath, size, concurrency, chunkSize, onProgress);
}

function getContentLength(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
        'Range': 'bytes=0-0',
      },
    }, (res) => {
      const cr = res.headers['content-range'];
      if (cr) {
        const match = cr.match(/\/(\d+)/);
        if (match) resolve(parseInt(match[1], 10));
      }
      resolve(parseInt(res.headers['content-length'] || '0', 10));
      res.resume();
    });
    req.on('error', () => resolve(0));
    req.setTimeout(10000, () => { req.destroy(); resolve(0); });
  });
}

function simpleDownload(url, filePath, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new NetworkError('Too many redirects'));
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
      },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        res.resume();
        return resolve(simpleDownload(res.headers.location, filePath, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) {
        return reject(new NetworkError(`Download failed with HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const out = fs.createWriteStream(filePath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total) onProgress(downloaded, total);
      });

      res.pipe(out);
      out.on('finish', () => resolve(filePath));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(300000, () => { req.destroy(new Error('Download timed out')); });
  });
}

function parallelDownload(url, filePath, totalSize, concurrency, chunkSize, onProgress) {
  const actualConcurrency = Math.min(concurrency, MAX_CONCURRENCY);
  const count = Math.min(actualConcurrency, Math.ceil(totalSize / chunkSize));
  const actualChunkSize = Math.ceil(totalSize / count);

  const ranges = Array.from({ length: count }, (_, i) => ({
    start: i * actualChunkSize,
    end: i === count - 1 ? totalSize - 1 : (i + 1) * actualChunkSize - 1,
  }));

  return new Promise(async (resolve, reject) => {
    try {
      const buffers = await Promise.all(
        ranges.map((r, i) => downloadChunk(url, r.start, r.end, i + 1, count))
      );

      if (onProgress) onProgress(totalSize, totalSize);

      const full = Buffer.concat(buffers);
      fs.writeFileSync(filePath, full);
      resolve(filePath);
    } catch (err) {
      reject(err);
    }
  });
}

function downloadChunk(url, start, end, index, total, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new NetworkError('Too many redirects'));
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
        'Range': `bytes=${start}-${end}`,
      },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        res.resume();
        return resolve(downloadChunk(res.headers.location, start, end, index, total, redirects + 1));
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        return reject(new NetworkError(`Chunk HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error(`Chunk ${index} timed out`)); });
  });
}

module.exports = {
  verify,
  createReadStream,
  downloadToFile,
  getContentLength,
};

// download/Stream.js
const { Transform } = require('node:stream');
const { createReadStream } = require('./Downloader');

class DownloadStream extends Transform {
  #url;
  #bytesRead;
  #startTime;
  #onProgress;

  constructor(url, options = {}) {
    super({ highWaterMark: 1024 * 1024 });
    this.#url = url;
    this.#bytesRead = 0;
    this.#startTime = Date.now();
    this.#onProgress = options.onProgress || null;
  }

  _transform(chunk, encoding, callback) {
    this.#bytesRead += chunk.length;
    if (this.#onProgress) {
      this.#onProgress({
        bytes: this.#bytesRead,
        elapsed: Date.now() - this.#startTime,
      });
    }
    this.push(chunk);
    callback();
  }

  _flush(callback) {
    callback();
  }

  get bytesRead() {
    return this.#bytesRead;
  }

  get elapsed() {
    return Date.now() - this.#startTime;
  }
}

function createStream(url, options = {}) {
  const transform = new DownloadStream(url, options);
  const source = createReadStream(url);

  source.on('error', (err) => transform.destroy(err));
  source.on('response', () => {});
  source.pipe(transform);

  return transform;
}

module.exports = { DownloadStream, createStream };

// utils/constants.js
// ../package.json
{
  "name": "yt-direct",
  "version": "1.0.0",
  "description": "Hello, I present to you a module to download YouTube videos directly",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "node build/build.js",
    "prepublishOnly": "npm run build",
    "test": "node test/basic.js",
    "example": "node examples/basic.js"
  },
  "keywords": [
    "youtube",
    "download",
    "video",
    "yt-dlp",
    "innertube",
    "downloader",
    "ytdl",
    "mp4",
    "stream",
    "no-dependencies"
  ],
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/SoyMaycol/yt-direct.git"
  },
  "bugs": {
    "url": "https://github.com/SoyMaycol/yt-direct/issues"
  },
  "homepage": "https://github.com/SoyMaycol/yt-direct#readme",
  "author": "SoyMaycol"
}

const pkg = require('../../package.json');

module.exports = {
  VERSION: pkg.version,
  NAME: pkg.name,
  HOMEPAGE: pkg.homepage,
  MAX_CONCURRENCY: 6,
  DEFAULT_TIMEOUT: 20000,
  DOWNLOAD_TIMEOUT: 300000,
  CHUNK_SIZE: 10 * 1024 * 1024,
  YOUTUBE_HOST: 'www.youtube.com',
  INNERTUBE_KEY: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
  SUPPORTED_PROTOCOLS: ['http:', 'https:'],
  INTEGRITY_SEED: 'yt-direct-v1',
};

const { fetch } = require('./core/InnerTube');
const { head } = require('./core/Client');
const { YouTubeError, FormatError, ValidationError } = require('./core/Errors');
const { FormatSelector } = require('./formats/Selector');
const { Format } = require('./formats/Format');
const { resolveContainer, requiresConversion, QUALITY_TIERS, CONTAINER_MAP } = require('./formats/Registry');
const { validateOptions } = require('./utils/validators');
const { extractVideoId } = require('./utils/url');
const { merge } = require('./download/Merge');
const { downloadToFile, createReadStream, verify } = require('./download/Downloader');
const { createStream } = require('./download/Stream');
const { VERSION } = require('./utils/constants');

function ytdl(input, options = {}) {
  const videoId = extractVideoId(input);
  if (!videoId) {
    return Promise.reject(new ValidationError(`Invalid YouTube URL or video ID: "${input}"`));
  }

  const normalized = validateOptions(options);

  return (async () => {
    const info = await getInfo(videoId);
    const selector = new FormatSelector(info.streamingData);
    const selected = selector.select(normalized);

    const format = selected.format;
    const audio = selected.audio || null;

    const response = {
      videoId,
      title: info.title || 'video',
      url: format.url,
      format,
      audio,
      type: selected.type,
      stream: () => createStream(format.url),
      pipe: (writable) => createStream(format.url).pipe(writable),
      download: async (filePath) => {
        if (!filePath) {
          const ext = normalized.format || format.container || 'mp4';
          filePath = `${sanitize(info.title || 'video')}.${ext}`;
        }
        return downloadToFile(format.url, filePath, {
          concurrency: normalized.concurrency,
          onProgress: normalized.onProgress,
        });
      },
    };

    if (normalized.merge && audio) {
      response.merge = async (outputPath) => {
        if (!outputPath) {
          const ext = normalized.format || 'mkv';
          outputPath = `${sanitize(info.title || 'video')}.${ext}`;
        }
        const tmpVideo = `/tmp/yt-direct-${format.itag}-video`;
        const tmpAudio = `/tmp/yt-direct-${audio.itag}-audio`;
        try {
          await Promise.all([
            downloadToFile(format.url, tmpVideo),
            downloadToFile(audio.url, tmpAudio),
          ]);
          await merge(tmpVideo, tmpAudio, outputPath, normalized.merge);
          return outputPath;
        } finally {
          try { require('node:fs').unlinkSync(tmpVideo); } catch {}
          try { require('node:fs').unlinkSync(tmpAudio); } catch {}
        }
      };
    }

    return response;
  })();
}

async function getInfo(input) {
  const videoId = extractVideoId(input);
  if (!videoId) throw new ValidationError(`Invalid YouTube URL or video ID: "${input}"`);

  const result = await fetch(videoId);
  const selector = new FormatSelector(result.streamingData);

  return {
    id: videoId,
    title: result.videoDetails.title || 'Unknown',
    author: result.videoDetails.author || result.videoDetails?.channelId || null,
    duration: parseInt(result.videoDetails.lengthSeconds || '0', 10),
    thumbnails: result.videoDetails.thumbnail?.thumbnails || [],
    description: result.videoDetails.shortDescription || '',
    viewCount: parseInt(result.videoDetails.viewCount || '0', 10),
    isLive: result.videoDetails.isLive === true,
    streamingData: result.streamingData,
    formats: selector.list(),
    combined: selector.combined.map((f) => f.toJSON()),
    adaptive: selector.adaptive.map((f) => f.toJSON()),
    clientUsed: result.clientUsed,
  };
}

function sanitize(name) {
  return String(name || 'video').replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim() || 'video';
}

ytdl.getInfo = getInfo;
ytdl.getFormats = (input) => getInfo(input).then((i) => i.formats);
ytdl.verifyURL = verify;
ytdl.createStream = createStream;
ytdl.version = VERSION;

ytdl.FORMATS = Object.keys(CONTAINER_MAP);
ytdl.QUALITIES = [...QUALITY_TIERS, 'auto', 'best', 'audio'];
ytdl.FormatError = FormatError;
ytdl.YouTubeError = YouTubeError;
ytdl.ValidationError = ValidationError;

module.exports = ytdl;
module.exports.default = ytdl;
