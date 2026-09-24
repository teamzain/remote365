package ai.remote365.host.net

import android.annotation.SuppressLint
import android.content.Context
import android.media.MediaDrm
import android.provider.Settings
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID

/**
 * Durable identity for this device.
 *
 * The backend derives the 9-digit access key from [fingerprint], so a device keeps the same
 * ID across reinstall and data wipe. [hostSecret] is the unattended credential: generated
 * once, never rotated — the server returns 403 "Invalid host credential" if it ever changes
 * for an existing ANDROID row.
 */
class HostIdentity private constructor(private val prefs: android.content.SharedPreferences) {

    /** SHA-256 hex, lowercase. Server validates /^[a-f0-9]{16,128}$/i. */
    fun fingerprint(context: Context): String = cached(KEY_FINGERPRINT) {
        val androidId = readAndroidId(context)
        val widevine = readWidevineId()
        sha256Hex("$androidId|$widevine")
    }

    /**
     * 32 random bytes, Base64 URL-safe, no padding. Server validates
     * /^[A-Za-z0-9_-]{43,128}$/. Generated once and persisted encrypted — regenerating it
     * locks this device out of its own registration.
     */
    fun hostSecret(): String = cached(KEY_HOST_SECRET) {
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    /** Set after the first successful self-register; sent on every later registration. */
    var accessKey: String?
        get() = prefs.getString(KEY_ACCESS_KEY, null)
        set(value) = prefs.edit().putString(KEY_ACCESS_KEY, value).apply()

    /**
     * The access password, in clear text, so the setup screen can show it to whoever is
     * standing at the phone — they cannot add the device without it.
     *
     * Storing it is deliberate: it lives in EncryptedSharedPreferences, and a password nobody
     * can read is the same as a bricked device.
     */
    var accessPassword: String?
        get() = prefs.getString(KEY_ACCESS_PASSWORD, null)
        set(value) = prefs.edit().putString(KEY_ACCESS_PASSWORD, value).apply()

    /**
     * The access password is only sent when we have none stored. Resending it rotates the
     * server-side hash and deletes every trustedDevice row, which silently cuts off everyone
     * who had already paired — so this must stay false once a password is known.
     */
    var hasRegisteredOnce: Boolean
        get() = prefs.getBoolean(KEY_REGISTERED, false)
        set(value) = prefs.edit().putBoolean(KEY_REGISTERED, value).apply()

    /**
     * Whether a viewer must supply the password to add this device. Mirrors the server's
     * `passwordRequired`; when false ("easy grant"), anyone with the ID can connect. Kept locally
     * so the setup screen renders the correct toggle state before the next registration round-trip.
     */
    var passwordRequired: Boolean
        get() = prefs.getBoolean(KEY_PASSWORD_REQUIRED, true)
        set(value) = prefs.edit().putBoolean(KEY_PASSWORD_REQUIRED, value).apply()

    private inline fun cached(key: String, produce: () -> String): String =
        prefs.getString(key, null) ?: produce().also { prefs.edit().putString(key, it).apply() }

    @SuppressLint("HardwareIds")
    private fun readAndroidId(context: Context): String =
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: UUID.randomUUID().toString()

    /** Survives factory reset on most devices, which is why it is mixed in. */
    private fun readWidevineId(): String = runCatching {
        val drm = MediaDrm(WIDEVINE_UUID)
        try {
            val id = drm.getPropertyByteArray(MediaDrm.PROPERTY_DEVICE_UNIQUE_ID)
            id.joinToString("") { "%02x".format(it) }
        } finally {
            drm.close()
        }
    }.getOrDefault("")

    private fun sha256Hex(input: String): String =
        MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
            .joinToString("") { "%02x".format(it) }

    companion object {
        private const val PREFS = "remote365_host_identity"
        private const val KEY_FINGERPRINT = "fingerprint"
        private const val KEY_HOST_SECRET = "host_secret"
        private const val KEY_ACCESS_KEY = "access_key"
        private const val KEY_REGISTERED = "registered_once"
        private const val KEY_ACCESS_PASSWORD = "access_password"
        private const val KEY_PASSWORD_REQUIRED = "password_required"
        private val WIDEVINE_UUID = UUID(-0x121074568629b532L, -0x5c37d8232ae2de13L)

        fun create(context: Context): HostIdentity {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            val prefs = EncryptedSharedPreferences.create(
                context,
                PREFS,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
            return HostIdentity(prefs)
        }
    }
}
