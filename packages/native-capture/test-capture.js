const capture = require('./build/Release/capture.node');

async function test() {
    console.log("Starting DXGI Capture benchmark (60 frames)...");
    
    const frames = 60;
    const times = [];
    
    // Warm up
    capture.captureFrame();

    for (let i = 0; i < frames; i++) {
        const start = performance.now();
        let frame = null;
        
        // Loop until we actually get a frame (DXGI might timeout if screen is static)
        while (!frame) {
            frame = capture.captureFrame();
        }
        
        const end = performance.now();
        times.push(end - start);
        
        if (i % 10 === 0 || i === frames - 1) {
            console.log(`Frame ${i + 1}: ${frame.width}x${frame.height}, Buffer size: ${frame.data.length} bytes`);
        }
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / frames;
    const fps = 1000 / avg;
    
    console.log("\n--- Results ---");
    console.log(`Average time per frame: ${avg.toFixed(2)}ms`);
    console.log(`Estimated FPS: ${fps.toFixed(2)}`);
    
    if (fps >= 55) {
        console.log("✅ Performance targets met (near 60fps)");
    } else {
        console.warn("⚠️ Performance below 60fps target. This might be due to staging texture overhead or monitor refresh rate.");
    }
}

test().catch(console.error);
