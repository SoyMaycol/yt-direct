const ytdl = require('../src/index');

(async () => {
  try {
    const info = await ytdl.getInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('Title:', info.title);
    console.log('Duration:', info.duration, 's');
    console.log('Formats available:', info.formats.length);
    console.log('\n─ Available formats ─');
    for (const f of info.formats) {
      console.log(`  itag ${f.itag}: ${f.quality} | ${f.container} | ${f.codec} | ${f.size}MB | ${f.type}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
