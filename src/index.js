const { fetch } = require('./core/InnerTube');
const { YouTubeError, FormatError, ValidationError, QualityError, MergeError, NetworkError } = require('./core/Errors');
const { FormatSelector } = require('./formats/Selector');
const { QUALITY_TIERS, CONTAINER_MAP } = require('./formats/Registry');
const { validateOptions } = require('./utils/validators');
const { extractVideoId } = require('./utils/url');
const { merge } = require('./download/Merge');
const { downloadToFile, verify } = require('./download/Downloader');
const { createStream } = require('./download/Stream');
const { VERSION } = require('./utils/constants');

function ytdl(input, options = {}) {
  const videoId = extractVideoId(input);
  if (!videoId) {
    return Promise.reject(new ValidationError(`Invalid YouTube URL or video ID: "${input}"`));
  }

  const o = validateOptions(options);

  return (async () => {
    const t0 = Date.now();
    const info = await getInfo(videoId);
    const selector = new FormatSelector(info.streamingData);
    const selected = selector.select(o);

    const format = selected.format;
    const audio = selected.audio || null;

    const dopts = {
      concurrency: o.concurrency,
      timeout: o.timeout,
      headers: o.headers,
      cookies: o.cookies,
      onProgress: o.onProgress,
    };

    const res = {
      videoId,
      title: info.title || 'video',
      url: format.url,
      format,
      audio,
      type: selected.type,
      _infoTime: Date.now() - t0,

      stream: () => createStream(format.url, dopts),
      pipe: (w) => createStream(format.url, dopts).pipe(w),

      download: async (fp) => {
        if (!fp) fp = `${sanitize(info.title || 'video')}.${o.format || format.container || 'mp4'}`;
        const result = await downloadToFile(format.url, fp, dopts);
        return {
          path: result.path,
          size: result.size,
          statusCode: result.code,
          time: result.time,
          speed: result.size > 0 && result.time > 0 ? Math.round((result.size / 1024 / 1024) / (result.time / 1000) * 10) / 10 : 0,
        };
      },
    };

    if (o.merge && audio) {
      res.merge = async (fp) => {
        if (!fp) fp = `${sanitize(info.title || 'video')}.${o.format || 'mp4'}`;
        const fs = require('node:fs');
        const tv = `/tmp/y-${format.itag}-v`;
        const ta = `/tmp/y-${audio.itag}-a`;
        try {
          const t0 = Date.now();
          await Promise.all([
            downloadToFile(format.url, tv, dopts),
            downloadToFile(audio.url, ta, dopts),
          ]);
          await merge(tv, ta, fp, o.merge);
          return {
            path: fp,
            time: Date.now() - t0,
          };
        } finally {
          try { fs.unlinkSync(tv); } catch {}
          try { fs.unlinkSync(ta); } catch {}
        }
      };
    }

    return res;
  })();
}

async function getInfo(input) {
  const videoId = extractVideoId(input);
  if (!videoId) throw new ValidationError(`Invalid YouTube URL or video ID: "${input}"`);

  const result = await fetch(videoId);
  const sel = new FormatSelector(result.streamingData);

  return {
    id: videoId,
    title: result.videoDetails.title || 'Unknown',
    author: result.videoDetails.author || result.videoDetails.channelId || null,
    duration: parseInt(result.videoDetails.lengthSeconds || '0', 10),
    thumbnails: result.videoDetails.thumbnail?.thumbnails || [],
    description: result.videoDetails.shortDescription || '',
    viewCount: parseInt(result.videoDetails.viewCount || '0', 10),
    isLive: result.videoDetails.isLive === true,
    streamingData: result.streamingData,
    formats: sel.list(),
    combined: sel.combined.map((f) => f.toJSON()),
    adaptive: sel.adaptive.map((f) => f.toJSON()),
    clientUsed: result.clientUsed,
  };
}

function sanitize(name) {
  return String(name || 'video').replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim() || 'video';
}

ytdl.getInfo = getInfo;
ytdl.getFormats = (i) => getInfo(i).then((r) => r.formats);
ytdl.verifyURL = verify;
ytdl.createStream = createStream;
ytdl.version = VERSION;
ytdl.FORMATS = Object.keys(CONTAINER_MAP);
ytdl.QUALITIES = [...QUALITY_TIERS, 'auto', 'best', 'audio'];
ytdl.YouTubeError = YouTubeError;
ytdl.FormatError = FormatError;
ytdl.ValidationError = ValidationError;
ytdl.QualityError = QualityError;
ytdl.MergeError = MergeError;
ytdl.NetworkError = NetworkError;

module.exports = ytdl;
module.exports.default = ytdl;
