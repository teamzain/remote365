package ai.remote365.host.service

import ai.remote365.host.provisioning.AccessibilitySelfHeal
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Brings the host back online after a reboot AND after an app update.
 *
 * MY_PACKAGE_REPLACED matters as much as BOOT_COMPLETED: without it, every OTA update leaves
 * the device permanently offline until someone opens the app by hand.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> {
                Log.i(TAG, "restarting host after ${intent.action}")
                // Installing over an existing APK strips our service out of
                // enabled_accessibility_services, so remote input dies silently on every
                // update while video keeps working. Repair before the service comes up.
                AccessibilitySelfHeal.ensureEnabled(context)
                HostService.start(context)
            }
        }
    }

    private companion object {
        const val TAG = "BootReceiver"
    }
}
