import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("org.jetbrains.kotlin.plugin.compose")
}

val releaseSigningProperties = listOf(
    "REMOTE365_RELEASE_STORE_FILE",
    "REMOTE365_RELEASE_STORE_PASSWORD",
    "REMOTE365_RELEASE_KEY_ALIAS",
    "REMOTE365_RELEASE_KEY_PASSWORD",
)
val hasReleaseSigning = releaseSigningProperties.all(project::hasProperty)

android {
    namespace = "ai.remote365.host"
    compileSdk = 36

    defaultConfig {
        applicationId = "ai.remote365.host"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "1.0.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // Optional local test build; normal builds continue to include every upstream ABI.
        providers.gradleProperty("remote365.testAbi").orNull?.let { abi ->
            require(abi in listOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64"))
            ndk { abiFilters += abi }
        }
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigning) {
                storeFile = file(project.property("REMOTE365_RELEASE_STORE_FILE") as String)
                storePassword = project.property("REMOTE365_RELEASE_STORE_PASSWORD") as String
                keyAlias = project.property("REMOTE365_RELEASE_KEY_ALIAS") as String
                keyPassword = project.property("REMOTE365_RELEASE_KEY_PASSWORD") as String
            }
        }
    }

    buildTypes {
        debug {
            // Mobile defaults to preprod, unlike the desktop app which defaults to prod.
            buildConfigField("String", "API_BASE_URL", "\"https://pp.remote365.ai\"")
            buildConfigField("String", "SIGNALING_URL", "\"wss://pp.remote365.ai/api/signal\"")
        }
        release {
            isMinifyEnabled = false
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            buildConfigField("String", "API_BASE_URL", "\"https://remote365.ai\"")
            buildConfigField("String", "SIGNALING_URL", "\"wss://remote365.ai/api/signal\"")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        create("preprodRelease") {
            initWith(getByName("release"))
            matchingFallbacks += listOf("release")
            buildConfigField("String", "API_BASE_URL", "\"https://pp.remote365.ai\"")
            buildConfigField("String", "SIGNALING_URL", "\"wss://pp.remote365.ai/api/signal\"")
        }
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets.getByName("main") {
        java.srcDir("../callaudio-protocol")
        // Build the privileged helper from reviewed sources; do not package the old hand-built DEX.
        assets.setSrcDirs(listOf(layout.buildDirectory.dir("generated/callAudio/assets")))
    }
}

val compileCallAudioHelper by tasks.registering(JavaCompile::class) {
    source(fileTree("../callaudio-helper") { include("*.java") })
    source(fileTree("../callaudio-protocol") { include("*.java") })
    classpath = files(android.bootClasspath)
    destinationDirectory.set(layout.buildDirectory.dir("generated/callAudio/classes"))
    sourceCompatibility = "1.8"
    targetCompatibility = "1.8"
}
val callAudioHelperJar by tasks.registering(Jar::class) {
    from(compileCallAudioHelper.flatMap { it.destinationDirectory })
    archiveFileName.set("callaudio.jar")
    destinationDirectory.set(layout.buildDirectory.dir("generated/callAudio"))
}
val dexCallAudioHelper by tasks.registering(JavaExec::class) {
    dependsOn(callAudioHelperJar)
    classpath = files("${android.sdkDirectory}/build-tools/${android.buildToolsVersion}/lib/d8.jar")
    mainClass.set("com.android.tools.r8.D8")
    val dexDir = layout.buildDirectory.dir("generated/callAudio/dex")
    val assetsDir = layout.buildDirectory.dir("generated/callAudio/assets")
    inputs.file(callAudioHelperJar.flatMap { it.archiveFile })
    outputs.dir(assetsDir)
    doFirst {
        dexDir.get().asFile.mkdirs()
        setArgs(listOf("--min-api", "26", "--lib", android.bootClasspath.first().absolutePath,
            "--output", dexDir.get().asFile.absolutePath,
            callAudioHelperJar.get().archiveFile.get().asFile.absolutePath))
    }
    doLast {
        assetsDir.get().asFile.mkdirs()
        dexDir.get().file("classes.dex").asFile.copyTo(assetsDir.get().file("callaudio.dex").asFile, overwrite = true)
    }
}
tasks.named("preBuild") { dependsOn(dexCallAudioHelper) }

// Keep the native library and all other WebRTC classes unchanged. Replace only the Java mic
// adapter with our explicitly supplied PCM adapter, preserving the 1.3.8 JNI signatures.
val upstreamWebRtc by configurations.creating { isTransitive = false }
val pcmWebRtcAar = layout.buildDirectory.file("generated/webrtc/remote365-webrtc-1.3.8.aar")
val preparePcmWebRtc by tasks.registering {
    inputs.files(upstreamWebRtc)
    outputs.file(pcmWebRtcAar)
    doLast {
        val target = pcmWebRtcAar.get().asFile
        target.parentFile.mkdirs()
        var removed = 0
        ZipInputStream(upstreamWebRtc.singleFile.inputStream()).use { input ->
            ZipOutputStream(target.outputStream()).use { output ->
                while (true) {
                    val entry = input.nextEntry ?: break
                    output.putNextEntry(ZipEntry(entry.name).apply { time = 0 })
                    if (entry.name == "classes.jar") {
                        val jarBytes = ByteArrayOutputStream()
                        ZipInputStream(ByteArrayInputStream(input.readBytes())).use { jarInput ->
                            ZipOutputStream(jarBytes).use { jarOutput ->
                                while (true) {
                                    val cls = jarInput.nextEntry ?: break
                                    if (cls.name == "org/webrtc/audio/WebRtcAudioRecord.class" ||
                                        cls.name.startsWith("org/webrtc/audio/WebRtcAudioRecord\$")) {
                                        removed++
                                    } else {
                                        jarOutput.putNextEntry(ZipEntry(cls.name).apply { time = 0 })
                                        jarInput.copyTo(jarOutput)
                                        jarOutput.closeEntry()
                                    }
                                }
                            }
                        }
                        output.write(jarBytes.toByteArray())
                    } else input.copyTo(output)
                    output.closeEntry()
                }
            }
        }
        check(removed > 0) { "Pinned WebRTC input class missing; review adapter compatibility" }
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Compose UI (setup wizard + status screen only — this app is mostly service code)
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")

    // WebRTC — maintained fork of the official Google builds
    upstreamWebRtc("io.getstream:stream-webrtc-android:1.3.8@aar")
    implementation(files(pcmWebRtcAar).builtBy(preparePcmWebRtc))

    // Signaling + REST
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Self-Pair: in-app ADB client that pairs to the phone's OWN wireless-debugging daemon over
    // loopback and applies the Tier A grants — no PC. libadb-android bundles the SPAKE2 pairing +
    // ADB/TLS transport; Conscrypt provides TLS 1.3 on older devices; Bouncy Castle generates the
    // stable self-signed cert adbd trusts (avoids the version-fragile sun.security.x509 path).
    implementation("com.github.MuntashirAkon:libadb-android:3.1.1")
    implementation("org.conscrypt:conscrypt-android:2.5.3")
    // Match the bcprov variant/version libadb-android already pulls (jdk15to18:1.81) — mixing in
    // the jdk18on variant collides on org.bouncycastle.* duplicate classes at build time.
    implementation("org.bouncycastle:bcpkix-jdk15to18:1.81")
}
