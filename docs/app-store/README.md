# App Store submission kit — Remote365 for iOS

**Since 19 Nov 2026 the iOS app ships from the Muhammad Imtiaz developer account**, not Kinseb LLC:

| | |
|---|---|
| Apple team | `8UP23W8RPW` (Individual, Muhammad Imtiaz), Apple ID sales@techvision365.com |
| App Store Connect app | `6836702539`, name **Remote365**, SKU `remote365-ios` |
| Bundle ID | `ai.remote365.mobile` (+ `ai.remote365.mobile.BroadcastExtension`) |
| App Group | `group.ai.remote365.mobile.broadcast` |
| Capabilities | Push Notifications, App Groups, Sign in with Apple, In-App Purchase |
| Signing | Apple Distribution cert `7N3YHTS2ZY` (expires 2027-11-19), profiles "Remote365 App Store" and "Remote365 Broadcast App Store" |
| Upload key | App Store Connect API key `NF6MLBQ67T` (App Manager), issuer `02279965-0ca0-4403-9ed0-65c2bbaa05be` |
| EAS profiles | build + submit `ios-production` (talks to `https://remote365.ai`) |
| Source | `apps/remote-365-mobile` |

The old Kinseb record (app `6807023936`, bundle `com.remote365.mobile`, team `TG52K552J4`) is no longer used for iOS; the bundle ID cannot move between teams. Android keeps `com.remote365.mobile`.

All signing files live in `apps/remote-365-mobile/credentials/` and `apps/remote-365-mobile/credentials.json` (both git-ignored and excluded from the EAS archive by `.easignore`). Back them up somewhere safe: the API key `.p8` cannot be downloaded again.

## Build and upload

From `apps/remote-365-mobile` (Git Bash):

```text
EAS_NO_VCS=1 EAS_PROJECT_ROOT='D:\Work\remote365' eas build --platform ios --profile ios-production --non-interactive --no-wait
EAS_NO_VCS=1 EAS_PROJECT_ROOT='D:\Work\remote365' eas submit --platform ios --profile ios-production --id <build id> --non-interactive
```

`autoIncrement` bumps `ios.buildNumber` in `app.json`; commit it after each build. If App Store Connect rejects an upload, the reason is in the API resource `GET /v1/apps/6836702539/buildUploads` (EAS only reports that the upload itself succeeded).

## Status against the review checklist

| Item | Status | Where |
|---|---|---|
| Sign in with Apple | **Done** — iOS button on sign-in/sign-up; `POST /api/auth/apple` verifies the identity token (audience `ai.remote365.mobile`) | `src/auth/AuthScreen.tsx`, `apps/auth-service/src/routes/auth.ts`, `utils/appleIdentity.ts` |
| In-app purchase | **Done in code** — StoreKit 2 on iOS, server-verified (`/api/billing/app-store/verify`), App Store Server Notifications V2 at `https://remote365.ai/api/billing/app-store/notifications` (set for production and sandbox) | `src/settings/useAppStoreBilling.ts`, `apps/auth-service/src/routes/billing.ts`, `utils/appStoreBilling.ts` |
| Subscription products | **Created** — group "Remote365 Plans", six products `remote365_{solo,pro,business}_{monthly,yearly}`, USA base price + equalized prices in 175 territories | App Store Connect → Monetization → Subscriptions |
| Paid Apps Agreement | **Blocked on you** — status "New". Sign it and add bank + tax details under Business; until then subscriptions cannot be sold or sandbox-tested | App Store Connect → Business |
| Subscription review screenshot | **To do** — each subscription needs one screenshot of the Upgrade screen before it can be submitted with the app | after the TestFlight build runs on a phone |
| Restore / EULA / auto-renew text | **Done** — on the Upgrade screen (iOS) | `UpgradePlanScreen.tsx` |
| Privacy policy | **Updated** — Apple/Microsoft sign-in, store payments, push token, session data, in-app deletion | `apps/web/src/components/site/legal/PrivacyPolicy.tsx` |
| Account deletion inside the app | **Already shipped** | `src/settings/AccountScreen.tsx` |
| Review account | **Production account script ready** — `node scripts/prepare-apple-review-account-prod.cjs --create` (one-year trial, so reviewers can test buying a plan) | [review-notes.md](review-notes.md) |
| Screenshots | **Ready** (composed from Android captures); replace with real iOS captures from TestFlight when possible | `screenshots/out/` |
| Description, keywords, category, age rating | **Ready to paste** — add "Apple" to the sign-in sentence, and the Terms of Use link (subscriptions) | [listing.md](listing.md) |
| App Privacy answers | **Ready** — add "Purchases" (Purchase History, linked, app functionality) now that StoreKit ships | [app-privacy.md](app-privacy.md) |

## Notes

- Sandbox purchases (TestFlight, App Review) are accepted by the production server on purpose: App Review always buys in the sandbox. Sandbox subscriptions expire within hours, so a free TestFlight purchase only entitles briefly.
- The app icon source is `assets/logo.png` at 500×500; Expo upscales it to the 1024×1024 App Store icon. Supply a 1024 master to avoid a soft icon.
- `ITSAppUsesNonExemptEncryption` is `false`, so there is no export-compliance prompt per build.
- The Broadcast extension (screen sharing in meetings) is created by `plugins/withIosScreenShare.js`. Build 1.0.0 (2) was rejected with ITMS-90085 because the extension compiled no sources; fixed in 2f77520.
