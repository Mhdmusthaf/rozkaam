# Rozkaam API

The one backend for the worker app, the business app and the admin panel.

## Run it

```bash
npm run dev
```

It starts on http://localhost:4000 with a built-in database stored in `.data/`, so nothing else needs installing. Copy `.env.example` to `.env` to change settings. Sign-in uses the sandbox code `123456` until a real SMS provider is switched on.

```bash
npm test
```

Runs the automatic tests (rules, plus the whole loop through the API on a throwaway database).

## How the code is organised

| Folder | What lives there | Rule |
|---|---|---|
| `src/rules/` | Money, cancellation, distance, strikes | Pure calculations. No database, no network. Fully tested. |
| `src/services/` | What the platform does: sign-in, profiles, jobs, attendance, wallet, admin | The only place that changes data. Enforces every rule. |
| `src/app.ts` | The web addresses (routes) | Thin: checks who is calling, validates input, calls a service. |
| `src/providers/` | SMS, file storage, payments | One small file per outside service, with a sandbox version. Swap the inside, keep the function. |
| `src/db/schema.ts` | The database tables | Change it, then run `npm run db:generate` to create a migration. |
| `tests/` | Automatic tests | Add a test with every new rule. |

## Adding a feature

1. If it needs new data, add columns or a table in `src/db/schema.ts` and run `npm run db:generate`.
2. If it has a rule (a calculation or a yes/no decision), put it in `src/rules/` with a test.
3. Add a function in the right `src/services/` file.
4. Add a route in `src/app.ts` that calls it.
5. Add the flow to `tests/flow.test.ts`.
6. Tick it off in `docs/CHECKLIST.md`.

## Main addresses

All start with `/v1`. Every call except sign-in needs `Authorization: Bearer <token>`.

- **Sign-in:** `POST /auth/otp/request`, `POST /auth/otp/verify`, `GET /me`, `POST /auth/sign-out`
- **Worker:** `/worker/profile`, `/worker/kyc/submit`, `/worker/jobs`, `/worker/jobs/:id/apply`, `/worker/applications`, `/worker/applications/:id/{cancel,check-in,check-out,rate}`, `/worker/wallet`, `/worker/withdrawals`, `/worker/strikes`
- **Business:** `/business/profile`, `/business/kyc/submit`, `/business/jobs`, `/business/jobs/:id/{fund,cancel,approve-attendance}`, `/business/applications/:id/{no-show,rate}`, `/business/payments`
- **Admin:** `/admin/dashboard`, `/admin/kyc/:kind`, `/admin/jobs`, `/admin/applications/:id/decide`, `/admin/flags`, `/admin/users/:kind`, `/admin/users/:id/status`, `/admin/strikes/:id/excuse`, `/admin/withdrawals`, `/admin/ledger`, `/admin/settings`, `/admin/audit`
- **Shared:** `/notifications`, `/uploads`, `/files/:key`, `/settings/public`

## Guarantees the tests check

- Every paisa a business funds ends up as a worker payout, Rozkaam commission or a refund.
- A job keeps the commission terms it was posted under, even if settings change later.
- Only the ops team can confirm applicants; a job can never be over-filled.
- Check-in time is the server's clock; distance is calculated on the server.
- Cancelling inside the window adds a strike; two active strikes restrict, three suspend; excusing restores.
- A wallet can never be overdrawn; a rejected withdrawal returns the money.
- Workers see the venue contact only after confirmation; businesses never see phone numbers or ID documents.
- Private files are readable only by their owner, the ops team, and the business whose job the check-in photo belongs to.
