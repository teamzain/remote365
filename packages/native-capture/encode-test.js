const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const capture = require('./build/Release/capture.node');
const { PassThrough } = require('stream');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

async function runBenchmark() {
    console.log("Starting H.264 Encoding benchmark (300 frames)...");
    
    // 1. Get dimensions from a test capture
    let firstFrame = null;
    while (!firstFrame) {
        firstFrame = capture.captureFrame();
    }
    const { width, height } = firstFrame;
    console.log(`Resolution: ${width}x${height}`);

    const inputStream = new PassThrough();
    const outputFile = 'test-output.mp4';
    
    // 2. Setup FFmpeg
    const ffCommand = ffmpeg(inputStream)
        .inputOptions([
            '-f', 'rawvideo',
            '-pixel_format', 'bgra',
            '-video_size', `${width}x${height}`,
            '-framerate', '60'
        ])
        .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-g', '60', // Keyframe every 60 frames
            '-pix_fmt', 'yuv420p' // Compatible with most players
        ])
        .output(outputFile)
        .on('start', (cmd) => console.log('FFmpeg started:', cmd))
        .on('error', (err) => console.error('FFmpeg error:', err))
        .on('end', () => console.log('\nFFmpeg finished processing.'));

    ffCommand.run();

    // 3. Capture and stream
    const numFrames = 300;
    const startOverall = performance.now();
    
    for (let i = 0; i < numFrames; i++) {
        let frame = null;
        while (!frame) {
            frame = capture.captureFrame();
        }
        
        // Measure only the pipe/write time for "sending" to encoder
        // Note: This isn't the total encoding time, but we'll get the overall average at the end
        inputStream.write(frame.data);
        
        if (i % 50 === 0) {
            process.stdout.write('.');
        }
    }

    inputStream.end();

    // Wait for FFmpeg to finish
    await new Promise((resolve) => ffCommand.on('end', resolve));
    
    const endOverall = performance.now();
    const totalDuration = endOverall - startOverall;
    const avgPerFrame = totalDuration / numFrames;
    const fps = 1000 / avgPerFrame;

    console.log("\n--- Encoding Results ---");
    console.log(`Total duration for 300 frames: ${totalDuration.toFixed(2)}ms`);
    console.log(`Average time per frame (Capture + Encode): ${avgPerFrame.toFixed(2)}ms`);
    console.log(`Throughput: ${fps.toFixed(2)} FPS`);
    console.log(`Output saved to: ${outputFile}`);
    
    if (fs.existsSync(outputFile)) {
        const stats = fs.statSync(outputFile);
        console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }
}

runBenchmark().catch(console.error);
