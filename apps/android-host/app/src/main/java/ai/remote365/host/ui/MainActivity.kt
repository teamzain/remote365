package ai.remote365.host.ui

import ai.remote365.host.BuildConfig
import ai.remote365.host.provisioning.selfpair.SelfPairController
import ai.remote365.host.service.HostService
import ai.remote365.host.service.ProjectionRequestActivity
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density

/**
 * Setup wizard and status screen. Deliberately thin — the product lives in [HostService].
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        HostService.start(this)

        // Debug-only: drive the whole Self-Pair flow from one adb command, bypassing the wizard UI
        // (which is impractical to automate over adb). Logs each phase under the "SelfPair" tag.
        //   adb shell am start -n ai.remote365.host/.ui.MainActivity \
        //     --es selftest_pair_code 123456 --es selftest_pair_port 40073 [--es selftest_pair_host 127.0.0.1]
        if (BuildConfig.DEBUG) intent.getStringExtra("selftest_pair_code")?.let { code ->
            val host = intent.getStringExtra("selftest_pair_host") ?: "127.0.0.1"
            val port = intent.getStringExtra("selftest_pair_port")?.toIntOrNull() ?: 0
            android.util.Log.i("SelfPair", "selftest trigger: code=$code host=$host port=$port")
            SelfPairController.get(this).submitCode(code, null, host, port)
        }

        // Debug-only capture self-test: verifies the Tier A grant really does suppress the
        // consent dialog, without needing a viewer on the other end.
        //   adb shell am start -n ai.remote365.host/.ui.MainActivity --ez selftest_projection true
        if (BuildConfig.DEBUG && intent.getBooleanExtra("selftest_projection", false)) {
            ProjectionRequestActivity.request(this, SELF_TEST_VIEWER)
        }

        // Debug-only gesture check: dispatches a tap at the given normalised coords so the
        // dispatch path can be verified without a viewer attached.
        //   adb shell am start -n ai.remote365.host/.ui.MainActivity \
        //     --ez selftest_tap true --es tap_x 0.5 --es tap_y 0.5
        // Debug-only: injects each character of a string as a keystroke into whatever field
        // currently has focus, so text-injection can be diagnosed against a real app.
        //   adb shell am start -n ai.remote365.host/.ui.MainActivity --es selftest_type "5+5"
        if (BuildConfig.DEBUG) intent.getStringExtra("selftest_type")?.let { toType ->
            window.decorView.postDelayed({
                val svc = ai.remote365.host.input.HostAccessibilityService.instance
                android.util.Log.i("SelfTest", "typing '$toType' service=${svc != null}")
                toType.forEach { svc?.pressKey(it.toString(), 0, false) }
            }, 800)
        }

        if (BuildConfig.DEBUG && intent.getBooleanExtra("selftest_tap", false)) {
            val tx = intent.getStringExtra("tap_x")?.toFloatOrNull() ?: 0.5f
            val ty = intent.getStringExtra("tap_y")?.toFloatOrNull() ?: 0.5f
            // Optional hold duration (ms) to exercise the long-press path — e.g. --es tap_ms 700.
            val tapMs = intent.getStringExtra("tap_ms")?.toLongOrNull()
            window.decorView.postDelayed({
                val svc = ai.remote365.host.input.HostAccessibilityService.instance
                android.util.Log.i("SelfTest", "dispatching tap at $tx,$ty ms=$tapMs service=${svc != null}")
                if (tapMs != null) svc?.tap(tx, ty, tapMs) else svc?.tap(tx, ty)
            }, 1_500)
        }

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Color.White) {
                    // Pin fontScale = 1.0 so the design renders identically regardless of the
                    // user's system font-size setting — same guarantee as the splash/onboarding.
                    val base = LocalDensity.current
                    CompositionLocalProvider(
                        LocalDensity provides Density(density = base.density, fontScale = 1f),
                    ) {
                        // HostAccessScreen reads its own identity and polls for the credentials,
                        // which land a moment after launch once registration completes.
                        HostAccessScreen()
                    }
                }
            }
        }
    }
}

private const val SELF_TEST_VIEWER = "__selftest__"
