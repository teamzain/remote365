import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SettingsHeader } from './SettingsScaffold';
import { fetchPlans, fetchSubscription, type Plan } from './billingApi';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { usePlayBilling } from './usePlayBilling';
import { isPurchasable } from './playProducts';

type Period = 'monthly' | 'yearly';
const YEARLY_DISCOUNT = 0.25; // 25% off when billed yearly

/**
 * Price to render.
 *
 * `playPrice` wins whenever Play has an offer for this plan: Play sets prices per country
 * and may change them, so showing the catalogue number instead of what Play will actually
 * charge is both wrong for the user and a Play policy rejection. The catalogue figures
 * below remain the fallback for iOS and for a device with no Play Store.
 */
function priceFor(plan: Plan, period: Period, t: (s: string) => string, playPrice?: string): string {
  if (typeof plan.price !== 'number') return t('Custom');
  if (plan.price === 0) return t('Free');
  if (playPrice) return playPrice;
  if (period === 'monthly') return `$${plan.price}/mo`;
  const yearly = Math.round(plan.price * 12 * (1 - YEARLY_DISCOUNT));
  return `$${yearly}/yr`;
}

function seatsLabel(plan: Plan, t: (s: string) => string): string {
  if (plan.maxUsers == null) return t('Unlimited members');
  return plan.maxUsers === 1 ? t('Single user') : `${t('Up to')} ${plan.maxUsers} ${t('members')}`;
}

export function UpgradePlanScreen({
  apiBaseUrl,
  authToken,
  onBack,
  onViewPrivacy,
}: {
  apiBaseUrl: string;
  authToken: string | null;
  onBack: () => void;
  onViewPrivacy?: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>('TRIAL');
  const [period, setPeriod] = useState<Period>('yearly');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [detailPlan, setDetailPlan] = useState<Plan | null>(null);
  const { gutter, type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t: translate } = useTranslation();

  const play = usePlayBilling(apiBaseUrl, authToken, (planId) => {
    setCurrentPlan(planId);
    setMessage({ tone: 'ok', text: `${translate("You're now on the")} ${planId.charAt(0) + planId.slice(1).toLowerCase()} ${translate('plan.')}` });
  });

  /** Play's localised price for a plan, or undefined when Play has no offer for it. */
  const playPriceFor = (plan: Plan): string | undefined =>
    play.available && isPurchasable(plan.id) ? play.prices[`${plan.id}:${period}`]?.displayPrice : undefined;

  const load = async () => {
    setLoading(true);
    try {
      const [catalog, sub] = await Promise.all([
        fetchPlans(apiBaseUrl),
        fetchSubscription(apiBaseUrl, authToken),
      ]);
      setPlans(Array.isArray(catalog) ? catalog : []);
      if (sub?.plan) setCurrentPlan(sub.plan);
    } catch {
      setMessage({ tone: 'err', text: translate('Could not load plans. Pull to retry.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentMeta = plans.find((p) => p.id === currentPlan);

  const handleUpgrade = async (plan: Plan) => {
    if (typeof plan.price !== 'number') {
      // Enterprise — no self-serve price; route to sales.
      void Linking.openURL('mailto:sales@remote365.ai?subject=Enterprise%20plan%20enquiry');
      return;
    }
    // Paid plans go through Google Play Billing. There is deliberately no fallback to the
    // old changePlan() call: that endpoint granted a paid plan with no payment, and
    // taking payment for in-app digital goods outside Play Billing is a policy violation.
    if (!isPurchasable(plan.id)) {
      setMessage({ tone: 'err', text: translate('That plan cannot be purchased from the app.') });
      return;
    }
    if (!play.available) {
      setMessage({ tone: 'err', text: translate('Google Play is unavailable, so plans cannot be changed here.') });
      return;
    }
    setMessage(null);
    await play.buy(plan.id, period);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <SettingsHeader title={translate('Upgrade Plan')} onBack={detailPlan ? () => setDetailPlan(null) : onBack} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 72, paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        {play.error ? (
          <Text style={[styles.message, styles.messageErr, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{play.error}</Text>
        ) : message ? (
          <Text style={[styles.message, message.tone === 'ok' ? styles.messageOk : styles.messageErr, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{message.text}</Text>
        ) : null}

        {detailPlan ? (
          /* ── Plan detail ── */
          (() => {
            const isCurrent = detailPlan.id === currentPlan;
            const busy = play.purchasing === detailPlan.id;
            return (
              <>
                <View style={styles.detailCard}>
                  <Text style={[styles.planTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{detailPlan.name} {translate('Plan')}</Text>
                  <View style={styles.detailBody}>
                    <Text style={[styles.planUser, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{seatsLabel(detailPlan, translate)}</Text>
                    <Text style={[styles.planPrice, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{priceFor(detailPlan, period, translate, playPriceFor(detailPlan))}</Text>
                    <Text style={[styles.planDescription, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{detailPlan.description}</Text>
                    {detailPlan.features.map((f) => (
                      <View key={f} style={styles.detailFeatureRow}>
                        <Feather name="check" size={13} color="#FF8A00" />
                        <Text style={[styles.detailFeatureText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Pressable
                  style={[styles.detailUpgrade, isCurrent && styles.upgradeButtonCurrent]}
                  disabled={isCurrent || busy}
                  onPress={() => handleUpgrade(detailPlan)}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.detailUpgradeText, isCurrent && styles.upgradeTextCurrent, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                      {isCurrent ? translate('Current plan') : typeof detailPlan.price !== 'number' ? translate('Contact sales') : `${translate('Upgrade to')} ${detailPlan.name}`}
                    </Text>
                  )}
                </Pressable>
              </>
            );
          })()
        ) : (
          /* ── Plan list ── */
          <>
            <View style={styles.currentButton}>
              <View style={styles.currentLeft}>
                <Feather name="check-circle" size={16} color="#FF8A00" />
                <Text style={[styles.currentText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{currentMeta ? `${currentMeta.name} ${translate('plan')}` : translate('Current plan')}</Text>
              </View>
              <Text style={[styles.currentBadge, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{translate('Current')}</Text>
            </View>

            <View style={styles.periodToggle}>
              <Pressable
                style={[styles.periodOption, period === 'monthly' && styles.periodOptionActive]}
                onPress={() => setPeriod('monthly')}
              >
                <Text style={[styles.periodText, period === 'monthly' && styles.periodTextActive, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{translate('Monthly')}</Text>
              </Pressable>
              <Pressable
                style={[styles.periodOption, period === 'yearly' && styles.periodOptionActive]}
                onPress={() => setPeriod('yearly')}
              >
                <Text style={[styles.periodText, period === 'yearly' && styles.periodTextActive, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{translate('Yearly')}</Text>
                <Text style={[styles.periodSave, textSize(11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>-25%</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loading}><ActivityIndicator color="#FF8A00" /></View>
            ) : (
              plans
                .filter((p) => p.price !== 0) // hide the free/trial tier from the upgrade list
                .map((plan) => {
                  const isCurrent = plan.id === currentPlan;
                  const busy = play.purchasing === plan.id;
                  return (
                    <Pressable key={plan.id} style={[styles.planCard, { paddingHorizontal: gutter < 16 ? 14 : 24 }, plan.popular && styles.planCardPopular]} onPress={() => setDetailPlan(plan)}>
                      <View style={styles.planLeft}>
                        <View style={styles.planTitleRow}>
                          <Text style={[styles.planTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{plan.name} {translate('Plan')}</Text>
                          {plan.popular ? <Text style={[styles.popularBadge, textSize(9)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{translate('Popular')}</Text> : null}
                        </View>
                        <View style={styles.planDetails}>
                          <Text style={[styles.planUser, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{seatsLabel(plan, translate)}</Text>
                          <Text style={[styles.planPrice, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{priceFor(plan, period, translate, playPriceFor(plan))}</Text>
                          <Text style={[styles.planDescription, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={2}>{plan.description}</Text>
                        </View>
                      </View>
                      <Pressable
                        style={[styles.upgradeButton, isCurrent && styles.upgradeButtonCurrent]}
                        disabled={isCurrent || busy}
                        onPress={() => handleUpgrade(plan)}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={[styles.upgradeText, isCurrent && styles.upgradeTextCurrent, type(12, 16 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                            {isCurrent ? translate('Current') : typeof plan.price !== 'number' ? translate('Contact') : translate('Upgrade')}
                          </Text>
                        )}
                      </Pressable>
                    </Pressable>
                  );
                })
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onViewPrivacy}>
          <Text style={[styles.footerMain, type(11, 15 / 11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{translate('Privacy Policy')}</Text>
        </Pressable>
        <Text style={[styles.footerSub, type(9, 12 / 9)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{`Copyright 2026 © Remote 365. ${translate('All rights reserved.')}`}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  screen: { backgroundColor: 'transparent', flex: 1 },
  content: {
    gap: 16,
    paddingBottom: 80,
    paddingHorizontal: 16,
    paddingTop: 20,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center'
  },
  currentButton: {
    alignItems: 'center',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
    minHeight: 44,
    paddingVertical: 10,
    gap: 8
  },
  currentLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    minWidth: 0
  },
  currentText: {
    color: '#111315',
    fontWeight: '500',
    flexShrink: 1
  },
  currentBadge: { color: '#FF8A00', fontWeight: '600' },
  periodToggle: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3,
    width: '100%',
  },
  periodOption: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 44,
    flexWrap: 'wrap'
  },
  periodOptionActive: { backgroundColor: '#FFFFFF', elevation: 1 },
  periodText: { color: 'rgba(17,19,21,0.6)', fontWeight: '500' },
  periodTextActive: { color: '#111315' },
  periodSave: { color: '#12B76A', fontWeight: '700' },
  message: { fontWeight: '500' },
  messageOk: { color: '#12B76A' },
  messageErr: { color: '#D92D20' },
  loading: { paddingVertical: 40 },
  // Figma: white card, 0.5px border, radius 4, padding 12/24, row layout with a
  // left info column and a compact orange button on the right.
  planCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 0.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '100%',
    gap: 12,
    flexWrap: 'wrap'
  },
  planCardPopular: { borderColor: '#FF8A00', borderWidth: 1 },
  planLeft: { flex: 1, gap: 4, minWidth: 0 },
  planTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  planTitle: { color: '#111315', fontWeight: '500' },
  popularBadge: {
    backgroundColor: 'rgba(255,138,0,0.12)',
    borderRadius: 20,
    color: '#FF8A00',
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  planDetails: { gap: 8, marginTop: 4, width: '100%' },
  planUser: { color: '#111315', fontWeight: '400' },
  planPrice: { color: '#111315', fontWeight: '600' },
  planDescription: { color: '#111315', fontWeight: '400' },
  upgradeButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: 14,
    minHeight: 44,
    paddingVertical: 10
  },
  upgradeButtonCurrent: { backgroundColor: '#F3F4F6' },
  upgradeText: { color: '#FFFFFF', fontWeight: '500' },
  upgradeTextCurrent: { color: 'rgba(17,19,21,0.5)' },
  // Detail view
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 0.5,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  detailBody: { gap: 12, marginTop: 4, width: '100%' },
  detailFeatureRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, width: '100%' },
  detailFeatureText: { color: '#111315', flex: 1, fontWeight: '400' },
  detailUpgrade: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  detailUpgradeText: { color: '#FFFFFF', fontWeight: '600', textAlign: 'center' },
  footer: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%'
  },
  footerMain: { color: 'rgba(26, 29, 33, 0.6)', textAlign: 'center', textDecorationLine: 'underline' },
  footerSub: { color: 'rgba(26, 29, 33, 0.5)', textAlign: 'center' },
}));
