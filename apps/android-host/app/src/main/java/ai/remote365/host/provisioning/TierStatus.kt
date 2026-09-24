package ai.remote365.host.provisioning

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.text.TextUtils

/**
 * Which provisioning tier this device is actually on right now.
 *
 * The UI must show this honestly — "unattended" is a promise the OS only keeps when the
 * PROJECT_MEDIA app-op has been granted.
 */
enum class Tier {
    /** ADB grant present: capture starts silently, no dialog, survives reboot. */
    A_UNATTENDED,

    /** OEM enterprise hook (Knox/Zebra) under an EMM. Detected separately. */
    B_MANAGED,

    /** No grant: every session needs a human to tap the consent dialog. */
    C_ATTENDED,
}

data class ProvisioningState(
    val tier: Tier,
    val projectMediaGranted: Boolean,
    val accessibilityEnabled: Boolean,
    val batteryUnrestricted: Boolean,
) {
    /** True only when a session can begin with nobody touching the phone. */
    val isFullyUnattended: Boolean
        get() = projectMediaGranted && accessibilityEnabled && batteryUnrestricted
}

object ProvisioningInspector {

    fun inspect(context: Context): ProvisioningState {
        val projectMedia = hasProjectMediaOp(context)
        val state = ProvisioningState(
            tier = if (projectMedia) Tier.A_UNATTENDED else Tier.C_ATTENDED,
            projectMediaGranted = projectMedia,
            accessibilityEnabled = isAccessibilityEnabled(context),
            batteryUnrestricted = isBatteryUnrestricted(context),
        )
        return state
    }

    /**
     * Mirrors the AOSP check in MediaProjectionManagerService.hasProjectionPermission():
     * when OP_PROJECT_MEDIA is allowed, MediaProjectionPermissionActivity skips the dialog.
     *
     * Granted by the Tier A wizard via: appops set <pkg> PROJECT_MEDIA allow
     */
    private fun hasProjectMediaOp(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
            ?: return false
        val uid = android.os.Process.myUid()
        val pkg = context.packageName
        return runCatching {
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(OP_PROJECT_MEDIA, uid, pkg)
            } else {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(OP_PROJECT_MEDIA, uid, pkg)
            }
            mode == AppOpsManager.MODE_ALLOWED
        }.getOrDefault(false)
    }

    /** Whether Developer options is unlocked — readable without any permission. */
    fun isDeveloperOptionsEnabled(context: Context): Boolean = runCatching {
        Settings.Global.getInt(context.contentResolver, "development_settings_enabled", 0) == 1
    }.getOrDefault(false)

    /** Whether Wireless debugging is currently on — readable without any permission. */
    fun isWirelessDebuggingEnabled(context: Context): Boolean = runCatching {
        Settings.Global.getInt(context.contentResolver, "adb_wifi_enabled", 0) == 1
    }.getOrDefault(false)

    fun isAccessibilityEnabled(context: Context): Boolean {
        val expected = "${context.packageName}/${ACCESSIBILITY_SERVICE_CLASS}"
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        return splitter.any { it.equals(expected, ignoreCase = true) }
    }

    private fun isBatteryUnrestricted(context: Context): Boolean {
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            ?: return false
        return power.isIgnoringBatteryOptimizations(context.packageName)
    }

    /**
     * AppOpsManager.OPSTR_PROJECT_MEDIA is @hide, so the literal is used. It has been stable
     * since the op was introduced; verify against AOSP if a future release misbehaves.
     */
    private const val OP_PROJECT_MEDIA = "android:project_media"
    private const val ACCESSIBILITY_SERVICE_CLASS =
        "ai.remote365.host.input.HostAccessibilityService"
}
