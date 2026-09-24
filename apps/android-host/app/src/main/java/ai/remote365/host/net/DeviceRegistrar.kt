package ai.remote365.host.net

import ai.remote365.host.BuildConfig
import android.content.Context
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.SecureRandom

/**
 * Bootstraps this device into the fleet via POST /api/devices/self-register.
 *
 * Idempotent and safe to call on every start — the server keys off the fingerprint, so the
 * device keeps the same 9-digit access key across reinstall and factory reset.
 */
class DeviceRegistrar(private val identity: HostIdentity) {

    data class Result(
        val accessKey: String,
        val name: String,
        val hasPassword: Boolean,
        val autoPassword: String?,
    )

    private val json = Json { ignoreUnknownKeys = true }
    private val http = OkHttpClient()

    suspend fun register(context: Context, displayName: String? = null): kotlin.Result<Result> =
        withContext(Dispatchers.IO) {
            runCatching {
                // Keyed on the stored password, not a "first run" flag: if we somehow have no
                // password on record, nobody can add this device, so resending one is the only
                // way back. Self-healing beats a device that is permanently unaddable.
                val newPassword = if (identity.accessPassword == null) newPassword() else null
                val body = buildJsonObject {
                    identity.accessKey?.let { put("accessKey", it) }
                    put("name", displayName ?: "${Build.MANUFACTURER} ${Build.MODEL}")
                    put("deviceType", "ANDROID")
                    put("fingerprint", identity.fingerprint(context))
                    // ANDROID rows are rejected with 400 without a hostSecret.
                    put("hostSecret", identity.hostSecret())
                    // Resending rotates the server hash and wipes every trustedDevice row,
                    // silently cutting off everyone already paired — so only when recovering.
                    newPassword?.let {
                        put("password", it)
                        put("passwordRequired", true)
                    }
                }

                val request = Request.Builder()
                    .url("${BuildConfig.API_BASE_URL}/api/devices/self-register")
                    .post(body.toString().toRequestBody(JSON_MEDIA))
                    .build()

                http.newCall(request).execute().use { response ->
                    val text = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        // 403 here means the hostSecret no longer matches the stored row —
                        // unrecoverable without server-side intervention.
                        error("self-register failed ${response.code}: $text")
                    }
                    val obj = json.parseToJsonElement(text) as JsonObject
                    val accessKey = obj.string("access_key")
                        ?: error("self-register response missing access_key")

                    identity.accessKey = accessKey
                    identity.hasRegisteredOnce = true

                    // The server may mint its own password instead of taking ours; prefer
                    // whatever it echoes back, or the operator will be shown the wrong one.
                    val serverPassword = obj.string("auto_password")
                    (serverPassword ?: newPassword)?.let { identity.accessPassword = it }
                    obj.bool("password_required")?.let { identity.passwordRequired = it }

                    Result(
                        accessKey = accessKey,
                        name = obj.string("name").orEmpty(),
                        hasPassword = (obj["has_password"] as? JsonPrimitive)
                            ?.content?.toBoolean() ?: false,
                        autoPassword = serverPassword,
                    )
                }
            }
        }

    /**
     * Apply an owner-initiated access change to the already-registered device: set a new password
     * and/or flip whether a password is required ("easy grant"). Unlike [register], this always
     * sends what the caller asks for.
     *
     *  - A new [newPassword] rotates the server hash and drops every trusted viewer, so previously
     *    paired operators must re-enter it — exactly what changing a password should mean.
     *  - [passwordRequired] = false lets anyone with the ID connect without the password; true
     *    restores the requirement against the password already on file.
     *
     * On success the new values are persisted locally so the UI reflects them immediately.
     */
    suspend fun applySettings(
        context: Context,
        newPassword: String? = null,
        passwordRequired: Boolean? = null,
    ): kotlin.Result<Result> = withContext(Dispatchers.IO) {
        runCatching {
            val accessKey = identity.accessKey
                ?: error("device not registered yet")
            val body = buildJsonObject {
                put("accessKey", accessKey)
                put("name", "${Build.MANUFACTURER} ${Build.MODEL}")
                put("deviceType", "ANDROID")
                put("fingerprint", identity.fingerprint(context))
                put("hostSecret", identity.hostSecret())
                newPassword?.let { put("password", it) }
                passwordRequired?.let { put("passwordRequired", it) }
            }

            val request = Request.Builder()
                .url("${BuildConfig.API_BASE_URL}/api/devices/self-register")
                .post(body.toString().toRequestBody(JSON_MEDIA))
                .build()

            http.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (!response.isSuccessful) error("update failed ${response.code}: $text")
                val obj = json.parseToJsonElement(text) as JsonObject

                newPassword?.let { identity.accessPassword = it }
                val serverRequired = obj.bool("password_required")
                serverRequired?.let { identity.passwordRequired = it }
                    ?: passwordRequired?.let { identity.passwordRequired = it }

                Result(
                    accessKey = obj.string("access_key") ?: accessKey,
                    name = obj.string("name").orEmpty(),
                    hasPassword = obj.bool("has_password") ?: false,
                    autoPassword = obj.string("auto_password"),
                )
            }
        }
    }

    private fun JsonObject.string(key: String): String? =
        (this[key] as? JsonPrimitive)?.takeIf { it !is kotlinx.serialization.json.JsonNull }?.content

    private fun JsonObject.bool(key: String): Boolean? =
        (this[key] as? JsonPrimitive)?.takeIf { it !is kotlinx.serialization.json.JsonNull }?.content?.toBooleanStrictOrNull()

    companion object {
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

        /** Human-friendly random password (no ambiguous chars), same shape the server mints. */
        fun newPassword(): String {
            val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
            val rng = SecureRandom()
            return (1..12).map { alphabet[rng.nextInt(alphabet.length)] }.joinToString("")
        }
    }
}
