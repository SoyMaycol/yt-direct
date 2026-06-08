const { Format } = require('./Format');
const { getFallbackChain, matchQualityRank, toHeight, validateQuality } = require('./Qualities');
const { checkContainer, mimeTypeToContainer } = require('./mime');
const { FormatError } = require('../core/Errors');

class FormatSelector {
  #combined;
  #adaptive;
  #all;

  constructor(streamingData) {
    this.#combined = (streamingData.formats || []).map((f) => new Format({ ...f, _source: 'combined' }));
    this.#adaptive = (streamingData.adaptiveFormats || []).map((f) => new Format({ ...f, _source: 'adaptive' }));
    this.#all = [...this.#combined, ...this.#adaptive];
  }

  get formats() {
    return [...this.#all];
  }

  get combined() {
    return [...this.#combined];
  }

  get adaptive() {
    return [...this.#adaptive];
  }

  list(options = {}) {
    let list = [...this.#all];

    if (options.type === 'video') list = list.filter((f) => f.isVideo);
    else if (options.type === 'audio') list = list.filter((f) => f.isAudio);
    else if (options.type === 'combined') list = list.filter((f) => f.isCombined);

    if (options.minHeight) list = list.filter((f) => f.height >= options.minHeight);
    if (options.minBitrate) list = list.filter((f) => f.bitrate >= options.minBitrate);
    if (options.container) list = list.filter((f) => f.container === options.container);
    if (options.codec) list = list.filter((f) => f.codec.toLowerCase().includes(options.codec.toLowerCase()));

    return list.map((f) => f.toJSON());
  }

  select(options = {}) {
    const quality = validateQuality(options.quality || 'auto');
    const container = options.format || null;

    if (quality === 'audio') {
      return this.#selectAudio(options);
    }

    const chain = getFallbackChain(quality);

    for (const q of chain) {
      const targetH = toHeight(q);
      const result = this.#tryQuality(targetH, container, options);
      if (result) return result;
    }

    return this.#lastResort(container, options);
  }

  #tryQuality(targetH, container, options) {
    const preferMp4 = options.preferMp4 !== false;

    let candidates = this.#combined
      .filter((f) => f.hasUrl && matchQualityRank(f, targetH))
      .sort(this.#sortFn(preferMp4));

    if (candidates.length) {
      const picked = candidates[0];
      const cc = container ? checkContainer(picked, container) : null;

      if (container && cc && cc.needsConversion && !options.merge) {
        throw new FormatError(
          `Format "${container}" requires a merge/convert tool for itag ${picked.itag} (${picked.qualityLabel}, ${picked.container}). ` +
          `Available source: ${picked.container}. Use { merge: { tool: 'ffmpeg', output: 'file.${container}' } } to convert.`,
          {
            itag: picked.itag,
            sourceContainer: picked.container,
            targetContainer: container,
            requiresConversion: true,
            suggestedTool: 'ffmpeg',
          }
        );
      }

      return { format: picked, type: 'combined' };
    }

    const videos = this.#adaptive
      .filter((f) => f.isVideo && f.hasUrl && matchQualityRank(f, targetH))
      .sort(this.#sortFn(preferMp4));

    if (videos.length) {
      const video = videos[0];
      const audios = this.#adaptive
        .filter((f) => f.isAudio && f.hasUrl)
        .sort((a, b) => b.bitrate - a.bitrate);

      const cc = container ? checkContainer(video, container) : null;

      if (container && cc && cc.needsConversion && !options.merge) {
        throw new FormatError(
          `Format "${container}" requires a merge/convert tool. ` +
          `Source: ${video.container}. Use { merge: { tool: 'ffmpeg', output: 'file.${container}' } }.`,
          {
            itag: video.itag,
            sourceContainer: video.container,
            targetContainer: container,
            requiresConversion: true,
            suggestedTool: 'ffmpeg',
          }
        );
      }

      const result = { format: video, type: 'video-only' };

      if (audios.length) {
        result.audio = audios[0];
        result.type = 'separate';
      }

      return result;
    }

    return null;
  }

  #selectAudio(options) {
    const container = options.format || null;
    const audios = this.#all
      .filter((f) => f.isAudio && f.hasUrl)
      .sort((a, b) => b.bitrate - a.bitrate);

    if (!audios.length) throw new FormatError('No audio formats available');

    if (container) {
      const match = audios.find((f) => f.container === container);
      if (match) return { format: match, type: 'audio', audio: null };

      const best = audios[0];
      throw new FormatError(
        `No audio format in "${container}" available. Best available: ${best.container} (${best.qualityLabel}). ` +
        `Use { merge: { tool: 'ffmpeg', output: 'file.${container}' } } to convert.`,
        {
          sourceContainer: best.container,
          targetContainer: container,
          requiresConversion: true,
          suggestedTool: 'ffmpeg',
        }
      );
    }

    return { format: audios[0], type: 'audio', audio: null };
  }

  #lastResort(container, options) {
    if (this.#combined.length) {
      return { format: this.#combined[0], type: 'combined' };
    }
    const video = this.#adaptive.find((f) => f.isVideo && f.hasUrl);
    if (video) {
      const audio = this.#adaptive.find((f) => f.isAudio && f.hasUrl);
      return { format: video, type: audio ? 'separate' : 'video-only', audio };
    }
    throw new FormatError('No compatible formats found for this video');
  }

  #sortFn(preferMp4) {
    return (a, b) => {
      if (preferMp4) {
        const aMp4 = a.container === 'mp4' ? 1 : 0;
        const bMp4 = b.container === 'mp4' ? 1 : 0;
        if (aMp4 !== bMp4) return bMp4 - aMp4;
      }
      return b.qualityRank - a.qualityRank;
    };
  }
}

module.exports = { FormatSelector };
