const ytdl = require('../src/index');

(async () => {
  try {
    console.log('Fetching video info...');
    const video = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      quality: '720p',
      format: 'mp4',
    });

    console.log('Title:', video.title);
    console.log('Format:', video.format.qualityLabel, `(${video.format.container})`);
    console.log('Type:', video.type);
    console.log('Streaming to file...');

    await video.download('./video.mp4');
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
