const { QualityError } = require('../core/Errors');

const QUALITY_MAP = {
  '4320p': 4320,
  '2160p': 2160,
  '1440p': 1440,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
  '240p': 240,
  '144p': 144,
};

const QUALITY_TIERS = Object.keys(QUALITY_MAP);

function toHeight(label) {
  if (!label) return 0;
  const cleaned = String(label).toLowerCase().replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

function matchQualityRank(format, targetHeight, tolerance = 72) {
  if (!targetHeight) return true;
  const h = format.height || toHeight(format.qualityLabel);
  if (!h) return false;
  return Math.abs(h - targetHeight) <= tolerance;
}

function getFallbackChain(requested) {
  const t = String(requested || '').toLowerCase();
  if (t === 'auto' || t === 'best') return [...QUALITY_TIERS];
  if (t === 'audio') return ['audio'];
  const idx = QUALITY_TIERS.indexOf(t);
  if (idx !== -1) return QUALITY_TIERS.slice(idx);
  return [...QUALITY_TIERS];
}

function validateQuality(requested) {
  if (!requested) return 'auto';
  const t = String(requested).toLowerCase();
  if (t === 'auto' || t === 'best' || t === 'audio') return t;
  if (QUALITY_TIERS.includes(t)) return t;
  throw new QualityError(
    `Unsupported quality "${requested}". Available: ${QUALITY_TIERS.join(', ')}, auto, best, audio`,
    { requested, supported: [...QUALITY_TIERS, 'auto', 'best', 'audio'] }
  );
}

module.exports = {
  QUALITY_MAP,
  QUALITY_TIERS,
  toHeight,
  matchQualityRank,
  getFallbackChain,
  validateQuality,
};
