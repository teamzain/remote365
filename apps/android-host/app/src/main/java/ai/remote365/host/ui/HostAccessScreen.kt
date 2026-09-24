package ai.remote365.host.ui

import ai.remote365.host.net.DeviceRegistrar
import ai.remote365.host.net.HostIdentity
import ai.remote365.host.rtc.CallDaemonClient
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val Accent = Color(0xFFFF8A00)

/**
 * The device's home once it's set up: its ID and password, ready to hand to a viewer. This is the
 * screen a paired device lands on every launch — the setup wizard and the debug status panel are
 * gone. Self-contained so both the splash → home route and the end of onboarding show exactly the
 * same thing; it reads its own identity and drives password/easy-grant changes itself.
 */
@Composable
fun HostAccessScreen() {
    val context = LocalContext.current
    val identity = remember { HostIdentity.create(context) }
    val registrar = remember { DeviceRegistrar(identity) }
    val scope = rememberCoroutineScope()

    var accessKey by remember { mutableStateOf(identity.accessKey.orEmpty()) }
    var password by remember { mutableStateOf(identity.accessPassword.orEmpty()) }
    var passwordRequired by remember { mutableStateOf(identity.passwordRequired) }
    var showPassword by remember { mutableStateOf(false) }
    var showChangeDialog by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var hearBothSides by remember { mutableStateOf(CallDaemonClient.preferredSource(context) == 4) }
    var busy by remember { mutableStateOf(false) }

    // Credentials land a moment after launch (registration is async); poll until present, then keep
    // the fields in sync with whatever the background registration settles on.
    LaunchedEffect(Unit) {
        while (true) {
            identity.accessKey?.let { accessKey = it }
            identity.accessPassword?.let { password = it }
            passwordRequired = identity.passwordRequired
            delay(1_000)
        }
    }

    fun setEasyGrant(easyGrant: Boolean) {
        val required = !easyGrant
        passwordRequired = required // optimistic; reverted on failure
        busy = true
        scope.launch {
            val result = registrar.applySettings(context, passwordRequired = required)
            busy = false
            if (result.isFailure) {
                passwordRequired = !required
                toast(context, "Couldn't update — check the connection")
            } else {
                toast(context, if (easyGrant) "Password no longer required" else "Password required")
            }
        }
    }

    if (showChangeDialog) {
        ChangePasswordDialog(
            busy = busy,
            onDismiss = { if (!busy) showChangeDialog = false },
            onSave = { chosen ->
                busy = true
                scope.launch {
                    val result = registrar.applySettings(context, newPassword = chosen)
                    busy = false
                    if (result.isSuccess) {
                        password = chosen
                        showPassword = true
                        showChangeDialog = false
                        toast(context, "Password changed")
                    } else {
                        toast(context, "Couldn't change password — check the connection")
                    }
                }
            },
        )
    }

    if (showSettings) {
        HostSettingsScreen(
            hearBothSides = hearBothSides,
            onHearBothSidesChange = {
                hearBothSides = it
                CallDaemonClient.setHearBothSides(context, it)
            },
            canChangePassword = accessKey.isNotBlank() && !busy,
            onChangePassword = { showChangeDialog = true },
            onBack = { showSettings = false },
        )
        return
    }
    Box(Modifier.fillMaxSize().background(Color.White)) {
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .height(200.dp)
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color(0x66FF8A00),
                            0.6f to Color(0x33FFB347),
                            1.0f to Color(0x00FFFFFF),
                        ),
                    ),
                ),
        )
        // Bottom glow, mirroring the top so the screen is framed top and bottom. It runs to the very
        // bottom edge (behind the OS navigation bar, which the content is padded clear of), so the
        // nav area picks up the same warm tint instead of a flat white edge.
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(200.dp)
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color(0x00FFFFFF),
                            0.4f to Color(0x33FFB347),
                            1.0f to Color(0x66FF8A00),
                        ),
                    ),
                ),
        )
        // Fixed layout — no scrolling. Content flows from the top; a flexible spacer absorbs the
        // slack and pins the primary button to the bottom, so it all fits on one screen.
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 28.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(24.dp))
            Text("Remote365 Host", fontFamily = MonaSans, fontWeight = FontWeight.Medium, fontSize = 18.sp, color = Color(0xFF111315))
            Spacer(Modifier.height(10.dp))
            StatusPill()

            Spacer(Modifier.height(22.dp))
            Text("Host Access", fontFamily = MonaSans, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color(0xFF111315), textAlign = TextAlign.Center)
            Spacer(Modifier.height(6.dp))
            Text(
                if (passwordRequired) "Give viewers this ID and password to connect."
                else "Anyone with this ID can connect — no password needed.",
                fontFamily = MonaSans,
                fontSize = 15.sp,
                lineHeight = 21.sp,
                color = Color(0xFF5F6368),
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(20.dp))
            CredentialCard(
                label = "Your ID",
                value = accessKey.ifBlank { "…" },
                onCopy = { copyToClipboard(context, "ID", accessKey) },
            )
            Spacer(Modifier.height(10.dp))
            CredentialCard(
                label = "Password",
                value = when {
                    !passwordRequired -> "Not required"
                    showPassword -> password.ifBlank { "…" }
                    else -> "•".repeat(password.length.coerceIn(4, 10))
                },
                dim = !passwordRequired,
                onCopy = if (passwordRequired) ({ copyToClipboard(context, "Password", password) }) else null,
                onToggle = if (passwordRequired) ({ showPassword = !showPassword }) else null,
                showToggle = passwordRequired,
                revealed = showPassword,
            )

            Spacer(Modifier.height(2.dp))
            EasyGrantRow(
                easyGrant = !passwordRequired,
                enabled = accessKey.isNotBlank() && !busy,
                onChange = { setEasyGrant(it) },
            )

            // Absorbs all remaining height so the button sits at the bottom without scrolling.
            Spacer(Modifier.weight(1f).heightIn(min = 20.dp))
            GradientButton(
                text = "Copy ID & password",
                onClick = {
                    val block = if (passwordRequired) "ID: $accessKey\nPassword: $password" else "ID: $accessKey"
                    copyToClipboard(context, "ID & password", block)
                },
            )
            Spacer(Modifier.height(8.dp))
        }
        IconButton(onClick = { showSettings = true }, modifier = Modifier
            .align(Alignment.TopEnd).statusBarsPadding().padding(top = 8.dp, end = 12.dp)) {
            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color(0xFF111315))
        }
        DarkNavBar()
    }
}

@Composable
private fun ChangePasswordDialog(busy: Boolean, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var draft by remember { mutableStateOf(DeviceRegistrar.newPassword()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Change password", fontFamily = MonaSans, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it.trim() },
                    singleLine = true,
                    label = { Text("New password", fontFamily = MonaSans) },
                )
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = { draft = DeviceRegistrar.newPassword() }, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                    Text("Generate random", fontFamily = MonaSans, fontSize = 13.sp, color = Accent)
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    "Viewers who were already connected will need to enter the new password.",
                    fontFamily = MonaSans,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = Color(0xFF9AA0A6),
                )
            }
        },
        confirmButton = {
            TextButton(enabled = draft.length >= 4 && !busy, onClick = { onSave(draft) }) {
                Text(if (busy) "Saving…" else "Save", fontFamily = MonaSans, fontWeight = FontWeight.SemiBold, color = Accent)
            }
        },
        dismissButton = {
            TextButton(enabled = !busy, onClick = onDismiss) {
                Text("Cancel", fontFamily = MonaSans, color = Color(0xFF5F6368))
            }
        },
    )
}

@Composable
private fun EasyGrantRow(easyGrant: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF3F4F6))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text("Easy grant access", fontFamily = MonaSans, fontWeight = FontWeight.Medium, fontSize = 15.sp, color = Color(0xFF111315))
            Text(
                "Let anyone with the ID connect without the password.",
                fontFamily = MonaSans,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = Color(0xFF9AA0A6),
            )
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = easyGrant,
            onCheckedChange = onChange,
            enabled = enabled,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Accent,
            ),
        )
    }
}

@Composable
private fun StatusPill() {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(32.dp))
            .background(Color(0x1A14AE5C))
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(6.dp).clip(CircleShape).background(Color(0xFF14AE5C)))
        Text("Ready to connect", fontFamily = MonaSans, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = Color(0xFF111315))
    }
}

@Composable
private fun CredentialCard(
    label: String,
    value: String,
    onCopy: (() -> Unit)?,
    onToggle: (() -> Unit)? = null,
    showToggle: Boolean = false,
    revealed: Boolean = false,
    dim: Boolean = false,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF3F4F6))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontFamily = MonaSans, fontSize = 14.sp, color = Color(0xB31A1D21))
            Text(
                value,
                fontFamily = MonaSans,
                fontWeight = if (dim) FontWeight.Medium else FontWeight.Bold,
                fontSize = if (dim) 16.sp else 24.sp,
                color = if (dim) Color(0xFF9AA0A6) else Color(0xFF111315),
            )
        }
        if (showToggle && onToggle != null) {
            TextButton(onClick = onToggle) {
                Text(if (revealed) "Hide" else "Show", fontFamily = MonaSans, fontSize = 13.sp, color = Accent)
            }
        }
        if (onCopy != null) {
            TextButton(onClick = onCopy) {
                Text("Copy", fontFamily = MonaSans, fontSize = 13.sp, color = Accent)
            }
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
                .background(Brush.horizontalGradient(listOf(Color(0xFFFF8A00), Color(0xFFFFB347)))),
            contentAlignment = Alignment.Center,
        ) {
            Text(text, fontFamily = MonaSans, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Color.White)
        }
    }
}

/**
 * A dark band painted behind the OS navigation bar so its buttons stay clearly visible against the
 * light UI / bottom gradient (they were washing out on the orange glow). Also flips the nav-bar
 * icons to light so they read on the dark band. Call inside a fill-size Box; it sizes itself to the
 * exact nav-bar inset, so it never covers app content.
 */
@Composable
fun BoxScope.DarkNavBar(color: Color = Color(0xFF111315)) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            WindowCompat.getInsetsController((view.context as Activity).window, view)
                .isAppearanceLightNavigationBars = false
        }
    }
    Box(
        Modifier
            .align(Alignment.BottomCenter)
            .fillMaxWidth()
            .windowInsetsBottomHeight(WindowInsets.navigationBars)
            .background(color),
    )
}

private fun toast(context: Context, message: String) =
    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()

private fun copyToClipboard(context: Context, label: String, value: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
    cm.setPrimaryClip(ClipData.newPlainText(label, value))
    Toast.makeText(context, "$label copied", Toast.LENGTH_SHORT).show()
}
