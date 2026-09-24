package ai.remote365.host.rtc

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Looper
import android.util.Log
import android.view.Surface
import org.webrtc.CapturerObserver
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoFrame
import org.webrtc.VideoSink
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Screen capturer that OWNS its [MediaProjection] and exposes it.
 *
 * Functionally the same as libwebrtc's `ScreenCapturerAndroid` (virtual display -> SurfaceTexture
 * -> VideoSource), which keeps its projection private. We need the object itself because the
 * single-use capture token yields exactly one MediaProjection, and that one projection must
 * also back the `AudioPlaybackCaptureConfiguration` that streams the phone's app/media audio
 * (see [HostAudio]). Calling `getMediaProjection` a second time with the same result Intent is
 * refused on Android 14+, so sharing the instance is the only way to get video AND audio from
 * one silent Tier A grant.
 */
class ProjectionCapturer(
    private val permissionData: Intent,
    private val projectionCallback: MediaProjection.Callback,
) : VideoCapturer, VideoSink {

    private var width = 0
    private var height = 0
    private var virtualDisplay: VirtualDisplay? = null
    private var helper: SurfaceTextureHelper? = null
    private var observer: CapturerObserver? = null
    private var manager: MediaProjectionManager? = null
    private var disposed = false

    /** Live only between [startCapture] and [stopCapture]. */
    @Volatile
    var mediaProjection: MediaProjection? = null
        private set

    override fun initialize(
        surfaceTextureHelper: SurfaceTextureHelper,
        applicationContext: Context,
        capturerObserver: CapturerObserver,
    ) {
        helper = surfaceTextureHelper
        observer = capturerObserver
        manager = applicationContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE)
            as MediaProjectionManager
    }

    @Synchronized
    override fun startCapture(width: Int, height: Int, ignoredFramerate: Int) {
        check(!disposed) { "capturer is disposed" }
        this.width = width
        this.height = height
        val projection = manager?.getMediaProjection(Activity.RESULT_OK, permissionData)
            ?: run {
                Log.e(TAG, "getMediaProjection returned null")
                observer?.onCapturerStarted(false)
                return
            }
        mediaProjection = projection
        // Android 14 requires a callback to be registered BEFORE createVirtualDisplay.
        projection.registerCallback(projectionCallback, helper?.handler)
        createVirtualDisplay()
        observer?.onCapturerStarted(true)
        helper?.startListening(this)
    }

    @Synchronized
    override fun stopCapture() {
        check(!disposed) { "capturer is disposed" }
        val h = helper ?: return
        runOnCaptureThread(h) {
            h.stopListening()
            observer?.onCapturerStopped()
            virtualDisplay?.release()
            virtualDisplay = null
            mediaProjection?.let { projection ->
                // Unregister first, or the stop we issue here re-enters our own onStop handler.
                projection.unregisterCallback(projectionCallback)
                projection.stop()
            }
            mediaProjection = null
        }
    }

    @Synchronized
    override fun changeCaptureFormat(width: Int, height: Int, ignoredFramerate: Int) {
        check(!disposed) { "capturer is disposed" }
        this.width = width
        this.height = height
        val h = helper ?: return
        if (virtualDisplay == null) return
        runOnCaptureThread(h) {
            virtualDisplay?.release()
            createVirtualDisplay()
        }
    }

    @Synchronized
    override fun dispose() {
        disposed = true
    }

    override fun isScreencast(): Boolean = true

    override fun onFrame(frame: VideoFrame) {
        observer?.onFrameCaptured(frame)
    }

    private fun createVirtualDisplay() {
        val h = helper ?: return
        h.setTextureSize(width, height)
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "Remote365_ScreenCapture",
            width,
            height,
            VIRTUAL_DISPLAY_DPI,
            DISPLAY_FLAGS,
            Surface(h.surfaceTexture),
            null,
            null,
        )
    }

    /**
     * Run [block] on the capture thread and wait for it (like libwebrtc's package-private
     * `ThreadUtils.invokeAtFrontOfUiThread`), so callers observe the display released before
     * they continue. Runs inline when already on that thread; bounded wait so a wedged handler
     * cannot hang the service.
     */
    private fun runOnCaptureThread(h: SurfaceTextureHelper, block: () -> Unit) {
        if (Looper.myLooper() == h.handler.looper) {
            block()
            return
        }
        val done = CountDownLatch(1)
        h.handler.postAtFrontOfQueue {
            try {
                block()
            } finally {
                done.countDown()
            }
        }
        if (!done.await(2, TimeUnit.SECONDS)) Log.w(TAG, "capture thread did not respond in time")
    }

    private companion object {
        const val TAG = "ProjectionCapturer"
        const val DISPLAY_FLAGS =
            DisplayManager.VIRTUAL_DISPLAY_FLAG_PUBLIC or DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION
        const val VIRTUAL_DISPLAY_DPI = 400
    }
}
