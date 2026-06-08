const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');
const PKG = path.join(__dirname, '..', 'package.json');

function resolvePath(from, target) {
  if (target.startsWith('node:')) return null;
  const abs = path.resolve(path.dirname(from), target);
  if (target.endsWith('.json')) {
    return fs.existsSync(abs) ? abs : null;
  }
  if (fs.existsSync(abs)) return abs;
  if (fs.existsSync(abs + '.js')) return abs + '.js';
  return null;
}

function getModuleId(absPath) {
  if (absPath.endsWith('.json')) return '__json__' + path.basename(absPath, '.json');
  return path.relative(SRC, absPath).replace(/\.js$/, '').replace(/\\/g, '/');
}

function build() {
  const entry = path.join(SRC, 'index.js');
  const modules = new Map();
  const queue = [entry];
  const visited = new Set();

  while (queue.length) {
    const absPath = queue.shift();
    if (visited.has(absPath)) continue;
    visited.add(absPath);

    const code = fs.readFileSync(absPath, 'utf8');
    const id = getModuleId(absPath);
    const deps = [];

    const processed = code.replace(/require\(['"](.+?)['"]\)/g, (match, req) => {
      if (req.startsWith('node:')) return match;
      const resolved = resolvePath(absPath, req);
      if (resolved) {
        if (resolved.endsWith('.json')) {
          return JSON.stringify(JSON.parse(fs.readFileSync(resolved, 'utf8')));
        }
        deps.push(resolved);
        if (!visited.has(resolved) && !queue.includes(resolved)) queue.push(resolved);
        return `__r__('${getModuleId(resolved)}')`;
      }
      return match;
    });

    modules.set(absPath, { id, code: processed, deps });
  }

  const entryId = getModuleId(entry);
  const moduleEntries = [];

  for (const [absPath, mod] of modules) {
    const depIds = mod.deps.map(d => getModuleId(d));
    moduleEntries.push({ id: mod.id, code: mod.code, deps: depIds });
  }

  const pkgVersion = JSON.parse(fs.readFileSync(PKG, 'utf8')).version;

  let output = `/*! yt-direct v${pkgVersion} | MIT */\n\n`;
  output += `(function(){\n'use strict';\n\n`;

  output += `const __m = {\n`;
  for (const mod of moduleEntries) {
    const code = mod.code.replace(/^'use strict';?\s*/gm, '').replace(/\n{3,}/g, '\n\n');
    output += `"${mod.id}":[function(module,exports,__r__){\n${code}\n},${JSON.stringify(mod.deps)}],\n`;
  }
  output += `};\n\n`;

  output += `var __c={};\n`;
  output += `function __r(id){\n`;
  output += `  if(__c[id])return __c[id].exports;\n`;
  output += `  var f=__m[id][0],d=__m[id][1],m={exports:{}};\n`;
  output += `  __c[id]=m;\n`;
  output += `  f(m,m.exports,function(q){for(var i=0;i<d.length;i++)if(d[i]===q)return __r(d[i]);throw new Error('Mod not found: '+q+' from '+id)});\n`;
  output += `  return m.exports;\n`;
  output += `}\n\n`;

  output += `module.exports=__r("${entryId}");\n`;
  output += `})();\n`;

  const esmOutput = output.replace('module.exports=', 'const __ytdl=') + '\nexport default __ytdl;\n';

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'index.js'), output);

  const esmClean = esmOutput.replace(/\nmodule\.exports=__r\(.*?\);\n/, '\n');
  fs.writeFileSync(path.join(DIST, 'index.mjs'), esmClean);
  fs.writeFileSync(path.join(DIST, 'index.d.ts'), `declare module 'yt-direct' {\n  const ytdl: any;\n  export default ytdl;\n}\n`);

  const hash = crypto.createHash('sha256').update(output).digest('hex');
  fs.writeFileSync(path.join(DIST, '.integrity'), hash);

  const size = (Buffer.byteLength(output) / 1024).toFixed(1);
  console.log(`Built: ${size}KB | ${moduleEntries.length} modules | ${hash.slice(0, 16)}...`);
}

build();
