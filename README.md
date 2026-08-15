# The American Experiment

A real-time grand strategy simulation of governing the United States from its
founding to the present day. Day-by-day clock with pause and speed controls, an
event feed, and deeply interlocking economic and political systems — Hearts of
Iron IV's pacing applied to governing rather than commanding armies.

**Status:** Phase 1 in development. Deployment pipeline being established; no
game logic written yet.

---

## Documentation

Read these before changing anything. They are the source of truth, and they are
kept current — a change that makes one of them wrong is incomplete.

| Document | Covers |
|---|---|
| **[DESIGN.md](DESIGN.md)** | Vision, architecture rules, data model, roadmap. **Start here.** |
| **[docs/ECONOMY.md](docs/ECONOMY.md)** | Every simulation variable, formula, causal claim, and verified historical figure |
| **[docs/UI.md](docs/UI.md)** | Screen specifications and the design token system |

---

## Requirements

- **Node.js 20 or later** (developed on 24.18.0)
- **npm 10 or later** (developed on 11.16.0)
- A **Supabase** project (accounts and save games)
- A **GitHub** account and a **Vercel** account (deployment)

---

## Getting started

```bash
npm install
cp .env.example .env      # then fill in real values — see below
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

Copy `.env.example` to `.env` and fill it in. That file documents every
variable and why it exists; three points are worth repeating because they cause
the most confusion:

1. **Prisma needs both `DATABASE_URL` and `DIRECT_URL`.** The app talks to the
   transaction pooler on port **6543** with `?pgbouncer=true`; migrations need
   the direct connection on port **5432**, because migrations cannot run over a
   pooler.
2. **In Prisma 7 these do not go in `schema.prisma`.** `DIRECT_URL` is read by
   `prisma.config.ts` (CLI and migrations); `DATABASE_URL` is read by
   `src/lib/prisma.ts` (the application). Putting either in the datasource
   block is a hard validation error, not a warning. See
   [DESIGN.md](DESIGN.md) §4.1.
3. **Percent-encode special characters in the database password.** A `!` in a
   raw connection string silently breaks the URL and produces an error that
   does not mention the password at all. `!` becomes `%21`.

Find both strings in the Supabase dashboard under **Connect → ORMs → Prisma**.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve a production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript with no emit |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:check` | Connection smoke test — verifies the app's pooled connection |

`db:check` is worth knowing about. It tests `DATABASE_URL` (the pooled
connection the application uses), which is a **different code path** from
`prisma migrate` (which uses `DIRECT_URL`). A successful migration does not
prove the app can reach the database. When a deploy builds but queries fail,
run this first — it separates "the connection is wrong" from "the code is
wrong". It never prints your password.

`postinstall` runs `prisma generate` automatically, so the generated client is
rebuilt on every `npm install` and on every Vercel deploy. The generated client
lives in `src/generated/prisma` and is git-ignored — it is a build artifact.

---

## Project structure

```
src/
  app/         Next.js App Router routes
  components/  Pure renderers — no simulation math
  sim/         THE ENGINE. Pure TypeScript. No React, no DOM, no network.
  content/     Game data — events, laws, regions, historical benchmarks
  runtime/     The tick loop; the bridge between sim and store
  store/       Zustand state
  lib/         Formatting, clients, helpers
docs/          ECONOMY.md, UI.md
prisma/        Database schema
```

---

## The rules that matter

Summarized from [DESIGN.md](DESIGN.md) §5. A change that breaks one of these is
wrong even if it works.

1. **`src/sim/` is pure.** No React, no browser APIs, no network, no `Date.now()`.
2. **Determinism.** Same state in, same state out. No `Math.random()` in the
   engine — randomness uses a seeded PRNG whose state lives in `GameState`.
3. **One serializable state object.** `GameState` must round-trip through JSON
   losslessly. No classes, no `Date`s, no `Map`s.
4. **Content is data, not code.** A new historical event means editing a
   content file, never engine logic.
5. **Every number explains itself.** Nothing mutates a stat directly; all
   changes flow through the modifier ledger, and the UI can show exactly which
   sources produced any displayed value.
6. **The tick loop lives outside React.** The UI re-renders at most 4×/second
   regardless of simulation speed.
7. **The UI is a renderer.** Zero simulation math in components.
8. **Saves are versioned.** Migrate or refuse cleanly — never crash, never
   silently load a broken state.

### On historical data

Every historical figure carries a source citation. **We never fabricate a
number.** Where a sourced figure does not exist, the interface says so
explicitly rather than showing a guess, a zero, or a blank. Known gaps are
tracked in [docs/ECONOMY.md](docs/ECONOMY.md) §3.

---

## Deployment

Deployed on Vercel from the `main` branch of the GitHub repository. Vercel needs
explicit permission to access the repo, and every environment variable in
`.env` must also be set in the Vercel project settings — a local `.env` is not
uploaded.

### Health check

```
GET /api/health
```

Returns whether the **deployed** application can reach the database. That is a
different question from whether a migration ran from your laptop: it exercises
the platform's environment variables, the pooled connection, and the generated
Prisma client from inside a serverless function.

A healthy response:

```json
{ "status": "ok", "database": "connected", "saveGames": 0,
  "latencyMs": 353, "commit": "1e8c4fe", "environment": "production" }
```

On failure it returns the **shape** of the connection strings — length, whether
they are wrapped in quotes, scheme validity, detected port — but never their
values. This exists because connection failures are otherwise near-impossible
to diagnose remotely.

### Two deployment traps, both already hit on this project

1. **Do not paste the quotes.** `.env` requires values in double quotes because
   the quotes delimit the value. Vercel's dashboard stores the field's literal
   contents, so pasting a line straight from `.env` carries the quotes into the
   value. The connection then fails instantly with an error that never mentions
   quoting. The health endpoint's `wrappedInQuotes` field detects this.
2. **Changing a variable does not update a running deployment.** After editing
   environment variables, go to Deployments and redeploy explicitly. Until you
   do, the new values exist but nothing is using them.

---

## License

Not yet determined.
