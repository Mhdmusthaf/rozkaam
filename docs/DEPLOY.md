# Rozkaam — Putting it online

Everything is ready to host. One file, `render.yaml`, creates the database, the API, the admin panel and the web app on Render in one go. Cost: ₹0 on Render's free plan.

## What you need (about 15 minutes)

1. **A GitHub account** for Rozkaam — https://github.com/signup
2. **A Render account** for Rozkaam — https://dashboard.render.com/register (sign up with that GitHub account)

## Steps

### 1. Put the code on GitHub

Create a new **private** repository named `rozkaam` on GitHub (no README, no licence). GitHub then shows two commands under "push an existing repository". Run them in a terminal opened in the `Rozkaam` folder. They look like this, with your own account name:

```bash
git remote add origin https://github.com/YOUR-ACCOUNT/rozkaam.git
```

```bash
git push -u origin master
```

### 2. Create everything on Render

1. In Render: **New +** → **Blueprint**.
2. Connect GitHub and pick the `rozkaam` repository.
3. Render reads `render.yaml` and asks for three values:

| Name | What to type |
|---|---|
| `SANDBOX_OTP` | A private 6-digit login code of your choice. **Not 123456.** Everyone you invite to test uses this code until real SMS is switched on. |
| `ADMIN_PHONES` | The 10-digit mobile numbers allowed into the admin panel, separated by commas. |
| `CORS_ORIGINS` | `https://rozkaam-admin.onrender.com,https://rozkaam-app.onrender.com` |

4. Click **Apply**. The first build takes about 5–10 minutes.

### 3. Check the addresses

When it finishes, Render lists four items. Open each service to see its address:

- **rozkaam-api** — the backend. Opening `/health` on it should show `{"ok":true,...}`.
- **rozkaam-admin** — the admin panel.
- **rozkaam-app** — the worker and business app as a website.
- **rozkaam-db** — the database.

If Render added letters to an address (for example `rozkaam-app-x7k2.onrender.com`, which happens when a name is taken), go to **rozkaam-api → Environment**, correct `CORS_ORIGINS` to the real addresses, and save. Without that, the apps cannot talk to the API.

### 4. First sign-in

- **Admin panel:** enter one of the `ADMIN_PHONES` numbers, then your `SANDBOX_OTP` code.
- **App:** choose worker or business, enter any mobile number, then the same code. A new account then waits for approval in the admin panel.

## Things to know about the free plan

| Limit | What it means | Fix when ready |
|---|---|---|
| The API sleeps after 15 quiet minutes | The first tap after a pause takes about a minute | Render's paid plan (about $7 a month) |
| The free database is deleted after 30 days | All accounts and jobs are lost unless you upgrade or move | A free Neon database: create one at https://console.neon.tech/signup and paste its connection string into `DATABASE_URL` on rozkaam-api |
| One shared login code | Anyone who knows the code and a phone number can sign in as that number | Switch on real SMS (MSG91) before inviting the public |
| Payments are simulated | No real money moves | Razorpay live mode, after KYC |

**Treat this as a private test site.** Share the login code only with people you trust, and do not enter real ID or bank details until real SMS is on.

## Updating the live site

Every time new code is pushed to GitHub, Render rebuilds and updates all three by itself:

```bash
git push
```

## Phone apps

The website version works in any phone browser today. Installable Android and iOS apps are built from the same code with Expo (see `docs/SETUP.md`), and point at the same API address.
