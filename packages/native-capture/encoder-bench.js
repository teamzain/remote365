const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

async function testEncoderSpeed() {
    console.log("Benchmarking Encoder ONLY (Synthetic Raw BGRA -> H264)...");
    
    const width = 1920;
    const height = 1080;
    const dummyFrame = Buffer.alloc(width * height * 4); // 1080p BGRA is ~8MB

    const ffmpeg = spawn(ffmpegPath, [
        '-f', 'rawvideo',
        '-pixel_format', 'bgra',
        '-video_size', `${width}x${height}`,
        '-i', '-', 
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-f', 'h264',
        '-'
    ]);

    let nalCount = 0;
    ffmpeg.stdout.on('data', () => nalCount++);

    console.log("Saturating encoder... (5 seconds)");
    const start = Date.now();
    let framesPushed = 0;

    const push = () => {
        if (Date.now() - start > 5000) {
            ffmpeg.stdin.end();
            return;
        }

        // Only push if stdin can take more (handles backpressure)
        if (ffmpeg.stdin.write(dummyFrame)) {
            framesPushed++;
            setImmediate(push);
        } else {
            ffmpeg.stdin.once('drain', push);
        }
    };

    push();

    ffmpeg.on('exit', () => {
        const duration = (Date.now() - start) / 1000;
        console.log(`\n--- Results ---`);
        console.log(`Frames Processed: ${framesPushed}`);
        console.log(`Encoder FPS: ${(framesPushed / duration).toFixed(2)}`);
        process.exit(0);
    });
}

testEncoderSpeed().catch(console.error);
