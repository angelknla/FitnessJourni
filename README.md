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

### No login, by design

Anyone who can open the app can edit anyone's numbers, and nothing records who changed what. That's
a deliberate v1 choice for three friends. The upgrade — a shared passcode, or Supabase Auth with
tightened RLS policies — slots in behind the same data layer without touching the UI.

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
