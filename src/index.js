const { fetch } = require('./core/InnerTube');
const { YouTubeError, FormatError, ValidationError, QualityError, MergeError, NetworkError } = require('./core/Errors');
const { FormatSelector } = require('./formats/Selector');
const { resolveContainer, requiresConversion, QUALITY_TIERS, CONTAINER_MAP } = require('./formats/Registry');
const { validateOptions } = require('./utils/validators');
const { extractVideoId } = require('./utils/url');
const { merge } = require('./download/Merge');
const { downloadToFile, createReadStream, verify } = require('./download/Downloader');
const { createStream } = require('./download/Stream');
const { VERSION } = require('./utils/constants');

function ytdl(input, options = {}) {
  const videoId = extractVideoId(input);
  if (!videoId) {
    return Promise.reject(new ValidationError(`Invalid YouTube URL or video ID: "${input}"`));
  }

  const normalized = validateOptions(options);

  return (async () => {
    const info = await getInfo(videoId);
    const selector = new FormatSelector(info.streamingData);
    const selected = selector.select(normalized);

    const format = selected.format;
    const audio = selected.audio || null;

    const response = {
      videoId,
      title: info.title || 'video',
      url: format.url,
      format,
      audio,
      type: selected.type,
      stream: () => createStream(format.url),
      pipe: (writable) => createStream(format.url).pipe(writable),
      download: async (filePath) => {
        if (!filePath) {
          const ext = normalized.format || format.container || 'mp4';
          filePath = `${sanitize(info.title || 'video')}.${ext}`;
        }
        return downloadToFile(format.url, filePath, {
          concurrency: normalized.concurrency,
          onProgress: normalized.onProgress,
        });
      },
    };

    if (normalized.merge && audio) {
      response.merge = async (outputPath) => {
        if (!outputPath) {
          const ext = normalized.format || 'mp4';
          outputPath = `${sanitize(info.title || 'video')}.${ext}`;
        }
        const fs = require('node:fs');
        const tmpVideo = `/tmp/yt-direct-${format.itag}-video`;
        const tmpAudio = `/tmp/yt-direct-${audio.itag}-audio`;
        try {
          await Promise.all([
            downloadToFile(format.url, tmpVideo),
            downloadToFile(audio.url, tmpAudio),
          ]);
          await merge(tmpVideo, tmpAudio, outputPath, normalized.merge);
          return outputPath;
        } finally {
          try { fs.unlinkSync(tmpVideo); } catch {}
          try { fs.unlinkSync(tmpAudio); } catch {}
        }
      };
    }

    return response;
  })();
}

async function getInfo(input) {
  const videoId = extractVideoId(input);
  if (!videoId) throw new ValidationError(`Invalid YouTube URL or video ID: "${input}"`);

  const result = await fetch(videoId);
  const selector = new FormatSelector(result.streamingData);

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
    formats: selector.list(),
    combined: selector.combined.map((f) => f.toJSON()),
    adaptive: selector.adaptive.map((f) => f.toJSON()),
    clientUsed: result.clientUsed,
  };
}

function sanitize(name) {
  return String(name || 'video').replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim() || 'video';
}

ytdl.getInfo = getInfo;
ytdl.getFormats = (input) => getInfo(input).then((i) => i.formats);
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
