# Remote365 Mobile iOS preprod release

- App source: `apps/remote-365-mobile` (viewer; not Android Host).
- Apple account: Kinseb LLC, team `TG52K552J4`.
- Bundle ID: `com.remote365.mobile`.
- App Store Connect app ID: `6807023936`.
- Expo owner/project: `zainuul/remote-365-mobile`.
- EAS project ID: `43f2bc6b-79c6-446f-ad90-9b4752e0b976`.
- Build/submit profile: `ios-preprod`.
- Backend: `https://pp.remote365.ai`, explicitly set in the build profile.

## Signing

The App Store profile `Remote365 Mobile App Store` (portal ID `67QCUAN5DA`)
was generated for Remote365 using the existing Kinseb distribution certificate
expiring August 26, 2027. Existing Memora profiles were not changed.

`scripts/prepare-remote365-ios-credentials.ps1` validates the downloaded profile's
signature, app identifier, distribution type, expiry, and matching certificate,
then generates an ignored local `credentials.json` without printing its password.
The local credential references point to files outside this project. Keep those
files available when building, or regenerate the references after moving them.

Signing files are excluded from both Git and the source archive. EAS receives
local signing credentials separately for the explicitly authorized signed build.
Do not commit or share these files, and do not put their contents in logs.

## Building on Windows

From the mobile app directory, set `EAS_NO_VCS=1` and `EAS_PROJECT_ROOT` to the
absolute monorepo root, then run:

```text
npx eas-cli build --platform ios --profile ios-preprod --non-interactive --no-wait
```

The root `.easignore` limits the archive to this app and its build prerequisites.
Use `eas build:inspect --platform ios --profile ios-preprod --stage archive
--output <new-directory>` to review the upload contents after changing the rules.

## Submission

Build `621b5ba9-2a50-41cc-ac33-8f90a04706b0` finished successfully on August 31,
2026. The downloaded IPA was verified as version `1.0.0`, build `2`, bundle ID
`com.remote365.mobile`, built with the iOS 26.0 SDK. Its bundled JavaScript
contains `https://pp.remote365.ai` and not `https://remote365.ai`.

After the user completed Apple's API-access step and explicitly approved key
creation and transmission to Expo, the team API key `Remote365 EAS Upload` was
created with the Developer role. Its local `.p8` is ignored by Git and excluded
from the source archive. Team keys apply across the team's apps and persist
until revoked; the name does not restrict the key to Remote365.

EAS submission `4d261383-158c-4ab4-a738-d201e4472ade` successfully uploaded build
`1.0.0 (2)` to App Store Connect on August 31, 2026. Apple processing follows
the upload. Tester assignment and public App Store review/release are separate
steps; this submission did not publicly publish the app.

## Dedicated beta-review account

An isolated `Remote365 Apple Review` organization was created on the confirmed
preprod server `206.189.127.215`. It has a dedicated owner account, a manual
BUSINESS test entitlement without an expiry, no Stripe subscription, and no
customer devices. Login and `/api/auth/me` were verified successfully.
The generated password is stored only in the Git-ignored local file
`apps/remote-365-mobile/credentials/apple-review-account.json`; never commit or
include that file in a source archive. No production data was changed.

The review credentials and contact details were entered into Apple's beta-review
form. After explicit user confirmation, build `1.0.0 (2)` was submitted and Apple
showed **Waiting for Review**. The build is assigned to `Remote365 Invited Testers`
(external) and the empty `Remote365 Private Testing` internal group. The external
group's public link remains enabled as requested:
`https://testflight.apple.com/join/Y9u46hgc`. No email tester was added and Memora groups
were not changed. Full remote-control testing still requires a separate compatible
preprod host; account login verification alone is not end-to-end iOS testing.

Building does not upload to TestFlight or publish on the App Store. EAS Submit
requires a separately authorized Apple upload credential. Public release also
requires store metadata, review access, privacy/age-rating declarations, and iOS
functional testing. Subscription upgrades currently use Android Play Billing and
need an iOS-specific implementation or product decision before public release.
