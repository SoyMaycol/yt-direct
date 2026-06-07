const { FormatError } = require('../core/Errors');

const ITAG_REGISTRY = {
  '18':  { quality: '360p',  container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '22':  { quality: '720p',  container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '37':  { quality: '1080p', container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '38':  { quality: '4K',    container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '59':  { quality: '480p',  container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '78':  { quality: '480p',  container: 'mp4',  type: 'combined', codec: 'H.264 + AAC' },
  '133': { quality: '240p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '134': { quality: '360p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '135': { quality: '480p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '136': { quality: '720p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '137': { quality: '1080p', container: 'mp4',  type: 'video',    codec: 'H.264' },
  '138': { quality: '2160p', container: 'mp4',  type: 'video',    codec: 'H.264' },
  '139': { quality: '48kbps',container: 'mp4',  type: 'audio',    codec: 'AAC' },
  '140': { quality: '128kbps',container: 'mp4', type: 'audio',    codec: 'AAC' },
  '141': { quality: '256kbps',container: 'mp4', type: 'audio',    codec: 'AAC' },
  '160': { quality: '144p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '242': { quality: '240p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '243': { quality: '360p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '244': { quality: '480p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '247': { quality: '720p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '248': { quality: '1080p', container: 'webm', type: 'video',    codec: 'VP9' },
  '249': { quality: '50kbps',container: 'webm', type: 'audio',    codec: 'Opus' },
  '250': { quality: '70kbps',container: 'webm', type: 'audio',    codec: 'Opus' },
  '251': { quality: '160kbps',container: 'webm',type: 'audio',    codec: 'Opus' },
  '271': { quality: '1440p', container: 'webm', type: 'video',    codec: 'VP9' },
  '272': { quality: '2160p', container: 'webm', type: 'video',    codec: 'VP9' },
  '278': { quality: '144p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '298': { quality: '720p',  container: 'mp4',  type: 'video',    codec: 'H.264' },
  '299': { quality: '1080p', container: 'mp4',  type: 'video',    codec: 'H.264' },
  '302': { quality: '720p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '303': { quality: '1080p', container: 'webm', type: 'video',    codec: 'VP9' },
  '308': { quality: '1440p', container: 'webm', type: 'video',    codec: 'VP9' },
  '313': { quality: '2160p', container: 'webm', type: 'video',    codec: 'VP9' },
  '315': { quality: '2160p', container: 'webm', type: 'video',    codec: 'VP9' },
  '394': { quality: '144p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '395': { quality: '240p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '396': { quality: '360p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '397': { quality: '480p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '398': { quality: '720p',  container: 'mp4',  type: 'video',    codec: 'AV1' },
  '399': { quality: '1080p', container: 'mp4',  type: 'video',    codec: 'AV1' },
  '400': { quality: '1440p', container: 'mp4',  type: 'video',    codec: 'AV1' },
  '401': { quality: '2160p', container: 'mp4',  type: 'video',    codec: 'AV1' },
  '402': { quality: '4320p', container: 'mp4',  type: 'video',    codec: 'AV1' },
  '571': { quality: '48kbps',container: 'mp4',  type: 'audio',    codec: 'AAC' },
  '597': { quality: '48kbps',container: 'mp4',  type: 'audio',    codec: 'AAC' },
  '598': { quality: '144p',  container: 'webm', type: 'video',    codec: 'VP9' },
  '599': { quality: '32kbps',container: 'mp4',  type: 'audio',    codec: 'AAC' },
  '600': { quality: '32kbps',container: 'webm', type: 'audio',    codec: 'Opus' },
};

const CONTAINER_MAP = {
  mp4:  { mime: 'video/mp4',  extension: '.mp4',  default: true },
  webm: { mime: 'video/webm', extension: '.webm', default: false },
  mkv:  { mime: 'video/x-matroska', extension: '.mkv', default: false, requiresMerge: true },
  avi:  { mime: 'video/x-msvideo',  extension: '.avi', default: false, requiresMerge: true },
  mov:  { mime: 'video/quicktime',  extension: '.mov', default: false, requiresMerge: true },
  m4a:  { mime: 'audio/mp4',       extension: '.m4a', default: false },
  aac:  { mime: 'audio/aac',       extension: '.aac', default: false, requiresMerge: true },
  flac: { mime: 'audio/flac',      extension: '.flac', default: false, requiresMerge: true },
  ogg:  { mime: 'audio/ogg',       extension: '.ogg',  default: false, requiresMerge: true },
  mp3:  { mime: 'audio/mpeg',      extension: '.mp3',  default: false, requiresMerge: true },
  wav:  { mime: 'audio/wav',       extension: '.wav',  default: false, requiresMerge: true },
};

const QUALITY_TIERS = ['4320p', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];

function getItagMeta(itag) {
  return ITAG_REGISTRY[String(itag)] || null;
}

function resolveContainer(name) {
  const key = String(name).toLowerCase().replace(/^\./, '');
  return CONTAINER_MAP[key] || null;
}

function requiresConversion(format, targetContainer) {
  const container = resolveContainer(targetContainer);
  if (!container) return false;
  if (container.requiresMerge) return true;
  const fmtContainer = resolveContainer(format.container || 'mp4');
  if (!fmtContainer) return true;
  return fmtContainer.extension !== container.extension;
}

function qualityIndex(label) {
  const idx = QUALITY_TIERS.indexOf(label);
  if (idx !== -1) return idx;
  if (/^\d+p$/.test(label)) return QUALITY_TIERS.indexOf(label) !== -1 ? QUALITY_TIERS.indexOf(label) : -1;
  return -1;
}

function isQualitySupported(label) {
  return QUALITY_TIERS.includes(label) || ['audio', 'best', 'auto'].includes(label);
}

function isContainerSupported(name) {
  return !!resolveContainer(name);
}

module.exports = {
  ITAG_REGISTRY,
  CONTAINER_MAP,
  QUALITY_TIERS,
  getItagMeta,
  resolveContainer,
  requiresConversion,
  qualityIndex,
  isQualitySupported,
  isContainerSupported,
};
