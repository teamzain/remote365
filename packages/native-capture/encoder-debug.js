const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

async function testEncoderSpeed() {
    console.log("Benchmarking Encoder ONLY (Synthetic Raw BGRA -> H264)...");
    
    const width = 1920; 
    const height = 1080;
    const dummyFrame = Buffer.alloc(width * height * 4);

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
    ffmpeg.stdout.on('data', (data) => {
        nalCount++;
    });

    ffmpeg.stderr.on('data', (data) => {
        // Log the first few lines of stderr to see it started
        if (framesPushed < 5) console.log(`FFmpeg Stderr: ${data}`);
    });

    console.log("Saturating encoder... (5 seconds)");
    const start = Date.now();
    let framesPushed = 0;

    const push = () => {
        if (Date.now() - start > 5000) {
            console.log("Closing stdin...");
            ffmpeg.stdin.end();
            return;
        }

        const canWrite = ffmpeg.stdin.write(dummyFrame);
        framesPushed++;
        
        if (canWrite) {
            setImmediate(push);
        } else {
            ffmpeg.stdin.once('drain', push);
        }
    };

    push();

    ffmpeg.on('close', (code) => {
        const duration = (Date.now() - start) / 1000;
        console.log(`\n--- Results ---`);
        console.log(`Frames Processed: ${framesPushed}`);
        console.log(`NALs Received: ${nalCount}`);
        console.log(`Encoder FPS: ${(framesPushed / duration).toFixed(2)}`);
        process.exit(0);
    });
}

testEncoderSpeed().catch(console.error);
