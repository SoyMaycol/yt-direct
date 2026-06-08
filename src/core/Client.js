const https = require('node:https');
const zlib = require('node:zlib');
const { URL } = require('node:url');

const UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';
const API_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const HOST = 'www.youtube.com';
const PATH = '/youtubei/v1/player';
const TIMEOUT = 20000;

function request(body) {
  return new Promise((resolve, reject) => {
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
        try {
          resolve(JSON.parse(buf.toString('utf8')));
        } catch (e) {
          reject(new Error('Invalid JSON from YouTube API: ' + e.message));
        }
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
  const req = https.get({
    hostname: u.hostname,
    path: u.pathname + u.search,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.youtube.com/',
    },
  });
  req.setTimeout(30000);
  return req;
}

module.exports = { request, head, stream };
