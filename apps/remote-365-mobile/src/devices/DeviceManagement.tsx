import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatAccessKey } from '../lib/accessKey';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import {
  addExistingDevice,
  createDeviceGroup,
  deleteDevice,
  deleteDeviceGroup,
  renameDevice,
  renameDeviceGroup,
  setDeviceGroups,
  trustDevice,
} from './deviceApi';

const DEFAULT_GROUP = 'My computers';

// Structural mirrors of App.tsx's DeviceItem / DeviceGroup — only what's used here.
export type ManagedDevice = {
  id: string;
  name: string;
  accessKey?: string;
  isOnline: boolean;
  groups: Array<{ id: string; name?: string }>;
};

export type ManagedGroup = {
  id: string;
  name: string;
  deviceCount?: number;
};

export type DeviceMgmtAction =
  | { kind: 'add-menu' }
  | { kind: 'add-device' }
  | { kind: 'create-group' }
  | { kind: 'group-menu'; group: ManagedGroup }
  | { kind: 'rename-group'; group: ManagedGroup }
  | { kind: 'device-menu'; device: ManagedDevice }
  | { kind: 'rename-device'; device: ManagedDevice }
  | { kind: 'assign-groups'; device: ManagedDevice };

type Props = {
  action: DeviceMgmtAction | null;
  groups: ManagedGroup[];
  apiBaseUrl: string;
  token: string | null;
  onClose: () => void;
  onAction: (action: DeviceMgmtAction) => void;
  /** Called after any successful mutation so the caller can reload devices/groups. */
  onChanged: () => void;
  onConnect: (device: ManagedDevice) => void;
};

function MenuRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { tappable, type, maxFontSizeMultiplier } = useResponsive();
  return (
    <Pressable style={[styles.menuRow, tappable(48)]} onPress={onPress}>
      <Feather name={icon} size={18} color={danger ? '#FF383C' : '#111315'} />
      <Text
        style={[styles.menuLabel, danger ? styles.menuLabelDanger : null, type(14)]}
        numberOfLines={2}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DeviceManagement({
  action,
  groups,
  apiBaseUrl,
  token,
  onClose,
  onAction,
  onChanged,
  onConnect,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Copy-ID feedback in the device sheet (web-mobile parity: "ID copied").
  const [copiedId, setCopiedId] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  // Form fields, reused across the prompt-style views.
  const [nameValue, setNameValue] = useState('');
  const [accessKeyValue, setAccessKeyValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  // Add-device extras (mirrors the desktop modal).
  const [groupChoice, setGroupChoice] = useState(DEFAULT_GROUP);
  const [newGroupMode, setNewGroupMode] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [remember, setRemember] = useState(true);
  const { control, textSize, maxFontSizeMultiplier, modalMaxHeight, cappedFontScale } = useResponsive();
  const { t } = useTranslation();

  // Reset form state whenever a different action opens.
  useEffect(() => {
    setBusy(false);
    setError(null);
    setCopiedId(false);
    setGroupPickerOpen(false);
    setPasswordValue('');
    if (action?.kind === 'rename-group') setNameValue(action.group.name);
    else if (action?.kind === 'rename-device') setNameValue(action.device.name);
    else setNameValue('');
    if (action?.kind === 'add-device') {
      setAccessKeyValue('');
      setGroupChoice(DEFAULT_GROUP);
      setNewGroupMode(false);
      setNewGroupName('');
      setRemember(true);
    }
    if (action?.kind === 'assign-groups') {
      setSelectedGroupIds(action.device.groups.map((group) => group.id));
    }
  }, [action]);

  if (!action) return null;

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      onChanged();
      onClose();
    } catch (err: any) {
      // Same wording as the desktop's add-device modal.
      if (action.kind === 'add-device' && err?.status === 401) {
        setError(passwordValue.trim()
          ? t('Incorrect password. Please enter the correct password and try again.')
          : t('This device requires a password. Enter it and try again.'));
      } else if (action.kind === 'add-device' && err?.status === 404) {
        setError(t("We couldn't find a device with that ID. Double-check the Remote 365 ID."));
      } else {
        setError(err?.message || t('Something went wrong.'));
      }
    } finally {
      setBusy(false);
    }
  };

  // Add the device, then (like desktop) resolve/create the chosen group and
  // assign it, and persist trust when "Remember this device" is on. Group
  // assignment is best-effort — a plan/permission block shouldn't undo the add.
  const submitAddDevice = () => {
    const requestedKey = accessKeyValue.replace(/\D/g, '');
    if (!requestedKey) {
      setError(t('Please enter the Remote 365 ID.'));
      return;
    }
    run(async () => {
      const data: any = await addExistingDevice(apiBaseUrl, token, {
        accessKey: requestedKey,
        password: passwordValue || undefined,
        name: nameValue.trim() || undefined,
        remember,
      });
      const deviceId = data?.device?.id || data?.id;
      const groupName = (newGroupMode ? newGroupName : groupChoice).trim();
      if (deviceId && groupName && groupName.toLowerCase() !== DEFAULT_GROUP.toLowerCase()) {
        try {
          let group = groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
          if (!group) group = (await createDeviceGroup(apiBaseUrl, token, groupName)).group;
          if (group?.id) await setDeviceGroups(apiBaseUrl, token, deviceId, [group.id]);
        } catch { /* device is added; grouping is optional */ }
      }
      if (remember && deviceId) trustDevice(apiBaseUrl, token, deviceId).catch(() => {});
    });
  };

  const confirmDelete = (title: string, message: string, task: () => Promise<unknown>) => {
    Alert.alert(title, message, [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: () => { run(task); } },
    ]);
  };

  const isSheet = action.kind === 'add-menu' || action.kind === 'device-menu' || action.kind === 'group-menu';

  const renderSheet = () => {
    if (action.kind === 'add-menu') {
      return (
        <>
          <Text style={[styles.sheetTitle, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Add')}</Text>
          <MenuRow icon="monitor" label={t('Add device by access key')} onPress={() => onAction({ kind: 'add-device' })} />
          <MenuRow icon="folder-plus" label={t('New group')} onPress={() => onAction({ kind: 'create-group' })} />
        </>
      );
    }
    if (action.kind === 'device-menu') {
      const { device } = action;
      return (
        <>
          <Text style={[styles.sheetTitle, textSize(13)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{device.name}</Text>
          {device.isOnline ? (
            <MenuRow icon="cast" label={t('Connect')} onPress={() => { onClose(); onConnect(device); }} />
          ) : null}
          <MenuRow
            icon="copy"
            label={copiedId ? t('ID copied') : t('Copy ID')}
            onPress={() => {
              Clipboard.setStringAsync(formatAccessKey(device.accessKey || ''))
                .then(() => setCopiedId(true))
                .catch(() => {});
            }}
          />
          <MenuRow icon="edit-3" label={t('Rename device')} onPress={() => onAction({ kind: 'rename-device', device })} />
          <MenuRow icon="folder" label={t('Assign to groups')} onPress={() => onAction({ kind: 'assign-groups', device })} />
          <MenuRow
            icon="trash-2"
            label={t('Remove from account')}
            danger
            onPress={() =>
              confirmDelete(
                t('Remove device'),
                `${t('Remove')} "${device.name}" ${t('from your account? The device itself is not affected.')}`,
                () => deleteDevice(apiBaseUrl, token, device.id),
              )
            }
          />
        </>
      );
    }
    // group-menu
    const { group } = action as Extract<DeviceMgmtAction, { kind: 'group-menu' }>;
    return (
      <>
        <Text style={[styles.sheetTitle, textSize(13)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{group.name}</Text>
        <MenuRow icon="edit-3" label={t('Rename group')} onPress={() => onAction({ kind: 'rename-group', group })} />
        <MenuRow
          icon="trash-2"
          label={t('Delete group')}
          danger
          onPress={() =>
            confirmDelete(
              t('Delete group'),
              `${t('Delete')} "${group.name}"? ${t('Devices in it are kept — they just leave the group.')}`,
              () => deleteDeviceGroup(apiBaseUrl, token, group.id),
            )
          }
        />
      </>
    );
  };

  const renderCard = () => {
    if (action.kind === 'add-device') {
      const groupOptions = [DEFAULT_GROUP, ...groups.map((g) => g.name).filter((n) => n.toLowerCase() !== DEFAULT_GROUP.toLowerCase())];
      return (
        <>
          <Text style={[styles.cardTitle, textSize(16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Add device')}</Text>
          <Text style={[styles.cardHint, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Enter the Remote 365 ID shown on the device you want to add.')}</Text>
          <TextInput
            style={[styles.input, textSize(14), control(44)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            placeholder={t('Remote 365 ID (e.g. 123 456 789)')}
            placeholderTextColor="rgba(17,19,21,0.35)"
            value={accessKeyValue}
            onChangeText={(text) => setAccessKeyValue(formatAccessKey(text))}
            keyboardType="number-pad"
            autoFocus
          />
          <TextInput
            style={[styles.input, textSize(14), control(44)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            placeholder={t('Password (not needed with Easy Access)')}
            placeholderTextColor="rgba(17,19,21,0.35)"
            value={passwordValue}
            onChangeText={setPasswordValue}
            secureTextEntry
          />
          <TextInput
            style={[styles.input, textSize(14), control(44)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            placeholder={t('Name (optional)')}
            placeholderTextColor="rgba(17,19,21,0.35)"
            value={nameValue}
            onChangeText={setNameValue}
          />

          <Text style={[styles.fieldLabel, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Group')}</Text>
          {/* Dropdown (web parity: the add-device modal uses a select, not a
              chip wall — with a dozen groups chips overflow the card). */}
          <Pressable style={[styles.dropdown, control(44)]} onPress={() => setGroupPickerOpen((open) => !open)}>
            <Text style={[styles.dropdownValue, textSize(14)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {newGroupMode ? t('New group…') : groupChoice}
            </Text>
            <Feather name={groupPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(17,19,21,0.55)" />
          </Pressable>
          {groupPickerOpen ? (
            <View style={styles.dropdownList}>
              <ScrollView
                style={[styles.dropdownScroll, { maxHeight: Math.round(216 * Math.max(1, cappedFontScale)) }]}
                nestedScrollEnabled
              >
                {groupOptions.map((name) => {
                  const selected = !newGroupMode && groupChoice.toLowerCase() === name.toLowerCase();
                  return (
                    <Pressable
                      key={name}
                      style={[styles.dropdownItem, control(42)]}
                      onPress={() => { setNewGroupMode(false); setGroupChoice(name); setGroupPickerOpen(false); }}
                    >
                      <Text
                        style={[styles.dropdownItemText, textSize(14), selected && styles.dropdownItemTextOn]}
                        numberOfLines={1}
                        maxFontSizeMultiplier={maxFontSizeMultiplier}
                      >
                        {name}
                      </Text>
                      {selected ? <Feather name="check" size={15} color="#FF8A00" /> : null}
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.dropdownItem, control(42)]}
                  onPress={() => { setNewGroupMode(true); setGroupPickerOpen(false); }}
                >
                  <Text
                    style={[styles.dropdownItemText, textSize(14), newGroupMode && styles.dropdownItemTextOn]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={maxFontSizeMultiplier}
                  >
                    {t('+ New group')}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}
          {newGroupMode ? (
            <TextInput
              style={[styles.input, textSize(14), control(44)]}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
              placeholder={t('New group name')}
              placeholderTextColor="rgba(17,19,21,0.35)"
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={50}
              autoFocus
            />
          ) : null}

          <Pressable style={styles.checkRow} onPress={() => setRemember((v) => !v)}>
            <View style={[styles.checkbox, remember && styles.checkboxOn]}>
              {remember ? <Feather name="check" size={13} color="#fff" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.checkLabel, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Remember this device')}</Text>
              <Text style={[styles.cardHint, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Reconnect without entering the password each time.')}</Text>
            </View>
          </Pressable>

          {error ? <Text style={[styles.errorText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{error}</Text> : null}
          <View style={styles.cardButtons}>
            <Pressable style={[styles.cancelButton, control(40)]} onPress={onClose} disabled={busy}>
              <Text style={[styles.cancelText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, control(40), (!accessKeyValue.trim() || busy) && styles.buttonDisabled]}
              disabled={!accessKeyValue.trim() || busy}
              onPress={submitAddDevice}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.primaryText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Add device')}</Text>}
            </Pressable>
          </View>
        </>
      );
    }

    if (action.kind === 'create-group' || action.kind === 'rename-group' || action.kind === 'rename-device') {
      const title = action.kind === 'create-group' ? t('New group') : action.kind === 'rename-group' ? t('Rename group') : t('Rename device');
      const submitLabel = action.kind === 'create-group' ? t('Create') : t('Save');
      const submit = () => {
        const name = nameValue.trim();
        if (!name) return;
        if (action.kind === 'create-group') run(() => createDeviceGroup(apiBaseUrl, token, name));
        else if (action.kind === 'rename-group') run(() => renameDeviceGroup(apiBaseUrl, token, action.group.id, name));
        else run(() => renameDevice(apiBaseUrl, token, action.device.id, name));
      };
      return (
        <>
          <Text style={[styles.cardTitle, textSize(16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          <TextInput
            style={[styles.input, textSize(14), control(44)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            placeholder={action.kind === 'rename-device' ? t('Device name') : t('Group name')}
            placeholderTextColor="rgba(17,19,21,0.35)"
            value={nameValue}
            onChangeText={setNameValue}
            onSubmitEditing={submit}
            maxLength={50}
            autoFocus
          />
          {error ? <Text style={[styles.errorText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{error}</Text> : null}
          <View style={styles.cardButtons}>
            <Pressable style={[styles.cancelButton, control(40)]} onPress={onClose} disabled={busy}>
              <Text style={[styles.cancelText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, control(40), (!nameValue.trim() || busy) && styles.buttonDisabled]}
              disabled={!nameValue.trim() || busy}
              onPress={submit}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.primaryText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{submitLabel}</Text>}
            </Pressable>
          </View>
        </>
      );
    }

    // assign-groups
    const { device } = action as Extract<DeviceMgmtAction, { kind: 'assign-groups' }>;
    const toggleGroup = (groupId: string) => {
      setSelectedGroupIds((current) =>
        current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
      );
    };
    return (
      <>
        <Text style={[styles.cardTitle, textSize(16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Assign to groups')}</Text>
        <Text style={[styles.cardHint, textSize(12)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{device.name}</Text>
        {groups.length === 0 ? (
          <Text style={[styles.cardHint, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('No groups yet — create one from the + button first.')}</Text>
        ) : (
          groups.map((group) => {
            const checked = selectedGroupIds.includes(group.id);
            return (
              <Pressable key={group.id} style={styles.checkRow} onPress={() => toggleGroup(group.id)}>
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  {checked ? <Feather name="check" size={13} color="#fff" /> : null}
                </View>
                <Text style={[styles.checkLabel, textSize(14)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{group.name}</Text>
              </Pressable>
            );
          })
        )}
        {error ? <Text style={[styles.errorText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{error}</Text> : null}
        <View style={styles.cardButtons}>
          <Pressable style={[styles.cancelButton, control(40)]} onPress={onClose} disabled={busy}>
            <Text style={[styles.cancelText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, control(40), (busy || groups.length === 0) && styles.buttonDisabled]}
            disabled={busy || groups.length === 0}
            onPress={() => run(() => setDeviceGroups(apiBaseUrl, token, device.id, selectedGroupIds))}
          >
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.primaryText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Save')}</Text>}
          </Pressable>
        </View>
      </>
    );
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      {isSheet ? (
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { maxHeight: modalMaxHeight }]}>
          {/* Scrollable so a tall menu still reaches its first row on short
              windows (split-screen, foldable cover screens, iPad Split View). */}
          <ScrollView
            style={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {renderSheet()}
          </ScrollView>
        </SafeAreaView>
      ) : (
        <KeyboardAvoidingView
          behavior={'padding'}
          style={styles.cardWrap}
          pointerEvents="box-none"
        >
          {/* Scrollable so a long group list (or the on-screen keyboard) can
              never push the fields or the Add button out of reach. */}
          <View style={styles.card}>
            <ScrollView
              contentContainerStyle={styles.cardScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {renderCard()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,19,21,0.45)',
  },
  sheet: {
    width: '100%',
    // Mirrors the dialog card's cap so the rows stay near the thumb on tablets
    // and unfolded foldables instead of stretching the whole window width.
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sheetScroll: { flexShrink: 1 },
  sheetTitle: {
    fontWeight: '600',
    color: 'rgba(17,19,21,0.55)',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuLabel: { flex: 1, minWidth: 0, color: '#111315' },
  menuLabelDanger: { color: '#FF383C', fontWeight: '500' },
  cardWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    // Cap the height so a long group list scrolls inside the card instead of
    // pushing the fields and the Add button off-screen.
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  cardScrollContent: {
    gap: 10,
  },
  cardTitle: { fontWeight: '600', color: '#111315' },
  cardHint: { color: 'rgba(17,19,21,0.55)' },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,19,21,0.15)',
    paddingHorizontal: 12,
    color: '#111315',
  },
  errorText: { color: '#FF383C' },
  fieldLabel: { fontWeight: '600', color: 'rgba(17,19,21,0.55)', marginTop: 2 },
  dropdown: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.2)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropdownValue: { flex: 1, color: '#111315' },
  dropdownList: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.15)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownScroll: { maxHeight: 216 },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,29,33,0.06)',
  },
  dropdownItemText: { flex: 1, minWidth: 0, color: '#111315' },
  dropdownItemTextOn: { color: '#FF8A00', fontWeight: '600' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17,19,21,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 180,
  },
  chipOn: {
    backgroundColor: '#FF8A00',
    borderColor: '#FF8A00',
  },
  chipText: { fontSize: 13, color: '#111315' },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
  cardButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flexShrink: 1,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: 'rgba(17,19,21,0.6)' },
  primaryButton: {
    flexShrink: 1,
    minWidth: 104,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  primaryText: { fontWeight: '600', color: '#FFFFFF' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(17,19,21,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#FF8A00',
    borderColor: '#FF8A00',
  },
  checkLabel: { flex: 1, color: '#111315' },
}));
