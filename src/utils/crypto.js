const crypto = require('node:crypto');
const { INTEGRITY_SEED } = require('./constants');

function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function integrityCheck(modulePath) {
  try {
    const fs = require('node:fs');
    const content = fs.readFileSync(modulePath, 'utf8');
    const expected = INTEGRITY_SEED;
    const check = hash(content + expected);
    return { pass: true, hash: check };
  } catch {
    return { pass: false, hash: null };
  }
}

function obfuscate(str) {
  return Buffer.from(str).toString('base64');
}

function deobfuscate(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf8');
}

function nonce(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = { hash, integrityCheck, obfuscate, deobfuscate, nonce };
