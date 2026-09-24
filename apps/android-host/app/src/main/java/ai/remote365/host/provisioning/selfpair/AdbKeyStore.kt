package ai.remote365.host.provisioning.selfpair

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.bouncycastle.asn1.x500.X500Name
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder
import java.math.BigInteger
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.cert.Certificate
import java.security.cert.CertificateFactory
import java.security.spec.PKCS8EncodedKeySpec
import java.util.Date

/** The RSA key + self-signed certificate this device presents to `adbd` during Self-Pair. */
data class AdbIdentity(val privateKey: PrivateKey, val certificate: Certificate)

/**
 * Durable ADB identity for Self-Pair.
 *
 * `adbd` remembers the **public key** we present at pairing time and trusts it on every later
 * connection — so this keypair must be generated once and never change. Regenerating it would
 * invalidate the pairing and force the user through the wireless-debugging steps again, which is
 * exactly the one-time cost we are trying not to repeat.
 *
 * The certificate is built with Bouncy Castle rather than `sun.security.x509` because the latter's
 * API shifts between Android versions; libadb-android only needs a valid PrivateKey + Certificate.
 */
class AdbKeyStore private constructor(private val prefs: android.content.SharedPreferences) {

    fun loadOrCreate(): AdbIdentity = load() ?: generate().also(::save)

    private fun load(): AdbIdentity? {
        val keyB64 = prefs.getString(KEY_PRIVATE, null) ?: return null
        val certB64 = prefs.getString(KEY_CERT, null) ?: return null
        return runCatching {
            val privateKey = KeyFactory.getInstance("RSA")
                .generatePrivate(PKCS8EncodedKeySpec(Base64.decode(keyB64, Base64.NO_WRAP)))
            val certificate = CertificateFactory.getInstance("X.509")
                .generateCertificate(Base64.decode(certB64, Base64.NO_WRAP).inputStream())
            AdbIdentity(privateKey, certificate)
        }.getOrNull()
    }

    private fun save(identity: AdbIdentity) {
        prefs.edit()
            .putString(KEY_PRIVATE, Base64.encodeToString(identity.privateKey.encoded, Base64.NO_WRAP))
            .putString(KEY_CERT, Base64.encodeToString(identity.certificate.encoded, Base64.NO_WRAP))
            .apply()
    }

    private fun generate(): AdbIdentity {
        val keyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
        val provider = BouncyCastleProvider()
        val now = System.currentTimeMillis()
        val subject = X500Name("CN=Remote 365 Host")
        val builder = JcaX509v3CertificateBuilder(
            subject,
            BigInteger.valueOf(now),
            Date(now - 60_000L),
            Date(now + 20L * 365 * 24 * 60 * 60 * 1000), // ~20 years; adbd only checks it is valid now
            subject,
            keyPair.public,
        )
        val signer = JcaContentSignerBuilder("SHA256withRSA").setProvider(provider).build(keyPair.private)
        val certificate = JcaX509CertificateConverter().setProvider(provider)
            .getCertificate(builder.build(signer))
        return AdbIdentity(keyPair.private, certificate)
    }

    companion object {
        private const val PREFS = "remote365_adb_identity"
        private const val KEY_PRIVATE = "adb_private_key"
        private const val KEY_CERT = "adb_certificate"

        fun create(context: Context): AdbKeyStore {
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
            return AdbKeyStore(prefs)
        }
    }
}
