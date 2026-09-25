# FitnessJourni

Shared daily tracking and training sessions for Dillon, Angel and Bradley.

A [Next.js 16](https://nextjs.org/) App Router app — React 19, TypeScript, CSS Modules,
Biome, Vitest — backed by Supabase. Dark-only and phone-first.

## What it does

| Route | What's there |
| --- | --- |
| `/` | **Today** — a tab per person; steps, water and calories as rings, macros as bars, quick entry, and a strip comparing everyone |
| `/sessions` | **Sessions** — upcoming runs/workouts/swims/walks, and a form to book a day + time + activity |

Targets default to the 12-week playbook — 2,500 kcal, 156 g protein / 313 g carbs / 69 g fat,
10,000 steps (8,000 minimum), 2.5 L water — and are stored per person, so they can diverge.

## Setup

```bash
nvm use            # Node 26 — the engines field requires it
yarn install
```

1. Create a Supabase project, then run [`supabase/schema.sql`](supabase/schema.sql) in its SQL
   editor. It creates the three tables, applies RLS, and seeds the three members. It is idempotent —
   safe to re-run.
2. Copy `.env.example` to `.env.local` and fill in your project URL and **publishable** (or legacy
   **anon**) key:

   ```
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_...
   ```

3. `yarn dev`

Without those vars the app still runs and shows a setup notice rather than crashing.

### Why there is no `NEXT_PUBLIC_` prefix

Deliberate. The key is read only on the server: every read happens in a Server Component and every
write in a Server Action, so the key is never sent to the browser. Use the publishable/anon key,
**never** the secret or `service_role` key — that bypasses Row Level Security.

The trade-off is no live push updates; pages revalidate on write instead. For daily numbers that's
plenty, and it avoids shipping a write-capable credential to the client.

### The shared passcode gate

Set `APP_PASSCODE` and the whole app goes behind one passcode the three of you share. Leave it unset
and the app is open — so a deploy that has not configured it still works exactly as before.

Locked visitors get an intro screen with a **Log in** button that opens a modal; they never reach the
pages, so no data is fetched for them. On success a cookie is set for 90 days.

Three things worth knowing:

- The cookie holds a **hash** of the passcode, never the passcode itself.
- It is still a **bearer token** — anyone who copies the cookie is in until it expires. True of any
  session cookie, and proportionate for keeping a step tracker off the open internet.
- **Every Server Action re-checks the gate.** Hiding the UI is not access control; a Server Action is
  a POST endpoint anyone can call directly, so the check lives there too, not just in the layout.

This is one shared passcode, not accounts. Real per-person authentication means Supabase Auth plus
tightened RLS policies, which slots in behind the same data layer without touching the UI.

### Who you are

The passcode says you may be here; a second step asks *who you are*. Straight after unlocking, a
picker lists the group plus **Visitor**, and the choice is kept in a second 90-day cookie (`fj_who`).

- You **land on your own tab** instead of on whoever sorts first.
- You can see everyone, but the entry forms only appear on **your** tab. Rings, macro bars, logged
  workouts and the compare strip stay visible on everyone else's — comparing the group is the point.
- **Visitor** browses everything and writes nothing. It is a real choice, stored, so it is not asked
  again on the next load.
- The header chip shows who you are and reopens the picker; **Log out** drops both cookies.
- Adding someone offers to sign in as them, which is how a fresh deploy gets its first identity —
  with an empty members table everyone is a visitor, so adding a person stays open to visitors.
- One member, `ADMIN_MEMBER` (default `Angel`), gets a bin beside the tabs to remove people
  entirely. Their logs and workouts cascade away; sessions they booked survive, credited to nobody.

**Every write action re-checks this too**, not just the gate — the hidden `memberId` a form posts can
be edited by hand, so `canEditMember` is applied server-side in each action. `deleteWorkout` looks the
row's owner up first, because that form sends only a row id.

The honest limits: the identity cookie is **self-asserted**, and the admin is matched **by name**.
Anyone with the shared passcode could forge either. It prevents wrong-tab mistakes between three
friends, not a determined person who is already inside — which is the same bargain the passcode
itself makes. Bookings are deliberately left group-wide: anyone can book or remove one.

`robots.txt` disallows everything, so none of this ends up in search results.

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
  page.tsx            Today
  (pages)/sessions/   Sessions
components/           One folder per component: Component.tsx + Component.module.css
data/                 Static data: nav, activity labels, accent slots, playbook defaults
lib/
  supabase/server.ts  Server-only client; returns null when unconfigured
  data/               The only modules that touch Supabase, plus row -> camelCase mappers
  progress.ts         Percent-of-target maths
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

The eight member accents in `globals.css` are categorical slots checked against the dark chart
surface (`--c-surface`, `#141416`) for colourblind separation, chroma and contrast. They are
assigned in fixed order and never generated or cycled — a generated ninth hue is indistinguishable
from an existing one under simulation. A member's colour follows the person, not their position in
the list, and a name always sits beside the colour so identity never depends on colour alone.

If you change `--c-surface` or add an accent, re-validate the set rather than eyeballing it.

Progress indicators are **meters** — one value against its own limit — so the unfilled track is a
lighter step of the fill's own ramp, not a neutral grey. Overshooting a *budget* (calories) is
flagged amber; beating a *goal* (steps, water) is not.
