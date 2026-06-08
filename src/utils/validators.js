const { ValidationError } = require('../core/Errors');
const { QUALITY_TIERS } = require('../formats/Qualities');
const { CONTAINER_MAP } = require('../formats/Registry');

const VALID_QUALITIES = [...QUALITY_TIERS, 'auto', 'best', 'audio'];
const VALID_CONTAINERS = Object.keys(CONTAINER_MAP);

function validateOptions(options = {}) {
  const errors = [];

  if (options.quality && !VALID_QUALITIES.includes(String(options.quality).toLowerCase())) {
    errors.push(`Invalid quality "${options.quality}". Valid: ${VALID_QUALITIES.join(', ')}`);
  }

  if (options.format && !VALID_CONTAINERS.includes(String(options.format).toLowerCase())) {
    errors.push(`Invalid format "${options.format}". Valid: ${VALID_CONTAINERS.join(', ')}`);
  }

  if (options.filter && !['audioandvideo', 'videoonly', 'audioonly'].includes(options.filter)) {
    errors.push('filter must be "audioandvideo", "videoonly", or "audioonly"');
  }

  if (options.merge) {
    if (typeof options.merge !== 'object' || Array.isArray(options.merge)) {
      errors.push('merge must be an object with optional { tool, path, output }');
    }
  }

  if (errors.length) {
    throw new ValidationError(`Invalid options:\n  - ${errors.join('\n  - ')}`, { errors });
  }

  return {
    quality: String(options.quality || 'auto').toLowerCase(),
    format: options.format ? String(options.format).toLowerCase() : null,
    filter: options.filter || 'audioandvideo',
    preferMp4: options.preferMp4 !== false,
    merge: options.merge || null,
    concurrency: Math.min(Math.max(parseInt(options.concurrency) || 6, 1), 12),
    onProgress: typeof options.onProgress === 'function' ? options.onProgress : null,
  };
}

module.exports = { validateOptions, VALID_QUALITIES, VALID_CONTAINERS };
