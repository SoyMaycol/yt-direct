const { URL } = require('node:url');

function extractVideoId(input) {
  if (!input) return null;

  const trimmed = String(input).trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace('www.', '').replace('m.', '');

    if (host === 'youtu.be') {
      return u.pathname.replace(/^\//, '').split(/[?&#]/)[0] || null;
    }

    if (host === 'youtube.com') {
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/live/')) {
        return u.pathname.split('/')[2]?.split(/[?&#]/)[0] || null;
      }
      return u.searchParams.get('v') || null;
    }
  } catch {}

  return null;
}

function isValidVideoId(id) {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

module.exports = { extractVideoId, isValidVideoId };
