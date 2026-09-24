package ai.remote365.host.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Call
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SettingsInk = Color(0xFF111315)
private val SettingsMuted = Color(0xFF667085)
private val SettingsAccent = Color(0xFFFF8A00)

@Composable
fun HostSettingsScreen(
    hearBothSides: Boolean,
    onHearBothSidesChange: (Boolean) -> Unit,
    canChangePassword: Boolean,
    onChangePassword: () -> Unit,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    Column(Modifier.fillMaxSize().background(Color.White).statusBarsPadding().navigationBarsPadding()) {
        Surface(color = Color.White, shadowElevation = 0.dp, tonalElevation = 0.dp) {
            Row(Modifier.fillMaxWidth().height(60.dp).padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SettingsInk, modifier = Modifier.size(20.dp))
                }
                Text("Settings", fontFamily = MonaSans, fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp, lineHeight = 23.sp, color = SettingsInk)
            }
        }
        Column(Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SettingsSectionLabel("Account")
            Row(Modifier.fillMaxWidth().clickable(enabled = canChangePassword, onClick = onChangePassword)
                .padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SettingsGlyph { Icon(Icons.Default.Lock, null, tint = SettingsAccent, modifier = Modifier.size(20.dp)) }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Change password", fontFamily = MonaSans, fontSize = 14.sp,
                        fontWeight = FontWeight.Medium, color = if (canChangePassword) SettingsInk else SettingsMuted)
                    Text("Update your remote access password", fontFamily = MonaSans,
                        fontSize = 12.sp, lineHeight = 18.sp, color = SettingsMuted)
                }
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = SettingsMuted, modifier = Modifier.size(20.dp))
            }
            HorizontalDivider(color = Color(0xFFEAECF0))
            SettingsSectionLabel("Audio")
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SettingsGlyph { Icon(Icons.Default.Call, null, tint = SettingsAccent, modifier = Modifier.size(20.dp)) }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Hear audio both sides", fontFamily = MonaSans, fontSize = 14.sp,
                        fontWeight = FontWeight.Medium, color = SettingsInk)
                    Text(if (hearBothSides) "Both people in the call" else "Only the other person",
                        fontFamily = MonaSans, fontSize = 12.sp, lineHeight = 18.sp, color = SettingsMuted)
                }
                Switch(checked = hearBothSides, onCheckedChange = onHearBothSidesChange,
                    colors = SwitchDefaults.colors(checkedTrackColor = SettingsAccent, checkedThumbColor = Color.White))
            }
            Text("Both sides includes sounds picked up by the phone microphone. Restart desktop listening after changing this setting.",
                fontFamily = MonaSans, fontSize = 12.sp, lineHeight = 18.sp, color = SettingsMuted)
            HorizontalDivider(color = Color(0xFFEAECF0))
        }
    }
}

@Composable
private fun SettingsSectionLabel(label: String) {
    Text(label, fontFamily = MonaSans, fontSize = 12.sp, lineHeight = 17.sp,
        fontWeight = FontWeight.Medium, color = SettingsMuted)
}

@Composable
private fun SettingsGlyph(content: @Composable () -> Unit) {
    Box(Modifier.size(40.dp).clip(CircleShape).background(Color(0xFFFFF5E8)),
        contentAlignment = Alignment.Center) { content() }
}
