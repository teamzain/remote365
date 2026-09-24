package ai.remote365.host.provisioning.selfpair

/**
 * The Tier A grant set, applied over the paired ADB shell. Mirrors [provision.ps1] and
 * UNATTENDED.md §3 — the wizard runs exactly what a technician's PC would run over USB, only
 * from the phone itself.
 */
class GrantSequence(
    private val pkg: String,
    private val exec: suspend (String) -> String,
) {

    data class Step(val label: String, val critical: Boolean, val ok: Boolean, val detail: String)

    data class Result(val steps: List<Step>) {
        /** True when every step the product cannot work without has succeeded. */
        val allCriticalOk: Boolean get() = steps.filter { it.critical }.all { it.ok }
        val failedCritical: List<Step> get() = steps.filter { it.critical && !it.ok }
    }

    suspend fun run(): Result {
        val a11y = "$pkg/ai.remote365.host.input.HostAccessibilityService"
        val ime = "$pkg/ai.remote365.host.input.HostImeService"
        val steps = mutableListOf<Step>()

        // 1. The core grant: silent screen capture with no consent dialog.
        steps += verify("Silent screen capture", critical = true) {
            exec("cmd appops set $pkg PROJECT_MEDIA allow")
            exec("cmd appops get $pkg PROJECT_MEDIA").contains("allow")
        }

        // 2. Lets the app re-arm its own accessibility service after every OTA update.
        steps += verify("Self-heal after updates", critical = false) {
            exec("pm grant $pkg android.permission.WRITE_SECURE_SETTINGS")
            true // pm grant emits nothing on success; proven indirectly by step 4 below
        }

        // 3. Quality-of-life grants — not fatal if a given OEM rejects one.
        exec("pm grant $pkg android.permission.POST_NOTIFICATIONS")
        exec("pm grant $pkg android.permission.RECORD_AUDIO")       // phone audio -> viewer
        exec("cmd appops set $pkg READ_CLIPBOARD allow")           // phone -> desktop clipboard
        exec("dumpsys deviceidle whitelist +$pkg")                 // never Dozed
        exec("ime enable $ime")                                    // headless type-anywhere keyboard

        // Android 15/16 Enhanced Confirmation Mode blocks the accessibility write for sideloaded
        // apps ("disallowed by device admin policy") unless this restricted-settings lock is
        // cleared first. Harmless on older versions. See UNATTENDED.md §3.
        exec("cmd appops set $pkg ACCESS_RESTRICTED_SETTINGS allow")

        // Android 15 "Screenshare Protection" blacks out sensitive surfaces during remote capture —
        // Developer options, Wireless debugging, password fields, notifications — so an operator sees
        // "App content hidden from screen share for security" instead of the screen. This is the exact
        // global behind Developer options > "Disable screen share protection"; clearing it lets the
        // operator see those screens. Only present on newer One UI 7 builds, harmless elsewhere.
        exec("settings put global disable_screen_share_protections_for_apps_and_notifications 1")

        // 4. Remote input via the accessibility service.
        steps += verify("Remote input", critical = true) {
            enableAccessibility(a11y)
            exec("settings put secure accessibility_enabled 1")
            exec("settings get secure enabled_accessibility_services").contains(pkg)
        }

        return Result(steps)
    }

    /**
     * Append our service to `enabled_accessibility_services` without clobbering others the user
     * already relies on (e.g. TalkBack) — a plain `put` would disable them.
     */
    private suspend fun enableAccessibility(component: String) {
        val current = exec("settings get secure enabled_accessibility_services").trim()
        val existing = current
            .takeIf { it.isNotEmpty() && it != "null" }
            ?.split(':')
            ?.filter { it.isNotBlank() && !it.equals(component, ignoreCase = true) }
            .orEmpty()
        val next = (existing + component).joinToString(":")
        exec("settings put secure enabled_accessibility_services $next")
    }

    private suspend fun verify(
        label: String,
        critical: Boolean,
        action: suspend () -> Boolean,
    ): Step = runCatching { action() }.fold(
        onSuccess = { Step(label, critical, it, if (it) "granted" else "not confirmed") },
        onFailure = { Step(label, critical, ok = false, detail = it.message ?: "failed") },
    )
}
