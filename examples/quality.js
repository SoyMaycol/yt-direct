const ytdl = require('../src/index');

(async () => {
  try {
    const video = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      quality: '1080p',
      format: 'mp4',
      preferMp4: true,
      onProgress: (done, total) => {
        const pct = ((done / total) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${pct}% (${(done/1024/1024).toFixed(1)}MB / ${(total/1024/1024).toFixed(1)}MB)`);
      },
    });

    console.log('Title:', video.title);
    console.log('Quality:', video.format.qualityLabel);
    console.log('Container:', video.format.container);

    await video.download('./video-1080p.mp4');
    console.log('\nComplete!');
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
