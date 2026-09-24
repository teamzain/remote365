const ffmpegPath = require('ffmpeg-static');
const { execSync } = require('child_process');

try {
    const output = execSync(`"${ffmpegPath}" -encoders`).toString();
    console.log(output);
} catch (e) {
    console.error(e);
}
