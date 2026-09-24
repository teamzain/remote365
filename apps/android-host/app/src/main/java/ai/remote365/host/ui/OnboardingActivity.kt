package ai.remote365.host.ui

import ai.remote365.host.net.HostIdentity
import ai.remote365.host.provisioning.ProvisioningInspector
import ai.remote365.host.provisioning.selfpair.SelfPairController
import ai.remote365.host.provisioning.selfpair.SelfPairState
import ai.remote365.host.service.HostService
import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * First-run onboarding. One screen per step, each auto-advancing the instant we detect it's done
 * (accessibility / developer-options / wireless-debugging are polled; pairing is watched). Reuses
 * [SelfPairController] for the pairing watch + screen-wake. Shown once — a device that's already
 * paired is routed straight to [MainActivity] by the splash, so this only runs during setup.
 *
 * Consistency across phones is engineered the same way as the splash: dp sizing, centre-anchored
 * content, and fontScale pinned to 1.0 so the system font-size setting can't reshape the layout.
 */
class OnboardingActivity : ComponentActivity() {

    private lateinit var controller: SelfPairController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        controller = SelfPairController.get(this)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Color.White) {
                    val base = LocalDensity.current
                    CompositionLocalProvider(
                        LocalDensity provides Density(density = base.density, fontScale = 1f),
                    ) {
                        OnboardingFlow(
                            controller = controller,
                            onFinish = {
                                startActivity(Intent(this, MainActivity::class.java))
                                finish()
                            },
                        )
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Arm the pairing watch from the lifecycle, not a composable. Once the user backgrounds into
        // Settings, Compose pauses recomposition, so the state flip that mounts the pairing screen
        // (and its LaunchedEffect) never fires while they're away — which left nothing watching the
        // dialog they'd just opened. Starting it here, the moment accessibility is on and we're not
        // yet paired, arms it while we're still foreground; it then runs on the singleton's scope.
        val inspected = ProvisioningInspector.inspect(this)
        if (inspected.accessibilityEnabled && !inspected.projectMediaGranted) {
            controller.ensureWatching()
        }
        if (inspected.projectMediaGranted) {
            // Paired — bring the host online so it registers and its ID/password land on the Host
            // Access screen. Onboarding never started the service before, so the final onboarding
            // screen showed blank credentials until the app was relaunched into MainActivity.
            HostService.start(this)
        }
    }

    // Deliberately NOT stopping the controller here — it's an app-lifetime singleton, and the watch
    // must keep running while this Activity is backgrounded (or destroyed) as the user pairs in Settings.
    // It stops itself on completion; an abandoned watch drops its screen lock on the 10-minute timeout.
}

private const val PREFS = "remote365_onboarding"
private const val KEY_WELCOME = "welcome_done"
private const val KEY_CONSENT = "consent_done"
private const val TOTAL_STEPS = 4

@Composable
private fun OnboardingFlow(controller: SelfPairController, onFinish: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }

    var welcomeDone by remember { mutableStateOf(prefs.getBoolean(KEY_WELCOME, false)) }
    var consentDone by remember { mutableStateOf(prefs.getBoolean(KEY_CONSENT, false)) }

    var accessibilityOn by remember { mutableStateOf(ProvisioningInspector.isAccessibilityEnabled(context)) }
    var developerOptionsOn by remember { mutableStateOf(ProvisioningInspector.isDeveloperOptionsEnabled(context)) }
    var wirelessDebuggingOn by remember { mutableStateOf(ProvisioningInspector.isWirelessDebuggingEnabled(context)) }
    var paired by remember { mutableStateOf(ProvisioningInspector.inspect(context).projectMediaGranted) }
    var congratsSeen by remember { mutableStateOf(false) }
    // Credentials for the final screen are read by HostAccessScreen itself; here we only track the
    // setup gates that decide which step to show.
    LaunchedEffect(Unit) {
        while (true) {
            delay(1_000)
            accessibilityOn = ProvisioningInspector.isAccessibilityEnabled(context)
            developerOptionsOn = ProvisioningInspector.isDeveloperOptionsEnabled(context)
            wirelessDebuggingOn = ProvisioningInspector.isWirelessDebuggingEnabled(context)
            paired = ProvisioningInspector.inspect(context).projectMediaGranted
        }
    }

    // Microphone is asked first (it gates phone audio to the viewer); notifications follow from
    // its result callback so the two system prompts never overlap.
    val notifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    val microphone = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    fun openSetting(action: String) = context.startActivity(Intent(action))

    when {
        !welcomeDone -> WelcomePage(onNext = {
            prefs.edit().putBoolean(KEY_WELCOME, true).apply()
            welcomeDone = true
        })

        !consentDone -> ConsentPage(onAgree = {
            prefs.edit().putBoolean(KEY_CONSENT, true).apply()
            consentDone = true
            microphone.launch(Manifest.permission.RECORD_AUDIO)
        })

        // Once paired, the setup prerequisites (accessibility / developer options / wireless
        // debugging) have served their purpose. The user can — and should — turn wireless debugging
        // back off afterwards, and toggling any prerequisite must NOT drag them back through setup.
        // Jump straight to the finish. Checked before the step gates for exactly this reason.
        paired && !congratsSeen -> CongratsPage(onContinue = { congratsSeen = true })
        paired -> HostAccessScreen()

        !accessibilityOn -> StepPage(
            step = 1,
            art = HeroArt.INPUT,
            title = "Turn on remote input",
            body = "Enable “Remote365 Input” under Accessibility. It lets an operator tap and type — " +
                "and lets me read the pairing code for you. Samsung may ask you to allow restricted " +
                "settings first.",
            buttonText = "Open Accessibility settings",
            onAction = { openSetting(Settings.ACTION_ACCESSIBILITY_SETTINGS) },
        )

        !developerOptionsOn -> StepPage(
            step = 2,
            art = HeroArt.DEVOPTIONS,
            title = "Unlock Developer options",
            body = "Open About phone, tap Software information, then tap Build number 7 times until " +
                "developer mode turns on. Come back — this advances on its own.",
            buttonText = "Open About phone",
            onAction = { openSetting(Settings.ACTION_DEVICE_INFO_SETTINGS) },
        )

        !wirelessDebuggingOn -> StepPage(
            step = 3,
            art = HeroArt.WIRELESS,
            title = "Turn on Wireless debugging",
            body = "In Developer options, switch Wireless debugging on and accept the prompt. That's " +
                "the only switch you flip — Android won't let an app turn it on for you.",
            buttonText = "Open Developer options",
            onAction = { openSetting(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS) },
        )

        // Welcome + consent done, prerequisites met, not yet paired: wait for the pairing to finish.
        else -> PairingPage(
            controller = controller,
            onOpenSettings = { openSetting(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS) },
        )
    }
}

// --- pages --------------------------------------------------------------------------------------

@Composable
private fun WelcomePage(onNext: () -> Unit) = OnboardingScaffold(
    progress = null,
    art = HeroArt.WELCOME,
    primaryText = "Get started",
    onPrimary = onNext,
) {
    Title("Remote365 Host")
    Spacer(Modifier.height(10.dp))
    Body(
        "Let this phone be managed remotely. Set it up once — about a minute — and an operator can " +
            "connect anytime, with no one touching the phone. It even comes back on its own after a reboot.",
    )
}

@Composable
private fun ConsentPage(onAgree: () -> Unit) = OnboardingScaffold(
    progress = null,
    art = HeroArt.CONSENT,
    primaryText = "I agree & continue",
    onPrimary = onAgree,
) {
    Title("Before you start")
    Spacer(Modifier.height(10.dp))
    Body(
        "By setting this up, you allow an authorised operator to view and control this device during " +
            "sessions you or your administrator approve. You'll find this device's ID and password on " +
            "the home screen to share with your operator.",
    )
}

@Composable
private fun StepPage(
    step: Int,
    art: HeroArt,
    title: String,
    body: String,
    buttonText: String,
    onAction: () -> Unit,
) = OnboardingScaffold(
    progress = step,
    art = art,
    primaryText = buttonText,
    onPrimary = onAction,
) {
    Title(title)
    Spacer(Modifier.height(10.dp))
    Body(body)
    Spacer(Modifier.height(16.dp))
    Text(
        "Waiting for you to finish this step…",
        fontFamily = Brand,
        fontSize = 13.sp,
        color = Color(0xFF9AA0A6),
        textAlign = TextAlign.Center,
    )
}

@Composable
private fun PairingPage(controller: SelfPairController, onOpenSettings: () -> Unit) {
    // Belt-and-suspenders: onResume already armed the watch, but if the user reaches this screen
    // with it somehow idle, make sure it's running. ensureWatching() is a no-op if it already is.
    LaunchedEffect(Unit) { controller.ensureWatching() }
    val state by controller.state.collectAsState()

    val status = when (state) {
        is SelfPairState.Working -> (state as SelfPairState.Working).step
        is SelfPairState.Failed -> null
        else -> "Waiting for the pairing dialog…"
    }
    val failed = state as? SelfPairState.Failed

    OnboardingScaffold(
        progress = TOTAL_STEPS,
        art = HeroArt.PAIRING,
        primaryText = if (failed != null) "Try again" else "Open Developer options",
        onPrimary = {
            if (failed != null) {
                controller.reset()
                controller.watchForPairing()
            } else {
                onOpenSettings()
            }
        },
        // Only offered on failure — otherwise the primary already opens Settings.
        secondaryText = if (failed != null) "Open Developer options" else null,
        onSecondary = if (failed != null) onOpenSettings else null,
    ) {
        Title("Pair this phone")
        Spacer(Modifier.height(10.dp))
        Body(
            "Open Wireless debugging → “Pair device with pairing code.” I read the code and finish " +
                "automatically — no typing.",
        )
        Spacer(Modifier.height(20.dp))
        if (failed != null) {
            Text(
                failed.message,
                fontFamily = Brand,
                fontSize = 13.sp,
                color = Color(0xFFD93025),
                textAlign = TextAlign.Center,
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Accent)
                Text(status ?: "", fontFamily = Brand, fontSize = 13.sp, color = Color(0xFF5F6368))
            }
        }
    }
}

@Composable
private fun CongratsPage(onContinue: () -> Unit) {
    // No buttons — the check draws itself on, then we move to ID & password on our own.
    val draw = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        draw.animateTo(1f, animationSpec = tween(durationMillis = 900, easing = FastOutSlowInEasing))
        delay(1_700)
        onContinue()
    }
    OnboardingScaffold(progress = null, art = HeroArt.CONGRATS, artProgress = draw.value) {
        Title("You're all set!")
        Spacer(Modifier.height(10.dp))
        Body(
            "This phone is now unattended. An operator can connect anytime — even after a reboot — " +
                "with nobody here to approve it.",
        )
    }
}

// --- shared building blocks ---------------------------------------------------------------------

/**
 * The onboarding template: three ambient glows, a hero illustration, the title/body block, the
 * step-progress pills, then a gradient primary button with an optional white secondary beneath.
 *
 * The hero is sized as a fraction of the *screen height* rather than a fixed 400.dp so a short
 * phone (e.g. a 5" 16:9 panel) shrinks the art instead of pushing the buttons off-screen — the
 * one place where a hard dp value would break the "identical on every phone" goal it's meant to
 * serve. It's clamped so it never dominates a tall device either.
 */
@Composable
private fun OnboardingScaffold(
    progress: Int?,
    art: HeroArt,
    primaryText: String? = null,
    onPrimary: (() -> Unit)? = null,
    secondaryText: String? = null,
    onSecondary: (() -> Unit)? = null,
    artProgress: Float = 1f,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Color.White)) {
        val heroSize = (maxHeight * 0.34f).coerceIn(180.dp, 300.dp)

        // Three blurred glows. Rendered as radial gradients that fade to transparent rather than
        // Modifier.blur — blur is API 31+ and falls back to nothing on older phones, which would
        // make the same build look different across the fleet.
        Glow(Modifier.align(Alignment.TopStart).offset(x = (-90).dp, y = (-60).dp), 300.dp, 0x3DFF8A00)
        Glow(Modifier.align(Alignment.TopEnd).offset(x = 80.dp, y = 40.dp), 240.dp, 0x2EFFB347)
        Glow(Modifier.align(Alignment.BottomCenter).offset(y = 110.dp), 340.dp, 0x29FF8A00)

        Column(
            // Inset for the system bars: targetSdk 36 forces edge-to-edge on Android 15+, so
            // without this the primary button sits underneath the navigation bar.
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 28.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.weight(0.6f))
            Hero(art = art, modifier = Modifier.size(heroSize), progress = artProgress)
            Spacer(Modifier.height(28.dp))
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                content = content,
            )
            Spacer(Modifier.weight(1f))

            if (progress != null) {
                StepProgress(progress)
                Spacer(Modifier.height(20.dp))
            }
            if (primaryText != null && onPrimary != null) {
                GradientButton(primaryText, onPrimary)
            }
            if (secondaryText != null && onSecondary != null) {
                Spacer(Modifier.height(12.dp))
                SecondaryButton(secondaryText, onSecondary)
            }
            // Lifts the button block clear of the gesture bar rather than hugging it.
            Spacer(Modifier.height(28.dp))
        }
        DarkNavBar()
    }
}

@Composable
private fun Glow(modifier: Modifier, diameter: Dp, argb: Long) {
    Box(
        modifier = modifier
            .size(diameter)
            .background(
                Brush.radialGradient(
                    colorStops = arrayOf(
                        0.0f to Color(argb),
                        0.55f to Color(argb and 0x00FFFFFF or 0x14000000),
                        1.0f to Color(0x00FFFFFF),
                    ),
                ),
            ),
    )
}

/** Step progress: small grey pills, with the active step drawn as an elongated orange pill. */
@Composable
private fun StepProgress(current: Int) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for (i in 1..TOTAL_STEPS) {
            val active = i == current
            Box(
                modifier = Modifier
                    .height(8.dp)
                    .width(if (active) 26.dp else 8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(
                        if (active) {
                            Brush.horizontalGradient(listOf(Accent, Accent2))
                        } else {
                            SolidColor(if (i < current) Color(0xFFFFD9A8) else Color(0xFFE1E3E6))
                        },
                    ),
            )
        }
    }
}

@Composable
private fun GradientButton(text: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(32.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(32.dp))
                .background(Brush.horizontalGradient(listOf(Accent, Accent2))),
            contentAlignment = Alignment.Center,
        ) {
            Text(text, fontFamily = Brand, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color.White)
        }
    }
}

@Composable
private fun SecondaryButton(text: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(32.dp),
        border = BorderStroke(1.dp, Color(0xFFE1E3E6)),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White),
    ) {
        Text(text, fontFamily = Brand, fontWeight = FontWeight.Medium, fontSize = 16.sp, color = Color(0xFF111315))
    }
}

@Composable
private fun Title(text: String) = Text(
    text = text,
    fontFamily = Brand,
    fontWeight = FontWeight.Bold,
    fontSize = 22.sp,
    color = Color(0xFF111315),
    textAlign = TextAlign.Center,
)

@Composable
private fun Body(text: String) = Text(
    text = text,
    fontFamily = Brand,
    fontSize = 15.sp,
    lineHeight = 22.sp,
    color = Color(0xFF5F6368),
    textAlign = TextAlign.Center,
)

private val Accent = Color(0xFFFF8A00)
private val Accent2 = Color(0xFFFFB347)
private val Brand = MonaSans
