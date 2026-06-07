const { request } = require('./Client');
const { YouTubeError } = require('./Errors');

const CLIENT_PROFILES = [
  {
    name: 'ANDROID',
    version: '20.10.38',
    sdk: 30,
    os: 'Android',
    osVer: '11',
    ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
  },
  {
    name: 'ANDROID_VR',
    version: '1.71.26',
    sdk: 32,
    os: 'Android',
    osVer: '12L',
    ua: 'com.google.android.apps.youtube.vr.oculus/1.71.26 (Linux; U; Android 12L) gzip',
  },
];

function buildContext(client) {
  return {
    client: {
      clientName: client.name,
      clientVersion: client.version,
      androidSdkVersion: client.sdk,
      osName: client.os,
      osVersion: client.osVer,
      userAgent: client.ua,
      hl: 'en',
      gl: 'US',
      timeZone: 'UTC',
      utcOffsetMinutes: 0,
    },
  };
}

function playerPayload(videoId, client) {
  return JSON.stringify({
    context: buildContext(client),
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  });
}

function parseStreamingData(raw) {
  if (!raw || raw.error) {
    const msg = raw?.error?.message || 'Unknown API error';
    throw new YouTubeError(msg, 'API_ERROR', raw?.error);
  }
  const sd = raw.streamingData;
  if (!sd) {
    throw new YouTubeError('No streaming data in response', 'NO_STREAMING_DATA');
  }
  return sd;
}

function extractFormats(streamingData) {
  return {
    combined: (streamingData.formats || []).filter((f) => f.url),
    adaptive: (streamingData.adaptiveFormats || []).filter((f) => f.url),
  };
}

async function fetch(videoId) {
  let lastError = null;

  for (const client of CLIENT_PROFILES) {
    try {
      const payload = playerPayload(videoId, client);
      const raw = await request(payload);
      const sd = parseStreamingData(raw);
      const { combined, adaptive } = extractFormats(sd);

      if (combined.length > 0 || adaptive.length > 0) {
        return {
          raw,
          videoDetails: raw.videoDetails || {},
          streamingData: sd,
          combined,
          adaptive,
          clientUsed: client.name,
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new YouTubeError('All InnerTube clients failed', 'ALL_CLIENTS_FAILED');
}

module.exports = { fetch, CLIENT_PROFILES };
