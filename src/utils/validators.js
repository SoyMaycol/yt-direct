const { ValidationError } = require('../core/Errors');
const { QUALITY_TIERS } = require('../formats/Qualities');
const { CONTAINER_MAP } = require('../formats/Registry');

const VALID_QUALITIES = [...QUALITY_TIERS, 'auto', 'best', 'audio'];
const VALID_CONTAINERS = Object.keys(CONTAINER_MAP);
const VALID_FILTERS = ['audioandvideo', 'videoonly', 'audioonly'];
const VALID_LANGUAGES = ['en', 'es', 'pt', 'fr', 'de', 'ja', 'ko', 'zh', 'ru', 'ar', 'hi'];
const MAX_CONCURRENCY = 12;
const MIN_CONCURRENCY = 1;
const MAX_RETRIES = 10;
const MAX_TIMEOUT = 600000;

function validateOptions(options = {}) {
  const errors = [];

  if (options.quality && !VALID_QUALITIES.includes(String(options.quality).toLowerCase())) {
    errors.push(`Invalid quality "${options.quality}". Valid: ${VALID_QUALITIES.join(', ')}`);
  }

  if (options.format && !VALID_CONTAINERS.includes(String(options.format).toLowerCase())) {
    errors.push(`Invalid format "${options.format}". Valid: ${VALID_CONTAINERS.join(', ')}`);
  }

  if (options.filter && !VALID_FILTERS.includes(options.filter)) {
    errors.push(`filter must be one of: ${VALID_FILTERS.join(', ')}`);
  }

  if (options.language && !VALID_LANGUAGES.includes(options.language)) {
    errors.push(`language must be a valid ISO code: ${VALID_LANGUAGES.join(', ')}`);
  }

  if (options.merge) {
    if (typeof options.merge !== 'object' || Array.isArray(options.merge)) {
      errors.push('merge must be an object with optional { tool, path, output }');
    }
  }

  if (options.headers !== undefined) {
    if (typeof options.headers !== 'object' || options.headers === null || Array.isArray(options.headers)) {
      errors.push('headers must be a plain object like { "Referer": "..." }');
    }
  }

  if (options.concurrency !== undefined) {
    const n = parseInt(options.concurrency, 10);
    if (isNaN(n) || n < MIN_CONCURRENCY || n > MAX_CONCURRENCY) {
      errors.push(`concurrency must be a number between ${MIN_CONCURRENCY} and ${MAX_CONCURRENCY}`);
    }
  }

  if (options.timeout !== undefined) {
    const n = parseInt(options.timeout, 10);
    if (isNaN(n) || n < 5000 || n > MAX_TIMEOUT) {
      errors.push(`timeout must be between 5000 and ${MAX_TIMEOUT}ms`);
    }
  }

  if (options.retries !== undefined) {
    const n = parseInt(options.retries, 10);
    if (isNaN(n) || n < 0 || n > MAX_RETRIES) {
      errors.push(`retries must be between 0 and ${MAX_RETRIES}`);
    }
  }

  if (options.cookies !== undefined) {
    if (typeof options.cookies !== 'string' && typeof options.cookies !== 'object') {
      errors.push('cookies must be a string (path to cookie jar) or an object { name: value }');
    }
  }

  if (errors.length) {
    throw new ValidationError(`Invalid options:\n  - ${errors.join('\n  - ')}`, { errors });
  }

  return {
    quality: String(options.quality || 'auto').toLowerCase(),
    format: options.format ? String(options.format).toLowerCase() : null,
    filter: options.filter || 'audioandvideo',
    language: options.language || 'en',
    preferMp4: options.preferMp4 !== false,
    merge: options.merge || null,
    headers: (options.headers && typeof options.headers === 'object' && !Array.isArray(options.headers))
      ? { ...options.headers }
      : null,
    cookies: options.cookies || null,
    concurrency: Math.min(Math.max(parseInt(options.concurrency) || 6, MIN_CONCURRENCY), MAX_CONCURRENCY),
    timeout: Math.min(Math.max(parseInt(options.timeout) || 30000, 5000), MAX_TIMEOUT),
    retries: Math.min(Math.max(parseInt(options.retries) || 3, 0), MAX_RETRIES),
    onProgress: typeof options.onProgress === 'function' ? options.onProgress : null,
  };
}

module.exports = { validateOptions, VALID_QUALITIES, VALID_CONTAINERS, VALID_FILTERS };
