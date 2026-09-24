import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { initialsFor, SettingsPage, type SettingsUser } from './SettingsScaffold';
import { deleteAccount } from './accountApi';
import { SETTING_KEYS, useSetting } from './settingsPrefs';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';

function AccountInfoRow({ icon, subtitle, title }: { icon: keyof typeof Feather.glyphMap; subtitle: string; title: string }) {
  const { type, maxFontSizeMultiplier } = useResponsive();

  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Feather name={icon} size={16} color="#111315" />
        <View style={styles.infoCopy}>
          <Text style={[styles.infoTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          {/* No numberOfLines: the email address is the point of the row, so it wraps rather
              than truncating on narrow screens / at large font scale. */}
          <Text style={[styles.infoSubtitle, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

export function AccountScreen({
  apiBaseUrl,
  authToken,
  onBack,
  onLogout,
  user,
}: {
  apiBaseUrl: string;
  authToken: string | null;
  onBack: () => void;
  onLogout: () => void;
  user: SettingsUser | null;
}) {
  const [notificationsEnabled, setNotificationsEnabled] = useSetting(SETTING_KEYS.chatNotifications, true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { circle, insets, maxFontSizeMultiplier, modalMaxHeight, stackActions, textSize, type } = useResponsive();
  const { t } = useTranslation();
  const displayName = user?.name || user?.email?.split('@')[0] || t('Remote 365 user');
  const initials = initialsFor(displayName);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteAccount(apiBaseUrl, authToken);
    setDeleting(false);
    if (res.ok) {
      setConfirmDelete(false);
      onLogout();
    } else {
      setDeleteError(res.error || t('Could not delete your account.'));
    }
  };

  return (
    <SettingsPage title={t('Account')} onBack={onBack}>
      <View style={styles.profileRow}>
        <View style={[styles.avatar, circle(32)]}>
          <Text style={[styles.avatarText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.accountName, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.accountMeta, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{user?.email || t('Not signed in')}</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#858687" />
      </View>

      <View style={styles.rowsGroup}>
        <AccountInfoRow icon="mail" title={t('Email address')} subtitle={user?.email || t('Not signed in')} />
        <AccountInfoRow icon="check-circle" title={t('Account status')} subtitle={user?.email ? t('Active') : t('Signed out')} />
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Feather name="bell" size={16} color="#111315" />
            <View style={styles.infoCopy}>
              <Text style={[styles.infoTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Notifications')}</Text>
              <Text style={[styles.infoSubtitle, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{notificationsEnabled ? t('Enabled for account alerts') : t('Disabled for account alerts')}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: notificationsEnabled }}
            onPress={() => setNotificationsEnabled(!notificationsEnabled)}
            // The pill is only 36x20dp; hitSlop lifts the real target to 56x48dp.
            hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
            style={[styles.toggle, notificationsEnabled && styles.toggleOn]}
          >
            <View style={[styles.toggleKnob, notificationsEnabled && styles.toggleKnobOn]} />
          </Pressable>
        </View>
      </View>

      <View style={styles.actionsGroup}>
        <Pressable style={styles.actionRow} onPress={onLogout}>
          <Feather name="log-out" size={16} color="#14AE5C" />
          <Text style={[styles.actionText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Logout')}</Text>
        </Pressable>
        <Pressable style={styles.actionRow} onPress={() => { setDeleteError(null); setConfirmDelete(true); }}>
          <Feather name="trash-2" size={16} color="#D92D20" />
          <Text style={[styles.actionText, styles.deleteText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Delete Account')}</Text>
        </Pressable>
      </View>

      {/* statusBarTranslucent/navigationBarTranslucent: the app is edge-to-edge, so without
          these the dim backdrop stops short of the system bars. */}
      <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="fade" visible={confirmDelete} onRequestClose={() => setConfirmDelete(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !deleting && setConfirmDelete(false)} />
          {/* Bounded height + a scrollable body so the actions can never be pushed off-screen
              on a short phone at a large font scale. */}
          <View style={[styles.dialog, { maxHeight: Math.max(160, modalMaxHeight - insets.top - insets.bottom) }]}>
            <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.dialogIcon}>
                <Feather name="trash-2" size={22} color="#D92D20" />
              </View>
              <Text style={[styles.dialogTitle, textSize(17)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Delete account?')}</Text>
              <Text style={[styles.dialogText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {t("This permanently deletes your Remote 365 account, devices, and data. This can't be undone.")}
              </Text>
              {deleteError ? <Text style={[styles.dialogError, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{deleteError}</Text> : null}
            </ScrollView>
            <View style={[styles.dialogButtons, stackActions && styles.dialogButtonsStacked]}>
              <Pressable style={[styles.dialogButton, styles.dialogGhost, stackActions && styles.dialogButtonStacked]} onPress={() => setConfirmDelete(false)} disabled={deleting}>
                <Text style={[styles.dialogGhostText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.dialogButton, styles.dialogDanger, stackActions && styles.dialogButtonStacked]} onPress={handleDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.dialogDangerText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Delete')}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  profileRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 34, width: '100%' },
  avatar: { alignItems: 'center', backgroundColor: '#F9F5FF', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  avatarText: { color: '#7F56D9', textAlign: 'center' },
  profileCopy: { flex: 1, minWidth: 0 },
  accountName: { color: '#111315', fontWeight: '500' },
  accountMeta: { color: 'rgba(26, 29, 33, 0.7)' },
  rowsGroup: { gap: 8, width: '100%' },
  infoRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 51, paddingVertical: 10, width: '100%' },
  infoLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  infoCopy: { flex: 1, minWidth: 0 },
  infoTitle: { color: '#111315' },
  infoSubtitle: { color: 'rgba(26, 29, 33, 0.7)' },
  toggle: { alignItems: 'center', backgroundColor: '#E4E7EB', borderRadius: 10, height: 20, justifyContent: 'center', paddingHorizontal: 2, width: 36 },
  toggleOn: { backgroundColor: '#FF8A00' },
  // Positioned with an absolute offset + transform rather than alignSelf flex-start/flex-end,
  // which Yoga resolves against the layout direction and so inverts the knob under RTL.
  toggleKnob: { backgroundColor: '#FFFFFF', borderRadius: 8, height: 16, left: 2, position: 'absolute', width: 16 },
  toggleKnobOn: { transform: [{ translateX: 16 }] },
  actionsGroup: { gap: 8, width: '100%' },
  actionRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 37, paddingVertical: 10, width: '100%' },
  actionText: { color: '#111315' },
  deleteText: { color: '#D92D20' },
  dialogBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 12, maxWidth: 360, padding: 20, width: '100%' },
  dialogScroll: { flexGrow: 0, flexShrink: 1, width: '100%' },
  dialogScrollContent: { width: '100%' },
  dialogIcon: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(217,45,32,0.1)', borderRadius: 22, height: 44, justifyContent: 'center', marginBottom: 12, width: 44 },
  dialogTitle: { color: '#111315', fontWeight: '600', textAlign: 'center' },
  dialogText: { color: 'rgba(17,19,21,0.65)', marginTop: 6, textAlign: 'center' },
  dialogError: { color: '#D92D20', marginTop: 10, textAlign: 'center' },
  dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  // Side-by-side buttons are ~91dp wide on a 280-320dp screen; stack them once the labels
  // can no longer fit (safeWidth < 360 or fontScale > 1.3).
  dialogButtonsStacked: { flexDirection: 'column' },
  dialogButton: { alignItems: 'center', borderRadius: 6, flex: 1, justifyContent: 'center', paddingVertical: 12 },
  // flex:1 inside a column would resolve to flexBasis 0 and collapse the buttons.
  dialogButtonStacked: { alignSelf: 'stretch', flex: 0 },
  dialogGhost: { borderColor: 'rgba(26,29,33,0.3)', borderWidth: 1 },
  dialogGhostText: { color: '#111315', fontWeight: '500' },
  dialogDanger: { backgroundColor: '#D92D20' },
  dialogDangerText: { color: '#FFFFFF', fontWeight: '600' },
}));

export const accountToggleStyles = {
  toggle: styles.toggle,
  toggleKnob: styles.toggleKnob,
  toggleKnobOn: styles.toggleKnobOn,
  toggleOn: styles.toggleOn,
};
