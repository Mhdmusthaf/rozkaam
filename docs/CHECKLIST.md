# Rozkaam — Feature checklist, 0 to 100%

Last updated: 18 Nov 2026. This is the single list of everything the platform needs. Update it whenever a feature is added, changed or finished.

**Status key**
- **Screen** — the screen exists and works on demo data in the browser.
- **Backend** — the real server, database and rules for it exist.
- **Live** — it works with a real provider (real SMS, real money, real KYC).

`[x]` done · `[~]` partly · `[ ]` not started

## Yes — the backend covers all three sides

There is **one backend** (one server, one database) that the worker app, the business app and the admin panel all talk to. The backend now exists and is tested (section E). The apps still run on their own demo data, so a job posted in the business app does not yet appear in the worker app or the admin panel. Connecting the apps to the backend is the next piece of work.

---

## A. Accounts and sign-in

| Feature | Screen | Backend | Live |
|---|---|---|---|
| Welcome and role choice (worker / business) | [x] | n/a | n/a |
| Phone number + OTP sign-in | [x] sandbox code | [ ] | [ ] needs MSG91 |
| Stay signed in between app opens | [ ] | [ ] | [ ] |
| Sign out | [x] | [ ] | [ ] |
| Admin sign-in with role (ops, finance, owner) | [~] single demo admin | [ ] | [ ] |
| Delete my account and data | [ ] | [ ] | [ ] |

## B. Worker app

| Feature | Screen | Backend | Live |
|---|---|---|---|
| Sign-up: profile, photo, district, area | [x] | [ ] | [ ] |
| Skills and experience from preset lists | [x] | [ ] | [ ] |
| KYC: ID type and number, ID photo, selfie | [x] | [ ] | [ ] manual review first |
| Bank account and UPI for payouts | [x] | [ ] | [ ] |
| "Under review" then "Account activated" | [x] auto in demo | [ ] | [ ] |
| Home: stats, next gig, nearby jobs | [x] | [ ] | [ ] |
| Search, category chips, sort and filters | [x] | [ ] | [ ] |
| Jobs within 10–15 km of the worker | [~] fixed demo distances | [ ] | [ ] |
| Job page: pay, time, venue, dress code, rules | [x] | [ ] | [ ] |
| Apply, join waitlist, withdraw application | [x] | [ ] | [ ] |
| Confirmation by Rozkaam's ops team | [x] auto in demo | [ ] | [ ] |
| My Gigs: upcoming, applied, history | [x] | [ ] | [ ] |
| Contact person shown only after confirmation | [x] | [ ] | [ ] |
| Cancel with the 12-hour rule and strike warning | [x] | [ ] | [ ] |
| Check-in: photo + GPS + time, distance check | [x] | [ ] | [ ] |
| Check-out: photo + GPS + time | [x] | [ ] | [ ] |
| Wallet: balance, earned, withdrawn, pay pending | [x] | [ ] | [ ] |
| Withdraw to UPI or bank | [x] | [ ] | [ ] needs payouts provider |
| Rate the company (optional) | [x] | [ ] | [ ] |
| Reliability score and strikes | [x] | [ ] | [ ] |
| Edit profile | [x] | [ ] | [ ] |
| Notifications list | [x] | [ ] | [ ] |
| Push notification and 2-hour reminder | [ ] | [ ] | [ ] |
| Email confirmations | [ ] | [ ] | [ ] |
| Help and FAQ, message support | [x] message is not sent anywhere | [ ] | [ ] |
| Terms and privacy | [~] summary draft, needs a lawyer | n/a | [ ] |
| Open venue in maps, call the contact | [x] | n/a | n/a |
| Real map on the job page | [ ] drawn placeholder | [ ] | [ ] |

## C. Business app

| Feature | Screen | Backend | Live |
|---|---|---|---|
| Sign-up: company, contact, documents | [x] | [ ] | [ ] |
| Business verification | [x] auto in demo | [ ] | [ ] manual review first |
| Home: stats, live job, needs-action, upcoming | [x] | [ ] | [ ] |
| Post a requirement (5 steps, all fields) | [x] | [ ] | [ ] |
| Save a draft, fund later | [x] | [ ] | [ ] |
| Cost summary: pay + service fee | [x] | [ ] | [ ] |
| Fund the requirement before it goes live | [x] simulated | [ ] | [ ] needs Razorpay live |
| See applicants count, confirmed team, waitlist | [x] | [ ] | [ ] |
| Worker profile as the business sees it | [x] | [ ] | [ ] |
| Live attendance: checked in, late, flagged | [x] | [ ] | [ ] |
| See each check-in photo | [ ] | [ ] | [ ] |
| Mark a no-show | [x] | [ ] | [ ] |
| Approve attendance and release pay | [x] | [ ] | [ ] |
| Refund for unused slots and cancellations | [x] simulated | [ ] | [ ] |
| Cancel a requirement | [x] | [ ] | [ ] |
| Rate workers | [x] not browser-tested | [ ] | [ ] |
| Payments history and invoice breakdown | [x] | [ ] | [ ] |
| Download invoice (PDF) | [ ] | [ ] | [ ] |
| Download attendance (CSV) | [ ] | [ ] | [ ] |
| Edit company profile | [x] not browser-tested | [ ] | [ ] |
| Repeat a past requirement in one tap | [ ] | [ ] | [ ] |

## D. Admin panel (web)

| Feature | Screen | Backend | Live |
|---|---|---|---|
| Dashboard: GMV, revenue, payouts, fill and no-show rate | [x] | [ ] | [ ] |
| Applicant approval: approve, waitlist, reject, replace | [x] | [ ] | [ ] |
| Requirements list and detail, cancel | [x] | [ ] | [ ] |
| Worker KYC queue | [x] | [ ] | [ ] |
| Business KYC queue | [x] | [ ] | [ ] |
| Workers and businesses: restrict, suspend, ban, reinstate | [x] | [ ] | [ ] |
| Excuse a strike with a note | [x] | [ ] | [ ] |
| Attendance flags: accept or mark no-show | [x] | [ ] | [ ] |
| Withdrawals: mark paid with reference, reject | [x] | [ ] | [ ] |
| Ledger: funding, payout, commission, refund | [x] | [ ] | [ ] |
| Settings: commission rate and mode, cancel window, radius, geofence, reminder time | [x] | [ ] | [ ] |
| Audit log of every admin action | [x] | [ ] | [ ] |
| Support inbox for messages from users | [ ] | [ ] | [ ] |
| Send an announcement to workers or businesses | [ ] | [ ] | [ ] |

## E. Backend (the shared server) — built and tested, not yet connected to the apps

Lives in `apps/api`. 22 automatic tests pass, including the whole loop through the API.

| Piece | Status |
|---|---|
| Project structure: rules, services, routes, providers | [x] |
| Database tables and first migration (20 tables) | [x] |
| Sign-in: OTP (sandbox), sessions, roles, admin allow-list | [x] |
| Worker, business and KYC records with file uploads | [x] |
| Requirements, funding, applications, waitlist, ops confirmation | [x] |
| Attendance with server time, distance check, flags, lateness | [x] |
| Settlement: payouts, commission, refunds, no-shows | [x] |
| Wallet and withdrawals (cannot be overdrawn) | [x] |
| Ratings both ways, strikes, reliability, account standing | [x] |
| In-app notifications | [x] |
| Push, email and the 2-hour reminder | [ ] |
| Admin actions with audit log | [x] |
| Admin roles (ops / finance / owner) | [ ] one admin level today |
| Swappable providers: SMS, storage, payments | [x] sandbox versions |
| Live providers: MSG91, Cloudflare R2, Razorpay, payouts, KYC | [ ] |
| Automatic tests for money, strikes, cancellation, distance | [x] |
| Demo data loader for the real database | [ ] |
| Connect the mobile app to the API (replace demo data) | [x] business side browser-tested; worker side not yet |
| Connect the admin panel to the API (replace demo data) | [x] script-tested, not yet browser-tested |
| Rate limiting on sign-in | [x] |
| Uploaded files stored in the database (durable on any host) | [x] |
| Refuses to start in production with unsafe settings | [x] |
| Admin: cancel a requirement, replace a confirmed worker | [ ] |
| Pin the venue on a map when posting (real coordinates) | [ ] |

## F. Launch

| Piece | Status |
|---|---|
| Accounts from docs/SETUP.md created | [ ] |
| Hosting file (`render.yaml`) and guide (`docs/DEPLOY.md`) | [x] |
| Production builds of API, admin panel and web app verified locally | [x] |
| Hosted database, API, admin panel, web app | [ ] needs GitHub + Render accounts |
| Android test build, then Play Store | [ ] |
| iOS test build, then App Store | [ ] |
| Real SMS OTP (MSG91 + DLT) | [ ] |
| Real payments and payouts (Razorpay KYC) | [ ] |
| Final terms and privacy text from a lawyer | [ ] |
| Legal check: payment handling rules, labour and social-security rules for platforms | [ ] |
| Error tracking and backups | [ ] |
| Support phone / WhatsApp number in the app | [ ] |

## G. Later (from the roadmap, not in version 1)

Automated matching and worker ranking · demand forecasting · automatic replacements · subscriptions · multi-location businesses · enterprise dashboards · APIs for partners · Malayalam and Hindi · more cities.

---

## How the code stays easy to extend

These are the rules the code follows so new features can be added at any time without breaking old ones.

1. **One job per folder.** `apps/mobile` is the phone app, `apps/admin` is the admin panel, the backend will be `apps/api`, and shared definitions will live in `packages/shared`.
2. **Screens never hold business rules.** Screens read and change data only through the store today, and through the API later. Rules for money, strikes and attendance live in one place on the server.
3. **One design system.** Every screen is built from the pieces in `apps/mobile/src/ui`. Changing a colour or a button there changes it everywhere.
4. **Every outside service is swappable.** SMS, KYC, payments, payouts and file storage each sit behind one small interface, with a sandbox version and a live version.
5. **Settings, not hard-coded numbers.** Commission rate and mode, cancellation window, radius and geofence are settings the admin can change.
6. **Each job remembers its own terms.** A requirement stores the commission rate and mode it was posted under, so changing a setting never alters old jobs.
7. **Money is recorded, never overwritten.** Every movement is a new ledger entry. GMV, worker payouts and Rozkaam revenue are always kept separate.
8. **Tests on the rules that cost money or trust.** Fees, refunds, cancellation window, strikes and distance checks get automatic tests.
9. **Every admin action is logged** with who did it and when.
10. **This checklist is updated with every change,** so it always shows the true state.
