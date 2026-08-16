# ENV-SETUP.md

Everything the deployment needs, where to get it, and what breaks without it.

**Current status as of the autonomous run of 2026-08-15:**

| Variable | Local `.env` | Vercel | Effect if missing |
|---|---|---|---|
| `DATABASE_URL` | ✅ set | ✅ set | Cloud saves cannot be written |
| `DIRECT_URL` | ✅ set | ✅ set | Migrations cannot run |
| `NEXT_PUBLIC_SUPABASE_URL` | ❌ placeholder | ❌ absent | **Sign-in disabled; saves are local only** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ❌ placeholder | ❌ absent | **Sign-in disabled; saves are local only** |

The game is fully playable without the two missing ones. Save/load works
against browser storage, and the interface says plainly that games are stored
in this browser rather than implying a sync that is not happening. Setting them
activates the cloud path with **no code change**.

---

## The two you still need to set

### `NEXT_PUBLIC_SUPABASE_URL`

**Where:** Supabase dashboard → your project → **Project Settings** → **API** →
**Project URL**.

Looks like `https://abcdefghijklmnop.supabase.co`.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Where:** same page → **Project API keys** → the key labelled `anon` `public`.

A long JWT beginning `eyJ...`.

**This key is safe to expose to the browser.** That is what the `NEXT_PUBLIC_`
prefix means and why it is correct here. It is protected by Row Level Security
rather than by secrecy. Do **not** use the `service_role` key — that one
bypasses all security and must never reach the browser.

---

## Setting them

### Locally

Open `C:\Users\antho\gov-sim\.env` and replace the two placeholder lines.
`.env` is gitignored and verified so before every push.

### On Vercel

Project → **Settings** → **Environment Variables**. Add both, ticked for
Production, Preview and Development.

> **Do not paste the surrounding quotes.** `.env` needs them because the quotes
> delimit the value; Vercel stores the field's literal contents, so pasting a
> line straight from `.env` carries them into the value and the credential
> silently fails. This has already caught us once — see the README's deployment
> traps.

Then **Deployments → ⋯ → Redeploy**. Environment variable changes do not apply
to an existing deployment.

---

## Also required in Supabase itself, for sign-in to work

Setting the variables is necessary but not sufficient. Sign-in uses a
passwordless email link, which needs:

1. **Supabase dashboard → Authentication → Providers → Email** — enabled.
   It is on by default.

2. **Authentication → URL Configuration → Site URL** — set to
   `https://gov-sim.vercel.app`. Without this the link in the email points at
   `localhost` and will not work from another machine, which defeats the point
   of cloud saves.

3. **Redirect URLs** — add both:
   - `https://gov-sim.vercel.app/**`
   - `http://localhost:3000/**`

4. **Email sending.** Supabase's built-in SMTP is rate-limited to a handful of
   messages an hour, which is fine for testing and not for real use. If you hit
   the limit, configure a custom SMTP provider under **Project Settings →
   Authentication → SMTP Settings**.

---

## Verifying it worked

```
curl https://gov-sim.vercel.app/api/health
```

`env.NEXT_PUBLIC_SUPABASE_URL` and `env.NEXT_PUBLIC_SUPABASE_ANON_KEY` should
both read `true`. They currently read `false`.

Then in the game: **Saved games** → the Account section should offer an email
field instead of the "not configured" notice.

---

## The database variables, for reference

Already working, documented here so the full picture is in one place.

`DATABASE_URL` — transaction pooler, port **6543**, with `?pgbouncer=true`.
Used by the running application through the Prisma driver adapter.

`DIRECT_URL` — direct connection, port **5432**. Used by `prisma migrate`.
Migrations take advisory locks and issue DDL, neither of which survives a
transaction pooler.

Both come from **Supabase dashboard → Connect → ORMs → Prisma**, which emits
them already labelled.

**Percent-encode special characters in the password** or the URL silently
breaks with an error that never mentions the password: `!` → `%21`, `#` →
`%23`, `@` → `%40`.

In Prisma 7 these do **not** go in `schema.prisma`. `DIRECT_URL` is read by
`prisma.config.ts`; `DATABASE_URL` by `src/lib/prisma.ts`. Putting either in the
datasource block is a hard validation error. See `DESIGN.md` §4.1.

---

## What is deliberately not configured

`SUPABASE_SERVICE_ROLE_KEY` is commented out in `.env.example` and is not used
anywhere. Nothing in the codebase needs it. Authorization is enforced in the
route handlers by checking the Supabase session and scoping every query to that
user id, because Prisma connects as the database owner and bypasses Row Level
Security entirely. Adding the service role key would remove the only remaining
safety net for no benefit.
