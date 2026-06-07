const pkg = require('../../package.json');

module.exports = {
  VERSION: pkg.version,
  NAME: pkg.name,
  HOMEPAGE: pkg.homepage,
  MAX_CONCURRENCY: 6,
  DEFAULT_TIMEOUT: 20000,
  DOWNLOAD_TIMEOUT: 300000,
  CHUNK_SIZE: 10 * 1024 * 1024,
  YOUTUBE_HOST: 'www.youtube.com',
  INNERTUBE_KEY: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
  SUPPORTED_PROTOCOLS: ['http:', 'https:'],
  INTEGRITY_SEED: 'yt-direct-v1',
};
