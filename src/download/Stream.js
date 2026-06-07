const { Transform } = require('node:stream');
const { createReadStream } = require('./Downloader');

class DownloadStream extends Transform {
  #url;
  #bytesRead;
  #startTime;
  #onProgress;

  constructor(url, options = {}) {
    super({ highWaterMark: 1024 * 1024 });
    this.#url = url;
    this.#bytesRead = 0;
    this.#startTime = Date.now();
    this.#onProgress = options.onProgress || null;
  }

  _transform(chunk, encoding, callback) {
    this.#bytesRead += chunk.length;
    if (this.#onProgress) {
      this.#onProgress({
        bytes: this.#bytesRead,
        elapsed: Date.now() - this.#startTime,
      });
    }
    this.push(chunk);
    callback();
  }

  _flush(callback) {
    callback();
  }

  get bytesRead() {
    return this.#bytesRead;
  }

  get elapsed() {
    return Date.now() - this.#startTime;
  }
}

function createStream(url, options = {}) {
  const transform = new DownloadStream(url, options);
  const source = createReadStream(url);

  source.on('error', (err) => transform.destroy(err));
  source.on('response', () => {});
  source.pipe(transform);

  return transform;
}

module.exports = { DownloadStream, createStream };
