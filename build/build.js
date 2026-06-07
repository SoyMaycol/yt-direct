const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const SRC_DIR = path.join(__dirname, '..', 'src');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const BUILD_ENTRY = path.join(SRC_DIR, 'index.js');

function banner() {
  return `/*!
 * yt-direct v${require('../package.json').version}
 * Direct YouTube video downloader — InnerTube API
 * ${require('../package.json').homepage}
 * License: ${require('../package.json').license}
 */\n`;
}

function collectFiles(dir) {
  const entries = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      entries.push(...collectFiles(full));
    } else if (item.name.endsWith('.js')) {
      entries.push(full);
    }
  }
  return entries.sort();
}

function bundle() {
  const files = [BUILD_ENTRY, ...collectFiles(SRC_DIR).filter((f) => f !== BUILD_ENTRY)];
  const visited = new Set();
  const bundled = [];

  function resolveModule(filePath) {
    const resolved = path.resolve(filePath);
    if (visited.has(resolved)) return;
    visited.add(resolved);

    const content = fs.readFileSync(resolved, 'utf8');
    const relative = path.relative(SRC_DIR, resolved);
    bundled.push(`// ── ${relative} ──`);
    bundled.push(content.replace(/^const .+ = require\('(.+?)'\);/gm, (match, reqPath) => {
      if (reqPath.startsWith('node:')) return match;
      if (reqPath.startsWith('.')) {
        const reqFile = path.resolve(path.dirname(resolved), reqPath);
        const ext = fs.existsSync(reqFile) ? reqFile :
                    fs.existsSync(reqFile + '.js') ? reqFile + '.js' : null;
        if (ext && !visited.has(ext)) {
          resolveModule(ext);
        }
      }
      return match;
    }));
  }

  resolveModule(BUILD_ENTRY);

  const output = banner() + bundled.join('\n');

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'index.js'), output);

  const esm = output
    .replace(/module\.exports\s*=\s*/g, 'export default ')
    .replace(/const \{([^}]+)\} = require\('node:([^']+)'\)/g, 'import {$1} from "node:$2"')
    .replace(/const (\w+) = require\('node:([^']+)'\)/g, 'import $1 from "node:$2"');

  fs.writeFileSync(path.join(DIST_DIR, 'index.mjs'), esm);
  fs.writeFileSync(path.join(DIST_DIR, 'index.d.ts'), `declare module 'yt-direct' {\n  export = ytdl;\n}\n`);

  console.log(`✓ Built: dist/index.js (${(Buffer.byteLength(output) / 1024).toFixed(1)}KB)`);
  console.log(`✓ Built: dist/index.mjs (${(Buffer.byteLength(esm) / 1024).toFixed(1)}KB)`);

  // Integrity hash
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha256').update(output).digest('hex');
  fs.writeFileSync(path.join(DIST_DIR, '.integrity'), hash);
  console.log(`✓ Integrity: ${hash.slice(0, 16)}...`);
}

bundle();
