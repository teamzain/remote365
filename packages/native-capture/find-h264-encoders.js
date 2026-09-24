const ffmpegPath = require('ffmpeg-static');
const { execSync } = require('child_process');

try {
    const output = execSync(`"${ffmpegPath}" -encoders`).toString();
    console.log("--- Hardware Encoders ---");
    const keywords = ['nvenc', 'amf', 'qsv', 'mf'];
    console.log(output.split('\n').filter(l => keywords.some(k => l.includes(k))).join('\n'));
} catch (e) {
    console.error(e);
}
