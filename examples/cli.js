const ytdl = require('../src/index');

const url = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const quality = process.argv[3] || 'auto';

(async () => {
  console.log(`Downloading: ${url}`);
  const video = await ytdl(url, { quality });
  console.log(`Title: ${video.title}`);
  console.log(`Quality: ${video.format.qualityLabel}`);
  await video.download();
  console.log('Done!');
})().catch(e => console.error('Error:', e.message));
