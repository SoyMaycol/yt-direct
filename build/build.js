const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SRC_DIR = path.join(__dirname, '..', 'src');
const DIST_DIR = path.join(__dirname, '..', 'dist');

function banner() {
  return `/*! yt-direct v${require('../package.json').version} */\n`;
}

function collectFiles(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...collectFiles(full));
    else if (item.name.endsWith('.js')) files.push(full);
  }
  return files.sort();
}

function bundle() {
  const entry = path.join(SRC_DIR, 'index.js');
  const all = [entry, ...collectFiles(SRC_DIR).filter(f => f !== entry)];
  const visited = new Set();
  const lines = [];

  function resolve(file) {
    const resolved = path.resolve(file);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    const content = fs.readFileSync(resolved, 'utf8');
    lines.push(`// ${path.relative(SRC_DIR, resolved)}`);
    lines.push(content.replace(/require\('(\..+)'\)/g, (m, p) => {
      const abs = path.resolve(path.dirname(resolved), p);
      const withExt = fs.existsSync(abs) ? abs : fs.existsSync(abs + '.js') ? abs + '.js' : null;
      if (withExt && !visited.has(withExt)) resolve(withExt);
      return m;
    }));
  }

  resolve(entry);

  const output = banner() + lines.join('\n');
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'index.js'), output);
  const hash = crypto.createHash('sha256').update(output).digest('hex');
  fs.writeFileSync(path.join(DIST_DIR, '.integrity'), hash);
  console.log(`Built: ${(Buffer.byteLength(output) / 1024).toFixed(1)}KB | ${hash.slice(0, 16)}...`);
}

bundle();
