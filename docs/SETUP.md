# Rozkaam — What to sign up for (zero cost first)

Checked on **18 Nov 2026** against each provider's own pricing or docs page. Free plans change, so re-check the linked page before relying on a number. "Not confirmed" means the provider's page did not state it.

Create every account with a **new Rozkaam email address** (for example a fresh Gmail), not a personal one, so the company owns them.

---

## 1. Sign up now — free, and enough to build and test everything

| # | What it is for | Service | Sign-up link | Free allowance | Card needed |
|---|---|---|---|---|---|
| 1 | Code storage | GitHub | https://github.com/signup | Free private repositories | No |
| 2 | **Database** (Postgres) | Neon | https://console.neon.tech/signup | 1 GB storage per project, 100 compute-hours per project per month; sleeps after 5 idle minutes | No |
| 3 | **Photo storage** (KYC, check-in photos) | Cloudflare R2 | https://dash.cloudflare.com/sign-up | 10 GB storage, 1 million writes and 10 million reads a month, free downloads | Not confirmed |
| 4 | **API hosting** (the backend server) | Render | https://dashboard.render.com/register | Free web service, 750 hours a month; sleeps after 15 idle minutes and takes about a minute to wake | Not confirmed |
| 5 | Admin panel hosting | Cloudflare Pages (same account as #3) | https://dash.cloudflare.com/sign-up | Free static site hosting | Not confirmed |
| 6 | **Email** (confirmations, invoices, email OTP) | Resend | https://resend.com/signup | 3,000 emails a month, 100 a day | Not confirmed |
| 7 | **Push notifications** | Expo push service | https://expo.dev/signup | Free, no per-message cost | No cost stated |
| 8 | **App builds** (Android and iOS files) | Expo EAS (same account as #7) | https://expo.dev/signup | 15 Android and 15 iOS builds; slower queue | Not confirmed |
| 9 | **Payments, test mode** | Razorpay | https://dashboard.razorpay.com/signup | Test mode is free with no time limit; no real money moves | No |
| 10 | Error tracking | Sentry | https://sentry.io/signup/ | 5,000 errors a month, 1 user | Not confirmed |

With these ten, the whole platform can run end to end in test mode at zero cost.

Rows 1 (GitHub) and 5 (Cloudflare Pages) were not re-checked on 18 Nov 2026; their free plans are long-standing, but confirm on sign-up.

### Things that need no account at all

- **Timestamps.** Check-in, check-out and payment times come from the **server's own clock**, which the host keeps in sync automatically. No time service is needed. The app never trusts the phone's clock, because a worker could change it.
- **Location.** The phone's GPS is free. The distance to the venue is calculated on our server.
- **Maps inside the mobile app.** Google's map view for mobile apps is free without a usage cap. Searching for an address is a separate service: free up to a monthly limit on India pricing, and it needs a Google Cloud billing account.

---

## 2. OTP login — the one thing with no free option in India

There is **no genuinely free SMS OTP service for India**. Every option is paid per message, and branded SMS needs DLT registration (a TRAI rule).

| Option | Cost | What it needs | When to use |
|---|---|---|---|
| **Sandbox code** (built in now) | Free | Nothing | Building and internal testing |
| **Email OTP** via Resend | Free within 100 emails a day | A domain you own | Testing with real outside users before SMS is ready |
| **MSG91 SMS OTP** — https://msg91.com | About ₹0.18–₹0.25 per SMS plus 18% GST, prepaid wallet | Account KYC; DLT registration for a branded sender | Launch |
| **Firebase phone login** — https://console.firebase.google.com | Billed per SMS on the paid "Blaze" plan (India price not confirmed on Google's page) | A billing account with a card | Alternative to MSG91 |
| **WhatsApp OTP** (Meta) — https://developers.facebook.com | Charged per message | Meta business verification | Later option |

**Plan:** keep the sandbox code while building, then switch on MSG91 at launch. For 1,000 logins a month that is roughly ₹250–₹300.

**DLT registration** needs PAN, identity and address proof, and GST details. Start it early because approval takes a few days. The fee is unclear: one MSG91 page says ₹5,000 + GST per operator, another says registration is free on one operator's portal. Confirm with MSG91 support before paying.

---

## 3. Sign up later — these cost money or need company documents

| What | Cost | Needs | When |
|---|---|---|---|
| **Domain** (e.g. rozkaam.com / rozkaam.in) | About US$10 a year for a .com | A card | Before sending real email or launching |
| **Google Play** developer account — https://play.google.com/console/signup | US$25 once | A company account needs a D-U-N-S number (free to obtain). A personal account must run a 14-day test with 12 testers before going public | About a month before Android launch |
| **Apple Developer** — https://developer.apple.com/programs/enroll/ | US$99 a year | A company account needs a D-U-N-S number and a registered legal entity | Before iOS launch |
| **Razorpay live mode** | About 2% per transaction plus GST on that fee | KYC: PAN, bank account, business documents | When taking real money |
| **Payouts to workers** (RazorpayX or Cashfree) | Charged per transfer (Cashfree lists ₹3–₹15) | Activated account with business documents | When paying real workers |
| **KYC checks** (Setu, Surepass, HyperVerge, IDfy) | Paid per check; most price through sales | A sales conversation | After launch. Until then the ops team reviews the uploaded ID and selfie by hand, which is free |
| **Always-on API hosting** | From about US$5–7 a month | A card | At launch, because the free Render server sleeps |

**Start now, because it is free and slow:** apply for a **D-U-N-S number** for the company. Both app stores need it for a company account.

---

## 4. What I need from you after signing up

Do **not** paste passwords or secret keys into chat. Each service gives "API keys"; you will put them into a file on your computer named `.env`, and I will tell you exactly which line each one goes on.

1. Neon: the database connection string.
2. Cloudflare R2: bucket name, account ID, access key and secret.
3. Resend: API key.
4. Razorpay: **test** key ID and secret (they start with `rzp_test_`).
5. Expo: just your account name; you log in on your computer.
6. Sentry: the project "DSN".

Until those exist, everything runs on your computer with a built-in database and the sandbox services, at zero cost.

---

## 5. Honest summary of cost

| Stage | Monthly cost |
|---|---|
| Building and internal testing | **₹0** |
| Testing with real outside users (email OTP, free hosting) | **₹0**, plus about ₹900 a year for a domain |
| Launch | SMS OTP (about ₹0.25 each), always-on hosting (about ₹500 a month), store fees (US$25 once, US$99 a year), payment fees (about 2% of money collected), payout fees per transfer |
