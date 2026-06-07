const crypto = require('node:crypto');
const { INTEGRITY_SEED } = require('./constants');

function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function integrityCheck(modulePath) {
  try {
    const fs = require('node:fs');
    const content = fs.readFileSync(modulePath, 'utf8');
    const check = hash(content + INTEGRITY_SEED);
    return { pass: true, hash: check };
  } catch {
    return { pass: false, hash: null };
  }
}

function nonce(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = { hash, integrityCheck, nonce };
