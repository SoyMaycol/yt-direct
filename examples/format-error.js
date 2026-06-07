const ytdl = require('../src/index');

(async () => {
  try {
    const video = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      quality: '720p',
      format: 'mp3',
    });
    await video.download('./audio.mp3');
  } catch (err) {
    if (err.code === 'FORMAT_ERROR') {
      console.log('Auto-detected format issue:');
      console.log('→', err.message);
      console.log('\nTIP: YouTube does not provide MP3 natively.');
      console.log('Convert with: { merge: { tool: "ffmpeg" } }');
    } else {
      console.error('Error:', err.message);
    }
  }
})();
