const ytdl = require('../src/index');

(async () => {
  try {
    const video = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      quality: '2160p',
      format: 'mkv',
      merge: { tool: 'ffmpeg', output: './output.mkv' },
    });

    console.log('Title:', video.title);
    console.log('Video:', video.format.qualityLabel, `(${video.format.container})`);
    console.log('Audio:', video.audio.qualityLabel, `(${video.audio.container})`);

    if (video.merge) {
      console.log('Downloading and merging with FFmpeg...');
      const output = await video.merge();
      console.log('Merged file:', output);
    }
  } catch (err) {
    if (err.code === 'FORMAT_ERROR') {
      console.log('Format warning:', err.message);
      console.log('HINT: Use { merge: { tool: "ffmpeg" } } to convert.');
    } else {
      console.error('Error:', err.message);
    }
  }
})();
