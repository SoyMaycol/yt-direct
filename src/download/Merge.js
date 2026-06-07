const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { MergeError } = require('../core/Errors');

const TOOLS = {
  ffmpeg: {
    cmd: 'ffmpeg',
    label: 'FFmpeg',
    check: () => {
      return new Promise((resolve) => {
        const proc = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      });
    },
  },
  avconv: {
    cmd: 'avconv',
    label: 'avconv (Libav)',
    check: () => {
      return new Promise((resolve) => {
        const proc = spawn('avconv', ['-version'], { stdio: 'ignore' });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      });
    },
  },
};

async function detectTool(name) {
  if (name) {
    const tool = TOOLS[name.toLowerCase()];
    if (!tool) throw new MergeError(`Unknown merge tool "${name}". Supported: ${Object.keys(TOOLS).join(', ')}`);
    const available = await tool.check();
    if (!available) throw new MergeError(`"${tool.label}" not found in PATH. Install it or provide a custom path.`);
    return tool;
  }

  for (const [key, tool] of Object.entries(TOOLS)) {
    if (await tool.check()) return tool;
  }

  return null;
}

function buildArgs(tool, videoPath, audioPath, outputPath) {
  const cmd = tool.cmd || 'ffmpeg';
  return {
    cmd,
    args: [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      '-y',
      outputPath,
    ],
  };
}

async function merge(videoPath, audioPath, outputPath, options = {}) {
  const toolName = options.tool || null;
  const customPath = options.path || null;

  let tool;
  if (customPath) {
    tool = { cmd: customPath, label: customPath };
  } else {
    tool = await detectTool(toolName);
  }

  if (!tool) {
    throw new MergeError(
      'No merge/conversion tool detected. Install FFmpeg (https://ffmpeg.org) or avconv. ' +
      'Alternatively, use { merge: { path: "/path/to/ffmpeg" } } to specify a custom binary.'
    );
  }

  const { cmd, args } = buildArgs(tool, videoPath, audioPath, outputPath);

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new MergeError(`Merge failed (exit ${code}): ${stderr.slice(-300)}`));
    });
    proc.on('error', (err) => reject(new MergeError(`Failed to start ${cmd}: ${err.message}`)));
  });
}

async function checkAvailable(toolName) {
  const tool = await detectTool(toolName);
  return !!tool;
}

module.exports = {
  merge,
  detectTool,
  checkAvailable,
  TOOLS,
};
