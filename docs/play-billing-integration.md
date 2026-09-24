# Google Play Billing — Remote365 Mobile

Decision (2026-08-21): subscriptions in the Android viewer go through Google Play Billing
rather than hiding the purchase UI. Google takes 15–30%. This replaces the current
`PATCH /api/billing/my-plan` path, which is marked "(test mode)" in
`apps/auth-service/src/routes/billing.ts` and grants paid plans with **no payment at all**.

## Why this is not a swap

There is no existing payment integration to redirect. Stripe fields survive on the
`Subscription` model (`stripeCustomerId`, `stripeSubscriptionId`) but the live path never
charges anybody. Play Billing is therefore a first payment implementation, including the
server-side entitlement model that has never existed.

## Products to create in Play Console

Enterprise stays "contact sales" — it has no self-serve price and is not a digital purchase.

| Plan | Product ID | Base plans |
|---|---|---|
| Solo ($15/mo) | `remote365_solo` | `solo-monthly`, `solo-yearly` |
| Pro ($40/mo) | `remote365_pro` | `pro-monthly`, `pro-yearly` |
| Business ($100/mo) | `remote365_business` | `business-monthly`, `business-yearly` |

Product IDs are permanent. Prices are set **in the console**, per-country, and the app must
display the price Play returns — never the hard-coded numbers in
`packages/shared/src/plans.ts`. Showing a price that differs from Play's is a rejection.

## Sequencing — the long-lead items block everything

1. **Payments profile / merchant account.** Required before any subscription product can
   exist. Approval takes days and needs business identity and a bank account. **Start now.**
2. **Upload a build to Internal testing.** Subscription products cannot be created until
   the app has a build. Internal testing is private, is not reviewed like production, and
   does not start the 14-day closed-testing clock — so upload the current AAB purely to
   unblock product creation.
3. **Create the three subscription products** with the IDs above.
4. **Google Cloud service account** for server-side verification: link a Cloud project to
   Play, enable the Google Play Android Developer API, create a service account, download
   the JSON key, then grant it "View financial data" in Play Console → Users and
   permissions. Propagation can take up to 24h.
5. **Pub/Sub topic** for Real-time Developer Notifications (renewals, cancellations,
   refunds, grace periods).
6. **License testers** — Play Console → Setup → License testing. Testers buy without being
   charged. This is the only way to test the flow.
7. Then, and only then, the 14-day closed test with 12 testers.

## Client

Library: `expo-iap` (peer `expo: *`, no nitro-modules dependency, unlike
`react-native-iap` v16).

Flow:
- Fetch subscriptions by product ID; render **Play's** localized price strings.
- Launch the purchase flow for the chosen base plan.
- On success, send `{ packageName, productId, purchaseToken }` to the backend.
- Only after the backend confirms entitlement, finish the transaction.

`UpgradePlanScreen` keeps its layout but `handleUpgrade` no longer calls
`changePlan()`. On Android the whole pricing source becomes Play.

## Backend

New: `POST /api/billing/google-play/verify`

- Verifies via `purchases.subscriptionsv2.get` with the service account.
- Maps `productId` → `PlanDef`, writes `Subscription` (plan, status, `currentPeriodEnd`).
- Stores `purchaseToken` and `linkedPurchaseToken` for upgrade/downgrade chains.
- **Acknowledges the purchase within 3 days or Google auto-refunds it.**
- Rejects a `purchaseToken` already bound to a different user (replay).

New: `POST /api/billing/google-play/rtdn` — Pub/Sub push endpoint for renewals,
cancellations, refunds, grace periods. Without it, a cancelled subscription keeps working.

Schema additions to `Subscription`: `googlePlayPurchaseToken`, `googlePlayProductId`,
`platform` (`STRIPE` | `GOOGLE_PLAY` | `MANUAL`).

## Must fix regardless of Play

`PATCH /api/billing/my-plan` lets any OWNER move themselves onto a paid plan for free.
That is live in production today. It has to be closed or removed as part of this work.

## Build status (2026-08-21)

### Done — client

- `apps/remote-365-mobile/src/settings/playProducts.ts` — plan ↔ product/base-plan mapping
- `.../usePlayBilling.ts` — connect, fetch offers, purchase, verify-then-finish
- `.../billingApi.ts` — `verifyPlayPurchase()`
- `.../UpgradePlanScreen.tsx` — renders Play's `displayPrice`; the `changePlan()` call is gone
- `expo-iap` installed and registered as a config plugin; the BILLING permission merges in
  from the library's own manifest

### Done — backend

- `packages/shared/prisma/schema.prisma` + migration `20260821000000_add_google_play_billing`:
  `platform` (`MANUAL` | `STRIPE` | `GOOGLE_PLAY`), `googlePlayPurchaseToken` (UNIQUE),
  `googlePlayProductId`
- `apps/auth-service/src/utils/googlePlayBilling.ts` — service-account client for
  `purchases.subscriptionsv2.get` and `purchases.subscriptions.acknowledge`
- `POST /api/billing/google-play/verify` in `routes/billing.ts`

Properties the endpoint holds:

- The **product comes from Google**, never from the request body, so a client cannot buy
  Solo and claim Business.
- The purchase token is UNIQUE and a token bound to another user is rejected, so one
  purchase cannot entitle several accounts.
- Entitlement is written **before** acknowledgement. A crash between the two leaves the
  purchase unacknowledged, and Google refunds it — the user is never charged for access
  they did not get.
- Missing service-account config answers **503**, not 500. The app then leaves the
  transaction unfinished and Google refunds it.

Configure with `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` and `GOOGLE_PLAY_PACKAGE_NAME`
(documented in `.env.production.example`).

### Done — expiry and lifecycle

- `POST /api/billing/google-play/rtdn` — Pub/Sub push endpoint. Authenticity is enforced
  via `GOOGLE_PLAY_RTDN_SECRET` (URL secret) or `GOOGLE_PLAY_RTDN_AUDIENCE` (OIDC push
  auth). With neither set it refuses every push rather than trusting the internet.
- `reconcilePlayPurchase()` — re-reads the purchase from Google on **every** notification
  rather than switching on `notificationType`. Pub/Sub is at-least-once and out of order,
  so acting on an event's own claim can apply a stale "renewed" over a newer "cancelled".
  Re-reading is idempotent and converges.
- `packages/shared/src/plan-entitlement.ts` — `effectivePlanId` extracted out from behind
  the Prisma import so the entitlement decision is testable standalone. 9 tests in
  `plan-entitlement.test.mts`, run with `npm test -w @remotelink/shared`.

Expiry is enforced for `GOOGLE_PLAY` rows **only**, and that restriction is load-bearing:
`applyPlanChange` never sets `currentPeriodEnd`, so MANUAL rows carry whatever date the
user's trial had — usually one in the past. Enforcing expiry on those would have
mass-downgraded every account that had ever changed plan. There is a test pinning this.

The expiry check is the safety net for a dropped notification: a missed
SUBSCRIPTION_EXPIRED degrades to "access ends at period end" instead of "access forever".

### Still open

- RTDN needs the Pub/Sub topic created and the push subscription pointed at the endpoint.
- ~~`PATCH /api/billing/my-plan` grants paid plans for free~~ — **fixed**. The route now
  returns 402 for anything that is not literally free, mirroring the guard that already
  protected the twin route in `billing-service`, and 409 when the subscription is managed
  by Google Play (cancelling there has to happen in the Play Store, or the user would hold
  a free plan while Google kept charging them). The bypass is `BILLING_TEST_MODE=true`,
  which is `false` in `.env.production.example` and `true` on preprod for QA.
  **Verify the deployed production `.env` has it false or absent** — auth-service reads
  `env_file: .env`, so a stray `true` there reopens the hole.
- Nothing has been tested against real Play infrastructure — that needs the service
  account key and products, which are blocked on the payments profile.
