const { resolveContainer, requiresConversion } = require('./Registry');

function mimeTypeToContainer(mimeType) {
  if (!mimeType) return 'mp4';
  const parts = mimeType.split('/');
  if (parts.length < 2) return 'mp4';
  const sub = parts[1].split(';')[0].trim().toLowerCase();
  const map = {
    mp4: 'mp4',
    webm: 'webm',
    'x-matroska': 'mkv',
    'x-msvideo': 'avi',
    quicktime: 'mov',
    aac: 'aac',
    mpeg: 'mp3',
    wav: 'wav',
    ogg: 'ogg',
    flac: 'flac',
    '3gpp': '3gp',
  };
  return map[sub] || sub;
}

function checkContainer(format, targetContainer) {
  const current = format.container || mimeTypeToContainer(format.mimeType);
  if (!targetContainer) return { compatible: true, current, needsConversion: false };
  const tc = resolveContainer(targetContainer);
  if (!tc) return { compatible: false, current, target: targetContainer, needsConversion: false };
  if (current === targetContainer) return { compatible: true, current, target: targetContainer, needsConversion: false };
  return {
    compatible: false,
    current,
    target: targetContainer,
    needsConversion: true,
    requiresTool: requiresConversion(format, targetContainer),
  };
}

module.exports = { mimeTypeToContainer, checkContainer };
