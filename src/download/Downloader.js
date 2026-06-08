const fs = require('node:fs');
const https = require('node:https');
const { URL } = require('node:url');
const { head } = require('../core/Client');
const { NetworkError } = require('../core/Errors');

const CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_CONCURRENCY = 6;

function verify(url) {
  return head(url);
}

function createReadStream(url) {
  return stream(url);
}

async function downloadToFile(url, filePath, options = {}) {
  const concurrency = options.concurrency || MAX_CONCURRENCY;
  const onProgress = options.onProgress || null;

  const size = await getContentLength(url);

  if (!size || size < CHUNK_SIZE) {
    return simpleDownload(url, filePath, onProgress);
  }

  return parallelDownload(url, filePath, size, concurrency, onProgress);
}

function getContentLength(url) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { resolve(0); return; }
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
        'Range': 'bytes=0-0',
      },
    }, (res) => {
      const cr = res.headers['content-range'];
      if (cr) {
        const m = cr.match(/\/(\d+)/);
        if (m) { resolve(parseInt(m[1], 10)); res.resume(); return; }
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
    let u;
    try { u = new URL(url); } catch { return reject(new NetworkError('Invalid URL')); }
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
        out.write(chunk);
      });
      res.on('end', () => { out.end(); });
      out.on('finish', () => resolve(filePath));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(300000, () => { req.destroy(new Error('Download timed out')); });
  });
}

async function parallelDownload(url, filePath, totalSize, concurrency, onProgress) {
  const count = Math.min(Math.min(concurrency, MAX_CONCURRENCY), Math.ceil(totalSize / (1024 * 1024)));
  const actualCount = Math.max(1, count);
  const chunkSize = Math.ceil(totalSize / actualCount);
  const ranges = Array.from({ length: actualCount }, (_, i) => ({
    start: i * chunkSize,
    end: i === actualCount - 1 ? totalSize - 1 : (i + 1) * chunkSize - 1,
  }));

  try {
    const buffers = await Promise.all(
      ranges.map((r) => downloadChunk(url, r.start, r.end))
    );
    if (onProgress) onProgress(totalSize, totalSize);
    const full = Buffer.concat(buffers);
    fs.writeFileSync(filePath, full);
    return filePath;
  } catch (err) {
    throw new NetworkError('Parallel download failed: ' + err.message);
  }
}

function downloadChunk(url, start, end, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    let u;
    try { u = new URL(url); } catch { return reject(new Error('Invalid URL')); }
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
        return resolve(downloadChunk(res.headers.location, start, end, redirects + 1));
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        return reject(new Error(`Chunk HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error('Chunk timed out')); });
  });
}

module.exports = {
  verify,
  createReadStream,
  downloadToFile,
  getContentLength,
};
