const { getItagMeta, resolveContainer } = require('./Registry');

class Format {
  #raw;
  #meta;

  constructor(rawFormat) {
    this.#raw = rawFormat;
    this.#meta = getItagMeta(rawFormat.itag) || {};

    this.itag = rawFormat.itag;
    this.url = rawFormat.url || null;
    this.mimeType = rawFormat.mimeType || '';
    this.contentLength = rawFormat.contentLength ? Number(rawFormat.contentLength) : 0;
    this.bitrate = rawFormat.bitrate || 0;
    this.width = rawFormat.width || 0;
    this.height = rawFormat.height || 0;
    this.fps = rawFormat.fps || 0;
    this.qualityLabel = rawFormat.qualityLabel || this.#meta.quality || null;
    this.container = rawFormat.container || this.#meta.container || 'mp4';
    this.codec = rawFormat.codecs || this.#meta.codec || 'unknown';
    this.isAudio = this.mimeType.includes('audio');
    this.isVideo = this.mimeType.includes('video');
    this.isCombined = this.#meta.type === 'combined' || (this.isVideo && this.mimeType.includes('mp4a'));
    this.source = rawFormat._source || 'adaptive';
  }

  get hasUrl() {
    return !!this.url;
  }

  get sizeMB() {
    return this.contentLength > 0 ? (this.contentLength / 1024 / 1024).toFixed(1) : '?';
  }

  get qualityRank() {
    if (this.isAudio) return this.bitrate;
    return (this.height || 0) * (this.width || 0);
  }

  toJSON() {
    return {
      itag: this.itag,
      quality: this.qualityLabel,
      container: this.container,
      codec: this.codec,
      size: this.sizeMB,
      width: this.width,
      height: this.height,
      fps: this.fps,
      bitrate: this.bitrate,
      type: this.isCombined ? 'combined' : this.isAudio ? 'audio' : 'video',
      hasUrl: this.hasUrl,
    };
  }

  inspect() {
    return `Format(${this.itag} | ${this.qualityLabel} | ${this.container} | ${this.codec})`;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.inspect();
  }
}

module.exports = { Format };
