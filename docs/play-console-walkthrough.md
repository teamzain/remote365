# Play Console — what to do, in order

Personal developer account. Package `com.remote365.mobile`. Everything below is Play
Console unless it says Google Cloud.

The order matters: steps 1 and 5 have multi-day lead times and block everything downstream.

---

## 1. Payments profile — start first, takes days

**Monetize → Payments profile → Create payments profile.**

Needs your legal name/business identity, address, and a bank account that can receive
international payments (you are in PK; confirm the account accepts USD wire or the local
payout method Google offers there).

Nothing about subscriptions can be created or tested until this is approved. Start it
before anything else.

## 2. Create the app

**All apps → Create app.**

| Field | Value |
|---|---|
| App name | `Remote365: Remote Access` |
| Package name | `com.remote365.mobile` |
| Default language | English (United States) |
| App or game | App |
| Free or paid | **Free** |

"Free" is correct even though the app sells subscriptions: paid-vs-free refers to an
upfront install price. Subscriptions are in-app products.

## 3. Upload the AAB to Internal testing

**Testing → Internal testing → Create new release.**

Upload `app-release.aab`. Internal testing is private, capped at 100 named testers, and
does **not** start the 14-day closed-testing clock — so nothing is wasted by uploading
here first. You need a build on file before subscription products can be created.

First upload will ask you to enrol in **Play App Signing**. Accept it. Google generates
the app signing key; your keystore becomes the *upload* key.

Add yourself as a tester and create the email list, or the release cannot roll out.

## 4. Create the subscription products

**Monetize → Products → Subscriptions → Create subscription.**

Three products. Product IDs are permanent — a typo means a new product and migrating
subscribers.

| Product ID | Name | Base plans |
|---|---|---|
| `remote365_solo` | Solo | `solo-monthly`, `solo-yearly` |
| `remote365_pro` | Pro | `pro-monthly`, `pro-yearly` |
| `remote365_business` | Business | `business-monthly`, `business-yearly` |

For each: add the two base plans, set renewal period (monthly / yearly), set prices, then
**activate** both the base plans and the subscription. An inactive base plan returns no
offer and the app shows the plan as unavailable.

Base plan IDs must match exactly — the app looks up offers by `basePlanIdAndroid`.

## 5. Service account for server-side verification — also slow

The backend cannot confirm a purchase without this.

1. **Play Console → Setup → API access.** Link a Google Cloud project (create one if
   needed).
2. In **Google Cloud Console** for that project: enable **Google Play Android Developer
   API**.
3. Google Cloud → IAM & Admin → Service Accounts → create one → **Keys → Add key → JSON**.
   Download it.
4. Back in **Play Console → Users and permissions → Invite user**, add the service
   account's email, and grant **View financial data, orders, and cancellation survey
   responses** plus access to this app.
5. Wait. Permission propagation takes **up to 24 hours** — verification returns 401 until
   it lands, which is expected, not a bug.

Then set on the server (see `.env.production.example`):

    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=<the entire JSON key file, one line>
    GOOGLE_PLAY_PACKAGE_NAME=com.remote365.mobile

## 6. Real-time Developer Notifications

Without this, cancellations and refunds never reach the backend.

1. **Google Cloud → Pub/Sub → Create topic**, e.g. `play-rtdn`.
2. Grant `google-play-developer-notifications@system.gserviceaccount.com` the
   **Pub/Sub Publisher** role on that topic. Play cannot publish without it.
3. Create a **push subscription** on the topic with endpoint:

       https://remote365.ai/api/billing/google-play/rtdn?secret=<your secret>

4. Set the matching `GOOGLE_PLAY_RTDN_SECRET` on the server. (Or use OIDC push auth and
   set `GOOGLE_PLAY_RTDN_AUDIENCE` instead — stronger, slightly more setup.)
5. **Play Console → Monetize → Monetization setup → Real-time developer notifications**,
   paste the topic name, and hit **Send test notification**. The endpoint answers 200 and
   logs `received RTDN test notification`.

## 7. License testers — test purchases without paying

**Play Console → Setup → License testing.** Add the Google accounts that will test.

Listed testers buy subscriptions without being charged, and renewals are accelerated
(a monthly sub renews in minutes) so the whole lifecycle is testable in an afternoon.

Test in this order:
1. Buy a plan → confirm the backend writes the entitlement and the plan changes in-app.
2. Cancel in Play Store → confirm an RTDN arrives and `cancelAtPeriodEnd` flips.
3. Let it expire → confirm access drops to TRIAL.
4. Refund from the console → confirm access is revoked.

Do not skip 2–4. Taking money is the easy half; stopping is the half that goes wrong.

## 8. App content declarations

**Policy → App content.** Complete every section — they gate all release tracks.

See `docs/play-store-submission-viewer.md` for the filled-in answers: privacy policy URL,
Data Safety, permission justifications, and the demo account for App access. A reviewer
who cannot sign in rejects the build, so the demo credentials are not optional.

## 9. Closed testing — the 14-day clock

**Testing → Closed testing → Create release.**

Personal accounts must run a closed test with **at least 12 testers opted in, continuously
for 14 days**, before production access can be requested. The count is of testers who
actually opted in via the link — not invitations sent.

Recruit the 12 before starting so the clock is not restarted by a dropout.

## 10. Apply for production

After 14 continuous days: **Play Console prompts to apply.** Answer the questionnaire
about your testing. Approval is manual and typically takes a few days.

Then **Production → Create release**, promote the tested build, and submit for review.

---

## Realistic timeline

| | |
|---|---|
| Payments profile approval | 2–7 days |
| Service account permission propagation | up to 24h |
| Closed testing | 14 days, minimum |
| Production access review | a few days |
| Final production review | 1–7 days |

Start the payments profile and recruit testers today; those two dominate everything else.
