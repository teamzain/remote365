const capture = require('./build/Release/capture.node');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

async function testStreaming() {
    console.log("Starting Stream Test (Capture -> FFmpeg -> NAL chunks)...");
    
    // Get a sample frame to determine resolution
    let firstFrame = null;
    while (!firstFrame) {
        firstFrame = capture.captureFrame();
    }
    const { width, height } = firstFrame;
    console.log(`Detected resolution: ${width}x${height}`);

    // Spawn FFmpeg to encode BGRA to H264 on the fly
    const ffmpeg = spawn(ffmpegPath, [
        '-f', 'rawvideo',
        '-pixel_format', 'bgra',
        '-video_size', `${width}x${height}`,
        '-i', '-', // Input from stdin
        '-c:v', 'h264_qsv', // Use Intel Quick Sync
        '-preset', 'fast', // 'fast' is a reliable QSV preset
        '-tune', 'low_delay', // QSV specific tune
        '-g', '60', 
        '-f', 'h264',
        '-'
    ]);

    let nalCount = 0;
    let totalBytes = 0;

    ffmpeg.stdout.on('data', (chunk) => {
        nalCount++;
        totalBytes += chunk.length;
        if (nalCount % 100 === 0) {
            console.log(`Encoded ${nalCount} NAL chunks... Total size: ${(totalBytes / 1024).toFixed(2)} KB`);
        }
    });

    ffmpeg.stderr.on('data', (data) => {
        console.log(`FFmpeg Stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
    });

    console.log("Pushing frames... (5 seconds)");
    const start = Date.now();
    let framesPushed = 0;
    let isDraining = false;

    const pushLoop = () => {
        if (Date.now() - start > 5000) {
            console.log("Stopping stream...");
            ffmpeg.stdin.end();
            return;
        }

        if (isDraining) return; // Wait for drain event

        const frame = capture.captureFrame();
        if (frame && frame.data) {
            const canWrite = ffmpeg.stdin.write(frame.data);
            framesPushed++;
            
            if (!canWrite) {
                isDraining = true;
                ffmpeg.stdin.once('drain', () => {
                    isDraining = false;
                    pushLoop();
                });
                return;
            }
        }
        
        // We use setImmediate to give other IO a chance
        setImmediate(pushLoop);
    };

    pushLoop();

    ffmpeg.on('exit', () => {
        console.log(`\n--- Results ---`);
        console.log(`Frames Pushed: ${framesPushed}`);
        console.log(`Avg FPS: ${(framesPushed / 5).toFixed(2)}`);
        console.log(`NAL Chunks Received: ${nalCount}`);
        console.log(`Total H264 Size: ${(totalBytes / 1024).toFixed(2)} KB`);
        console.log(`Avg chunk size: ${(totalBytes / nalCount).toFixed(2)} bytes`);
        process.exit(0);
    });
}

testStreaming().catch(console.error);
