const fs = require('node:fs');
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

function simpleDownload(url, filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
      },
    }, (res) => {
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

function downloadChunk(url, start, end, index, total) {
  return new Promise((resolve, reject) => {
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
