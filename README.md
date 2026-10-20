# FitnessJourni

Shared daily tracking and training sessions for Dillon, Angel and Bradley.

A [Next.js 16](https://nextjs.org/) App Router app — React 19, TypeScript, CSS Modules,
Biome, Vitest — backed by Supabase. Dark-only and phone-first.

## What it does

| Route | What's there |
| --- | --- |
| `/` | **Today** — a tab per person; steps, water and calories as rings, macros as bars, quick entry, and a strip comparing everyone |
| `/sessions` | **Sessions** — upcoming runs/workouts/swims/walks, and a form to book a day + time + activity |
| `/groups` | **Groups** — the groups you belong to, their members and roles, invitations, join requests and join codes |

Targets default to the 12-week playbook — 2,500 kcal, 156 g protein / 313 g carbs / 69 g fat,
10,000 steps (8,000 minimum), 2.5 L water — and are stored per person, so they can diverge.

## Setup

```bash
nvm use            # Node 26 — the engines field requires it
yarn install
```

1. Create a Supabase project, then run [`supabase/schema.sql`](supabase/schema.sql) in its SQL
  editor. It creates the tables, applies RLS, and seeds the starting members. It is idempotent —
   safe to re-run.
2. Copy `.env.example` to `.env.local` and fill in your project URL, server-only service role key,
  and app enrollment passcode:

   ```
   SUPABASE_URL=https://your-project-ref.supabase.co
  SUPABASE_SECRET_KEY=sb_secret_...
  APP_PASSCODE=your-enrollment-passcode
   ```

3. `yarn dev`

Without those vars the app still runs and shows a setup notice rather than crashing.

### Why there is no `NEXT_PUBLIC_` prefix

Deliberate. The key is read only on the server: every read happens in a Server Component and every
write in a Server Action, so the key is never sent to the browser. A secret key (or the legacy
`SUPABASE_SERVICE_ROLE_KEY`) is required
because credential rows have no anonymous RLS policy. Never expose it through a `NEXT_PUBLIC_` variable.

The trade-off is no live push updates; pages revalidate on write instead. For daily numbers that's
plenty, and it avoids shipping a write-capable credential to the client.

### Caching

Visited pages are reused for 30 seconds. Server reads persist across navigation and app reloads:
members and measurements for five minutes, activity for one minute, sessions for 30 seconds,
and chat for 15 seconds. Saves expire the relevant data tags immediately across all pages.
Login, account credentials, group membership, permissions and mutation reads always use fresh data.
Cookie changes and group switches clear the navigation cache. Returning after at least 30 seconds
in the background triggers one refresh; there is no polling. Changes made directly in Supabase
appear after the cache revalidates, or after a hard refresh in development.
Links fetch when followed rather than prefetching every visible destination again after a save.

### Accounts and enrollment

Users log in with their username or email and personal password. Passwords are stored as salted
PBKDF2 hashes, and the 90-day member cookie is signed with `APP_PASSCODE` so its member ID cannot be
changed without invalidating the session.

`APP_PASSCODE` is required only for enrollment:

- New members select **Create new user**, enter the app passcode, then create their profile and login.

Every existing member already has login details and can log in directly.

There is no visitor mode or account switching. Every page requires a signed member session, and
every member-owned Server Action checks that session before writing. Username is permanent; email
and password can be changed from Profile. The Home link form connects an existing account by its
username.

`robots.txt` disallows everything, so none of this ends up in search results.

### Groups

Everything shared is shared with a **group**. A member can belong to several and has exactly one
active at a time; the active group decides which people and which shared content every other page
shows. Someone in no group is in **Personal** mode: logging still works, and nothing they record is
shared with anyone.

Roles are **owner**, **admin** and **member**. The creator becomes the owner, a group always has
exactly one (a partial unique index enforces it), and the owner cannot leave until they have handed
it over. Admins run the group day to day but cannot manage the owner or each other. The rules
themselves are pure functions in `lib/groups.ts`, and every one is re-checked inside the Postgres
functions in `supabase/schema.sql` — the first so a refusal can be explained, the second so the rule
holds even if a caller forgets to ask.

Joining always needs two parties. An owner or admin invites by username and the invited person
accepts; or someone enters a join code and an owner or admin approves the request. Neither route
adds anybody on its own.

**How visibility works.** Personal activity is recorded once, not once per group. A record is visible
to a group when **either** of these holds:

- its author belongs to that group right now. Sharing your numbers with the people you train with is
  the point of the app, so joining a group shows them your history as well as what you log next;
- or an association row says it was shared with that group when it was created (`group_daily_logs`,
  `group_workouts`, `group_runs`). That is what keeps a former member's days visible after they
  leave, rather than rewriting past comparisons the moment somebody goes.

Current membership alone would get the second case wrong, and the association rows alone would get
the first wrong — hence both. The rows are written on creation and never on edit, so correcting an
old day does not change which groups it belongs to. Activity logged in Personal mode has no rows and
stays private until its author joins a group.

**Runs are the exception.** A log or a workout is yours, shared with your group; a run is an *event*.
The Running page lists only the runs the viewer was actually on, because one they were not on is
somebody else's outing rather than their record of it. *Runs by person* stays group-wide, so someone
who has not run yet still sees what everyone else has done.

Chat, sessions and their reactions and RSVPs belong to one group outright, carry its id, and are
deleted with it. Deleting a group keeps every member's own logs, workouts and runs and removes only
their association with that group; everyone affected is moved to another group of theirs, or back to
Personal mode.

The group tables have RLS enabled with **no** anon policy at all, like `member_credentials`, so the
publishable key cannot enumerate groups, memberships, invitations or join codes. The group functions
also have their default `PUBLIC` execute grant revoked — without that, anyone holding that key could
call `delete_group` over the REST endpoint.

Group codes look like `N7K4-P2Q9`, in an alphabet with no I, L, O, 0 or 1 so they survive being read
aloud. Regenerating one invalidates the old immediately.

### Timezone

The logged date is resolved on the server. If a deployment's date ever disagrees with yours, set
`TZ` in the host environment (e.g. `TZ=Europe/London` on Netlify).

## Scripts

| Script | What it does |
| --- | --- |
| `yarn dev` | Dev server |
| `yarn build` | Production build |
| `yarn start` | Serve the production build |
| `yarn lint` | Biome lint |
| `yarn format` | Biome check + write |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn test` | Vitest, single run |
| `yarn test:watch` | Vitest in watch mode |
| `yarn test:coverage` | Vitest with coverage |

## Structure

```
app/
  actions.ts          Server Actions — every write goes through here
  group-actions.ts    Group Server Actions; authorization is re-derived, never trusted
  page.tsx            Today
  (pages)/sessions/   Sessions
  (pages)/groups/     Groups
components/           One folder per component: Component.tsx + Component.module.css
data/                 Static data: nav, activity labels, accent slots, playbook defaults
lib/
  supabase/server.ts  Server-only client; returns null when unconfigured
  data/               The only modules that touch Supabase, plus row -> camelCase mappers
  data/scope.ts       What a group-scoped read may see; threaded through every such query
  groups.ts           Group roles, permissions and join codes as pure functions
  progress.ts         Percent-of-target maths
  testing/            Test doubles (the Supabase query-builder stand-in)
styles/globals.css    Design tokens and element resets
supabase/schema.sql   Schema, RLS and seed
types/fitness.ts      Shared domain types
utils/date.ts         ISO date helpers
```

## Conventions

- **Components** are named exports in `components/<Name>/<Name>.tsx`, styles alongside in
  `<Name>.module.css`. Tests sit next to the code as `<Name>.test.tsx`.
- **Styling** is CSS Modules only, using the tokens in [styles/globals.css](styles/globals.css).
  Variant state goes on `data-*` attributes rather than concatenated class strings.
- **Dates** are `YYYY-MM-DD` strings in state and `HH:MM` for times; `Date` is only materialised for
  formatting. `fromISODate` parses at midday so daylight saving can't roll a day over.
- **Path aliases**: `@components/*`, `@hooks/*`, `@data/*`, `@utils/*`, `@/lib/*`, `@/types/*`,
  `@/app/*`, `@/styles/*`.

### The colour system is validated, not chosen by eye

The twelve member accents are categorical slots used against the dark chart surface
(`--c-surface`, `#141416`). They are assigned in fixed order rather than generated. A member's
colour follows the person, not their position in the list, and a name always sits beside the colour
so identity never depends on colour alone.

If you change `--c-surface` or add an accent, re-validate the set rather than eyeballing it.

Progress indicators are **meters** — one value against its own limit — so the unfilled track is a
lighter step of the fill's own ramp, not a neutral grey. Overshooting a *budget* (calories) is
flagged amber; beating a *goal* (steps, water) is not.

Home and Profile saves use React `useOptimistic` for immediate updates while server actions save
in the background. Failed changes roll back independently and can be retried; drafts remain available.
Password changes show pending feedback and clear their fields only after the server confirms success.
