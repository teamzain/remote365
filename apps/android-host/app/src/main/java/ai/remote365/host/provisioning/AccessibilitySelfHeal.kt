package ai.remote365.host.provisioning

import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings
import android.text.TextUtils
import android.util.Log

/**
 * Re-arms the input service after an app update.
 *
 * Installing over an existing APK REMOVES the app's service from
 * `enabled_accessibility_services`. Without this, every OTA silently kills remote input on
 * every device in the fleet until a human re-enables it by hand — the failure is invisible
 * because capture and video keep working perfectly.
 *
 * The Tier A wizard grants WRITE_SECURE_SETTINGS over ADB alongside PROJECT_MEDIA, which is
 * what lets the app repair itself here. Without that grant this is a no-op and the setup
 * screen has to ask the user instead.
 */
object AccessibilitySelfHeal {

    private const val TAG = "A11ySelfHeal"
    private const val SERVICE_CLASS = "ai.remote365.host.input.HostAccessibilityService"

    fun canSelfHeal(context: Context): Boolean =
        context.checkSelfPermission(android.Manifest.permission.WRITE_SECURE_SETTINGS) ==
            PackageManager.PERMISSION_GRANTED

    /**
     * @return true if the service is enabled after this call (either already was, or we
     *         successfully re-enabled it).
     */
    fun ensureEnabled(context: Context): Boolean {
        val component = "${context.packageName}/$SERVICE_CLASS"
        if (isListed(context, component)) return true

        if (!canSelfHeal(context)) {
            Log.w(TAG, "input service disabled and WRITE_SECURE_SETTINGS not held")
            return false
        }

        return runCatching {
            val current = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            ).orEmpty()
            // Rebuild from a de-duplicated set: BootReceiver and HostService can both repair
            // at once after an update, and two concurrent appends would list us twice.
            val next = (
                current.split(':').filter { it.isNotBlank() && !it.equals(component, true) } +
                    component
                ).joinToString(":")
            Settings.Secure.putString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
                next,
            )
            // Without this the list is set but the framework never binds anything.
            Settings.Secure.putInt(context.contentResolver, "accessibility_enabled", 1)
            Log.i(TAG, "re-enabled input service after update")
            true
        }.getOrElse {
            Log.e(TAG, "failed to re-enable input service", it)
            false
        }
    }

    private fun isListed(context: Context, component: String): Boolean {
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        return splitter.any { it.equals(component, ignoreCase = true) }
    }
}
