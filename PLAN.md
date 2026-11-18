# Rozkaam Platform — Build Plan (v1)

Status: **draft for review**. Nothing has been built yet.
Sources: the investor deck (31 slides), the Master Company Knowledge doc, and the brand files in `ROZKAAM LOGO FINAL`.

Decisions so far:
- **Native mobile apps** for workers and businesses, plus a web admin panel.
- **Sandbox first:** login, KYC and payments run in test modes. Live providers get swapped in once company accounts exist.
- **One app name, "Rozkaam", for workers and businesses.** A person picks "I want work" or "I need workers" at sign-up. (It can still be split into two store listings later with a build setting.)
- **Android and iOS both.**
- **Rozkaam's ops team approves applicants** in the admin panel. Businesses see who is confirmed but do not pick.
- **English only for v1.**
- **Commission is not decided yet,** so both the rate and who bears it are admin settings (see §3).
- **New accounts for Rozkaam** for hosting, stores and providers. None of your existing accounts or other projects are used.
- **Work stays inside this folder.** No outside links or files.

---

## 1. What v1 must do

v1 is the "Now, funded by this round" column of the roadmap, and nothing beyond it:

| Area | v1 must-haves |
|---|---|
| Accounts | Phone + OTP login for workers, businesses, admins |
| KYC | Worker ID + selfie, business documents; reviewed by admin |
| Jobs | Business posts a requirement with all the knowledge doc's fields |
| Discovery | Workers see nearby jobs (10–15 km), filter by category and pay, with the pay shown upfront |
| Matching | Worker applies → Rozkaam ops team approves → confirmed; waitlist when full |
| Reminders | In-app + push notifications: confirmation, ~2 h before start, changes |
| Attendance | Check-in and check-out with a photo, GPS and timestamp. A check-in more than ~500 m from the job location is flagged. |
| Completion | Business approves attendance → worker payouts released |
| Payments | Business funds the requirement before it goes live; worker wallet; withdrawal requests |
| Reputation | Two-way ratings; work history; reliability strikes |
| Reliability | Free cancel ≥12 h before start; late cancel / no-show = strike; repeat strikes → lower priority → restriction → suspension (admin decides bans; emergencies can be excused) |
| Admin | KYC queues, users, jobs, attendance disputes, payouts, strikes, platform settings, dashboard |

**Not in v1** (later roadmap): automated matching/ranking, demand forecasting, subscriptions, multi-location enterprise, APIs, multi-language UI (the plan is to add Malayalam first).

---

## 2. Architecture

```
rozkaam/                      (its own git repo; today the folder sits inside your home-folder repo)
├─ apps/
│  ├─ api/        Node + Hono + Drizzle ORM + Postgres   → REST API, the one system of record
│  ├─ mobile/     Expo (React Native) + Expo Router      → ONE app, "Rozkaam", Android + iOS:
│  │                 • worker side    (after choosing "I want work")
│  │                 • business side  (after choosing "I need workers")
│  └─ admin/      React + Vite web panel                 → ops team
├─ packages/
│  └─ shared/     types, zod validation, API client, money/time helpers, brand tokens
└─ docs/          PLAN.md, API.md, DEPLOY.md, CHECKLIST.md
```

Why these choices:
- **One mobile app for both sides.** Workers and businesses share login, design system, API client and notifications. The account type chosen at sign-up decides which screens a person sees. One store listing, one name, one icon.
- **API separate from admin.** All three clients talk to the same API, so the rules for money, attendance and strikes live in one place.
- **Postgres from day one.** Locally it runs as an embedded Postgres (PGlite), so nothing needs installing. In production it's a hosted Postgres such as Neon or Supabase.
- **Testing without phones.** Expo apps also run in a web browser, so I can click through every flow myself. On a real phone you can use Expo Go or a development build.

### Sandbox services (each behind a swappable interface)

| Service | v1 sandbox | Live replacement (later) |
|---|---|---|
| SMS OTP | Fixed test code, shown only in dev | MSG91 / Twilio / Firebase Auth |
| KYC | Upload of ID + selfie → admin approves | DigiLocker / Aadhaar-offline / IDfy / HyperVerge |
| Payments in | "Fund requirement" simulated instantly | Razorpay (orders + webhooks) |
| Payouts | Admin marks withdrawal paid | RazorpayX / Cashfree Payouts |
| File storage | Local disk | Cloudflare R2 / S3 |
| Push | Expo push (works in dev) | Same, production keys |
| Email | Logged to console | Resend |

---

## 3. Money model (commission not decided yet)

The deck shows 10 workers × ₹800 = ₹8,000 GMV and 15% = ₹1,200 Rozkaam revenue, but **who bears the 15% is not decided**. So the platform supports both, as admin settings:

- **Commission rate:** any percentage (starts at 15%).
- **Commission mode:**
  - *On top* — the worker gets the full ₹800 and the business pays ₹8,000 + ₹1,200 = ₹9,200.
  - *Deducted* — the business pays ₹8,000 and each worker receives ₹680.
- The worker app always shows the amount the worker will actually receive, in either mode.
- Each job stores the rate and mode it was posted under, so changing the setting never alters jobs already posted.
- Until you decide, the sandbox starts in *on top* mode.
- Ledger entries: `funding` (in) → `payout` per worker (to wallet) → `commission` (Rozkaam revenue) → `refund` (unused slots or cancellations).
- **GMV, worker payouts, revenue and cash are stored separately**, as the knowledge doc's data rules require.
- Amounts are stored in paise (whole numbers), never decimals.

---

## 4. Data model (main tables)

- **users** — phone, role (worker / business / admin), status (active / restricted / suspended / banned)
- **worker_profiles** — name, photo, DOB, gender, district / city, home location, skills[], experience, KYC status and docs, rating avg / count, strikes, reliability score, payout UPI
- **businesses** — name, category, GSTIN / registration, address and location, contact person, KYC status and docs, rating
- **jobs** (requirements) — title, category, description, workers needed, venue + lat/lng, date, report / start / end time, pay per worker, dress code, gender (only where lawful and necessary), height / attributes, skills, instructions, point of contact, urgency, status
  - status: `draft → awaiting_funding → open → filled → in_progress → completed / cancelled`
- **applications** — job × worker; status: `applied → approved / waitlisted / rejected → checked_in → checked_out → approved_for_pay → paid` (also `withdrawn`, `late_cancel`, `no_show`)
- **attendance_events** — check-in / out, photo, lat/lng, accuracy, distance to venue, flagged
- **ledger_entries** — type, amount, job / application / business / worker, provider ref, status
- **withdrawals** — worker, amount, UPI, status, admin who paid
- **ratings** — direction (business→worker / worker→business), category scores, comment
- **strikes** — worker, reason (late cancel / no-show / misconduct), excused flag, admin note
- **notifications**, **push_tokens**, **otp_codes**, **settings**, **audit_log** (every admin action)

---

## 5. Screens

### Worker app — Find → Apply → Work → Get paid
1. Welcome → phone → OTP
2. Onboarding: name, photo, district, skills, experience, UPI
3. KYC: ID type + number + photo, selfie → "under review" state
4. **Home**: stats (jobs done, hours, earnings) and a nearby job feed with category chips and filters
5. Job detail: pay, date / time, map, dress code, instructions → Apply
6. **My Gigs**: Upcoming / Applied / Completed tabs; cancel (with the 12 h rule shown clearly)
7. Job day: **Check in** (camera + GPS) → Check out → rate the business
8. **Payments**: wallet balance, history, withdraw to UPI, withdrawal status
9. **Account**: profile, ratings, strikes / reliability, notifications, help, terms, privacy

### Business app — Post → Confirm → Track → Pay
1. Welcome → phone → OTP → company registration + documents → "under review"
2. **Home**: upcoming requirements, quick "New requirement"
3. New requirement form (all fields) → cost summary (pay × workers + fee) → **Fund** (sandbox)
4. Workforce: see how many have applied and who the ops team has confirmed, with each confirmed worker's profile, rating and history
5. **Tracking**: live roster with confirmed / checked-in / late / no-show, check-in photos, flags; mark a no-show
6. Completion: approve attendance → release pay → rate workers; download the attendance CSV
7. **Payments**: funded, spent, refunded, invoices
8. **Company profile**, team contact, settings

### Admin panel (web)
Dashboard (GMV, revenue, jobs, fill rate, no-show rate, active workers / businesses) · Worker KYC queue · Business KYC queue · Users (search, restrict / suspend / ban, excuse strikes) · **Applicant approval** (per job: approve, reject, waitlist, replace — this is the ops team's main daily screen) · Jobs (view any job) · Attendance flags · Withdrawals (mark paid) · Ledger · Settings (commission %, cancel window, radius, geofence) · Audit log

---

## 6. Brand and design

- Primary **#6601F9** (violet), secondary **#B1C2CC** (cool grey); the purple gradient background from `IMAGERY/rozkaam bg .png` for splash and hero areas
- Logos: main logo (mark + wordmark), logomark for the app icon, white versions on purple
- One app icon: the logomark on purple
- Simple, large-touch UI for workers (many on budget Android phones), with icons alongside text
- Light theme first; layouts built so Malayalam / Hindi can be added later

### Visual direction (from your two reference designs)

Take the style, not the content, with Rozkaam violet in place of the orange and lime:
- A dark (near-black) header block with a greeting, profile photo and notification bell, sitting over a soft off-white page
- Big rounded white cards with soft shadows; pill-shaped status tags ("Applied", "Confirmed", "Checked in")
- A step-progress line on the active job card (Applied → Confirmed → Checked in → Paid), like the delivery tracker in the references
- A grid of large quick-action tiles on the home screen
- Bottom tab bar with a raised round violet centre button (worker: Check in; business: New requirement)
- A bold, large-headline welcome screen with one black "Get Started" button
- Map card with the venue pin on the job detail screen

### Functional flow (from your flow chart)

The plan matches your chart. These details come from it:
- KYC collects ID, photo **and bank details**
- Skills and experience are picked from **preset lists**, not typed freely
- Confirmation and the 2-hour reminder go by **push notification and email**, with location and time
- The check-in photo is also used to check **uniform / neatness**
- Cancelling less than 12 hours before, without a valid reason, leads to **suspension or a ban**
- **The company completes the payout**, then the worker's wallet updates
- Rating the company is **optional**

---

## 7. Build phases

Each phase ends with something you can open and click through.

| # | Phase | You can see |
|---|---|---|
| 0 | Repo, shared package, brand tokens, API skeleton, database + seed data | API health page; seeded demo accounts |
| 1 | Auth + onboarding + KYC (all 3 apps) | Sign in as worker / business / admin; approve KYC in admin |
| 2 | Requirements + discovery + apply + approve + waitlist | Business posts → worker sees it nearby → applies → gets confirmed |
| 3 | Check-in / out with photo + GPS, tracking, no-shows, strikes | The full job day, end to end |
| 4 | Funding, completion approval, payouts, wallet, withdrawals, ledger | Money flows correctly; admin pays a withdrawal |
| 5 | Ratings, notifications + reminders, admin dashboard + audit | The complete v1 loop |
| 6 | Hardening: tests on money / strike rules, security pass, Android build, deploy | Installable Android test build + hosted API / admin |

Testing: automated tests for the rules where bugs cost money or trust (ledger, fees, cancellation window, strikes, geofence), plus a scripted end-to-end run of the whole loop for every phase.

---

## 8. Deploy (Phase 6)

All on **new accounts created for Rozkaam**, not your existing ones:
- API + Postgres: Render or Railway (Singapore / Mumbai region) + Neon Postgres
- Admin: Vercel or Cloudflare Pages
- Mobile: EAS Build → Android test build and iOS TestFlight build, then the stores. Needs a Google Play developer account ($25 one-time) and an Apple Developer account ($99/yr).
- Domains: e.g. `api.rozkaam.com`, `admin.rozkaam.com` (once you confirm the domain)

---

## 9. Open questions for you

Answered: ops team approves applicants · English only · one "Rozkaam" app for both sides · Android and iOS · new accounts · commission left as a setting.

Still open (none of these block starting):
1. **Commission mode:** on top or deducted. Built as a setting until you decide.
2. **Worker payout timing:** right after attendance is approved, or on a daily / weekly cycle? The plan assumes money reaches the worker's wallet on approval, and the ops team pays out withdrawal requests.
3. **Who approves attendance for pay:** with ops approving applicants, should ops also approve attendance, or should the business confirm it? The plan assumes the business confirms and ops can override.
4. **Domain:** which domain will Rozkaam use? Needed only at deploy time.
5. **Logo files:** they are outside this folder (in Downloads). Copy them into `brand/` here before the build starts.
