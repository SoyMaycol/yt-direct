const fs = require('node:fs');
const https = require('node:https');
const { URL } = require('node:url');
const { head, stream, videoHeaders } = require('../core/Client');
const { NetworkError } = require('../core/Errors');

const MAX_CHUNKS = 4;
const CHUNK_SIZE = 50 * 1024 * 1024;

function verify(url) {
  return head(url);
}

function createReadStream(url) {
  return stream(url);
}

async function downloadToFile(url, filePath, options = {}) {
  const onProgress = options.onProgress || null;
  const timeout = options.timeout || 300000;
  const concurrency = options.concurrency || 1;
  const extra = buildExtraHeaders(options);

  if (concurrency > 1) {
    const cl = await contentLength(url, extra, timeout);
    const total = typeof cl === 'object' ? cl.size : cl;
    if (!total) throw new NetworkError('Could not determine file size');
    if (total < 50 * 1024 * 1024) {
      return sequentialDownload(url, filePath, total, onProgress, timeout, extra);
    }
    return parallelDownload(url, filePath, total, onProgress, timeout, extra);
  }

  return sequentialDownload(url, filePath, 0, onProgress, timeout, extra);
}

function buildExtraHeaders(options) {
  const h = {};
  if (options.headers) Object.assign(h, options.headers);
  if (options.cookies) {
    if (typeof options.cookies === 'string') h['Cookie'] = options.cookies;
    else h['Cookie'] = Object.entries(options.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  return Object.keys(h).length ? h : null;
}

function contentLength(url, extra, timeout) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { resolve(0); return; }
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { ...videoHeaders(), ...extra, 'Range': 'bytes=0-0' },
    }, (res) => {
      const cr = res.headers['content-range'];
      if (cr) {
        const m = cr.match(/\/(\d+)/);
        if (m) { resolve({ size: parseInt(m[1], 10), code: res.statusCode }); res.resume(); return; }
      }
      resolve({ size: parseInt(res.headers['content-length'] || '0', 10), code: res.statusCode });
      res.resume();
    });
    req.on('error', () => resolve({ size: 0, code: 0 }));
    req.setTimeout(timeout || 10000, () => { req.destroy(); resolve({ size: 0, code: 0 }); });
  });
}

function sequentialDownload(url, filePath, total, onProgress, timeout, extra, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new NetworkError('Too many redirects'));
    let u;
    try { u = new URL(url); } catch { return reject(new NetworkError('Invalid URL')); }
    const t0 = Date.now();
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { ...videoHeaders(), ...extra },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        res.resume();
        return resolve(sequentialDownload(res.headers.location, filePath, onProgress, timeout, extra, redirects + 1));
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        return reject(new NetworkError(`HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const out = fs.createWriteStream(filePath, { highWaterMark: 1024 * 1024 });

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress) onProgress(downloaded, total);
        out.write(chunk);
      });
      res.on('end', () => out.end());
      out.on('finish', () => resolve({ path: filePath, size: total, time: Date.now() - t0, code: res.statusCode }));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(new NetworkError('Timed out')); });
  });
}

async function parallelDownload(url, filePath, total, onProgress, timeout, extra) {
  const count = Math.min(MAX_CHUNKS, Math.max(2, Math.ceil(total / CHUNK_SIZE)));
  const size = Math.ceil(total / count);
  const ranges = Array.from({ length: count }, (_, i) => ({
    start: i * size,
    end: i === count - 1 ? total - 1 : (i + 1) * size - 1,
  }));

  const t0 = Date.now();
  const buffers = await Promise.all(ranges.map((r) => chunkFetch(url, r.start, r.end, 0, timeout, extra)));

  if (onProgress) onProgress(total, total);
  fs.writeFileSync(filePath, Buffer.concat(buffers));
  return { path: filePath, size: total, time: Date.now() - t0, code: 206 };
}

function chunkFetch(url, start, end, redirects = 0, timeout, extra) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    let u;
    try { u = new URL(url); } catch { return reject(new Error('Invalid URL')); }
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { ...videoHeaders(), ...extra, 'Range': `bytes=${start}-${end}` },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        res.resume();
        return resolve(chunkFetch(res.headers.location, start, end, redirects + 1, timeout, extra));
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        return reject(new Error(`Chunk HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(new Error('Chunk timed out')); });
  });
}

module.exports = {
  verify,
  createReadStream,
  downloadToFile,
  contentLength,
};
