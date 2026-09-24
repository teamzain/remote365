package ai.remote365.host.service

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.util.Log

/**
 * Invisible shim that obtains the MediaProjection token and hands it to [HostService].
 *
 * A token can only be obtained from an Activity result, never from a Service — so even on
 * Tier A this bounce is required. The difference is that with the PROJECT_MEDIA app-op
 * granted, MediaProjectionPermissionActivity skips the consent dialog entirely and this
 * activity finishes in a frame, invisibly. Without it, the user sees the system sheet.
 */
class ProjectionRequestActivity : Activity() {

    private var viewerId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewerId = intent.getStringExtra(HostService.EXTRA_VIEWER_ID)

        // This activity is briefly on-screen anyway, so use it to clear a NON-secure keyguard
        // (the swipe-only "AOD clock" lock the operator otherwise stares at). A secure PIN
        // keyguard is deliberately left up — the operator types the PIN through the pad.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val km = getSystemService(KeyguardManager::class.java)
            if (km?.isKeyguardLocked == true && km.isKeyguardSecure == false) {
                km.requestDismissKeyguard(this, null)
            }
        }

        val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        @Suppress("DEPRECATION")
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CODE)
    }

    @Deprecated("startActivityForResult is the only way to obtain a projection token")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_CODE) return

        if (resultCode == RESULT_OK && data != null) {
            val intent = Intent(this, HostService::class.java).apply {
                action = HostService.ACTION_PROJECTION_GRANTED
                putExtra(HostService.EXTRA_PROJECTION_INTENT, data)
                putExtra(HostService.EXTRA_VIEWER_ID, viewerId)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } else {
            Log.w(TAG, "projection denied (resultCode=$resultCode)")
        }
        finish()
        overridePendingTransition(0, 0)
    }

    companion object {
        private const val TAG = "ProjectionRequest"
        private const val REQUEST_CODE = 7001

        fun request(context: Context, viewerId: String) {
            val intent = Intent(context, ProjectionRequestActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
                putExtra(HostService.EXTRA_VIEWER_ID, viewerId)
            }
            context.startActivity(intent)
        }
    }
}
