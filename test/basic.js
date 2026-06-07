const ytdl = require('../src/index');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

(async () => {
  console.log('yt-direct test suite\n');

  // 1. Extract video ID
  console.log('─ URL parsing ─');
  assert(ytdl.getInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ') instanceof Promise, 'Standard URL');
  assert(ytdl.getInfo('https://youtu.be/dQw4w9WgXcQ') instanceof Promise, 'Short URL');
  assert(ytdl.getInfo('https://www.youtube.com/shorts/T6lHd8ntx6Y') instanceof Promise, 'Shorts URL');
  assert(ytdl.getInfo('https://www.youtube.com/embed/dQw4w9WgXcQ') instanceof Promise, 'Embed URL');

  // 2. Constants
  console.log('\n─ Constants ─');
  assert(Array.isArray(ytdl.FORMATS), 'FORMATS is array');
  assert(Array.isArray(ytdl.QUALITIES), 'QUALITIES is array');
  assert(typeof ytdl.version === 'string', 'version is string');

  // 3. API shape
  console.log('\n─ API surface ─');
  assert(typeof ytdl === 'function', 'ytdl is function');
  assert(typeof ytdl.getInfo === 'function', 'getInfo is function');
  assert(typeof ytdl.getFormats === 'function', 'getFormats is function');
  assert(typeof ytdl.verifyURL === 'function', 'verifyURL is function');
  assert(typeof ytdl.createStream === 'function', 'createStream is function');

  // 4. Validation
  console.log('\n─ Validation ─');
  try { await ytdl(''); assert(false, 'Empty URL rejected'); }
  catch (e) { assert(e.code === 'VALIDATION_ERROR', 'Empty URL error'); }

  try { await ytdl('https://youtube.com/watch?v=xxx', { quality: 'invalid' }); assert(false, 'Invalid quality rejected'); }
  catch (e) { assert(true, 'Invalid quality error'); }

  // 5. Fetch real video info
  console.log('\n─ Fetch video info ─');
  try {
    const info = await ytdl.getInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert(typeof info.title === 'string' && info.title.length > 0, 'Has title');
    assert(info.duration > 0, 'Has duration');
    assert(Array.isArray(info.formats), 'Has formats array');
    assert(info.formats.length > 0, 'Has at least one format');
    assert(typeof info.streamingData === 'object', 'Has streamingData');

    const first = info.formats[0];
    assert('itag' in first, 'Format has itag');
    assert('quality' in first, 'Format has quality');
    assert('container' in first, 'Format has container');
    assert('type' in first, 'Format has type');

    console.log(`  Title: ${info.title}`);
    console.log(`  Formats: ${info.formats.length}`);
  } catch (e) {
    console.log(`  ✗ Fetch failed: ${e.message}`);
    failed++;
  }

  // 6. Download test (verify URL only)
  console.log('\n─ URL verification ─');
  try {
    const result = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { quality: '720p' });
    assert(!!result.url, 'Has URL');
    assert(!!result.format, 'Has format');
    assert(result.format.itag > 0, 'Has valid itag');
    assert(typeof result.title === 'string', 'Has title');

    const ok = await ytdl.verifyURL(result.url);
    assert(ok, 'URL is accessible');

    console.log(`  Quality: ${result.format.qualityLabel}`);
    console.log(`  Container: ${result.format.container}`);
    console.log(`  Size: ${result.format.sizeMB}MB`);
    console.log(`  URL valid: ${ok}`);
  } catch (e) {
    console.log(`  ✗ Download failed: ${e.message}`);
    failed++;
  }

  // 7. Audio-only
  console.log('\n─ Audio-only ─');
  try {
    const audioResult = await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { quality: 'audio' });
    assert(audioResult.type === 'audio', 'Type is audio');
    assert(!!audioResult.url, 'Has audio URL');
    const audioOk = await ytdl.verifyURL(audioResult.url);
    assert(audioOk, 'Audio URL is accessible');
  } catch (e) {
    console.log(`  ✗ Audio failed: ${e.message}`);
    failed++;
  }

  // 8. Format error
  console.log('\n─ Format error ─');
  try {
    await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { quality: '720p', format: 'mp3' });
    assert(false, 'Should reject unsupported format');
  } catch (e) {
    assert(e.code === 'FORMAT_ERROR', `FormatError thrown for mp3 (${e.code})`);
    assert(e.details?.requiresConversion === true, 'Suggests conversion');
  }

  // Summary
  console.log(`\n─ Results: ${passed} passed, ${failed} failed ─`);
  process.exit(failed > 0 ? 1 : 0);
})();
