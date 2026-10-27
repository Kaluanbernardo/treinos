# CLAUDE.md — Fitness Kaluan

Personal PWA for **one person, forever: Kaluan** (pt-BR, ~94 kg, recomposition goal: lose fat, gain muscle
in a ~300 kcal/day deficit). The app is a **dark, visually rich dashboard + quick taps**. Almost all data
entry happens **in the chat with his assistant**, which writes to the database through `scripts/fit`.
**Tracking his evolution is the app's main job** (Evolução screen and the evolution card on Hoje are first-class).

Full product plan (pt-BR, authoritative): `../app-plan.md`. Product context for design work: `PRODUCT.md`.

## Hard rules

- Single owner, hardcoded. No multi-user, signup, onboarding, settings screens, or data-entry forms
  (weight, measurements, meals, photos all come through the chat). The only writes the app makes are the
  gym-floor taps: workout sets/sessions, Feito/Faltei, creatine check.
- UI copy is **pt-BR**. Code, identifiers and comments may be English or Portuguese; match the file.
- Never print or commit secrets. `.env*` is gitignored. Secrets live in `/home/box/.secrets/` (chmod 600).
- Never rewrite git history or force-push. Commit per logical phase.

## Stack

- `web/`: Vite + React 19 + TypeScript + Tailwind v4 (`@theme` tokens in `web/src/index.css`),
  `vite-plugin-pwa`, `@supabase/supabase-js`, TanStack Query (optimistic writes), Recharts, Inter (self-hosted).
- `supabase/`: Postgres on Supabase (project `qlphmxjehsexuxspspaw`, sa-east-1). Shared logic lives in
  **views** (`v_*`, all `security_invoker`) so the app and the assistant show the same numbers.
- `scripts/`: `fit` (assistant CLI, Python, HTTPS), migration/backup/keepalive helpers.

## Run

```bash
cd web
cp .env.example .env.local      # VITE_SUPABASE_URL=https://qlphmxjehsexuxspspaw.supabase.co
                                # VITE_SUPABASE_ANON_KEY=<anon key, from /home/box/.secrets/fitness_supabase_keys.env>
npm install
npm run dev                     # http://localhost:5173/treinos/
npm run build                   # tsc -b && vite build → web/dist (must pass before every push)
npx vite build --base / --outDir /tmp/fitprev   # root-based preview build for local screenshots
```

Login: Kaluan's e-mail + password (password in env `FITNESS_APP_PASSWORD` /
`/home/box/.secrets/fitness_login_password`). Without the anon key the app shows a friendly "Quase lá" screen.

## Deploy

Push to `main` → GitHub Actions (`.github/workflows/pages.yml`) builds `web/` with repo secrets
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and publishes to GitHub Pages:
**https://kaluanbernardo.github.io/treinos/** (Vite `base: '/treinos/'`, hash routing so deep links never 404).
Check with `gh run list --limit 3` / `gh run watch <id>`.

## Database rules

- Every schema change is a new file in `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`. Never edit an
  applied migration; write a new one. Make migrations idempotent where practical (`if not exists`, `create or replace`).
- **The assistant applies migrations.** Postgres ports are blocked on the box, so apply over HTTPS with
  `scripts/apply_migrations_https.py` (Supabase Management API, token from
  `/home/box/.secrets/supabase_access_token`). It runs each new file plus its row in `public._migrations`
  (version, name, sha256 checksum) in one transaction. `scripts/apply_migrations.sh` is the psql equivalent.
- Test migrations locally first: `scripts/verify_local.sh` (throwaway Postgres 17 + Supabase stubs + seed +
  synthetic data + permission checks). `supabase/test/dev_synthetic.sql` is **dev only, never the real DB**.
- RLS on every table: `to authenticated using (is_owner())` (owner UUID in `app_config`) + `to bot using (true)`.
  `anon` has no grants at all. New tables/views must repeat the grants explicitly
  (`revoke all ... from public, anon; grant ... to authenticated, bot`).
- No `user_id` columns. Common columns: `id`, `created_at`, `updated_at` (trigger), `source` (`app` | `bot`).
  Every bot write uses `source = 'bot'`. Dates are local `America/Sao_Paulo` (`today_sp()`).
- Role `bot`: NOLOGIN/NOBYPASSRLS, SELECT/INSERT/UPDATE on app tables, DELETE only where granted, no DDL, no `auth`.

## How the assistant reads and writes data

All through `scripts/fit` (runs each statement as `set local role bot` over the Management API; one statement
per call; refuses role/transaction escapes). `scripts/fit --help` lists every command. Main ones:
`today`, `week`, `session` (fiz/faltei), `log-set`, `carga`, `move` / `skip` / `add` (schedule overrides),
`body` (weight + measurements), `photo` (progress photos → private bucket), `food` (TACO search), `meal`,
`creatine`, `note`, `notes`, `evo`, `summary`, `videos`, `sql "<select>"`. Autonomy rules and chat rituals are in
`docs/assistente.md`. Meaningful changes always get a `bot_notes` row (shown on the app's Notas screen).

## Design direction

Dark gym dashboard (plan §10), legible at arm's length, sweaty, in low light: background `#0E1116`, cards
`#171B22` / `#1F2530`, line `#2A3140`, text `#F2F4F7` / `#9AA4B2`, action lime `#C6F432` (dark text on it),
kcal `#FF8A3D`, protein `#38BDF8`, carb `#C6F432`, fat `#A78BFA`, ok `#34D399`, warn `#FBBF24`, err `#F87171`.
Inter with tabular numbers; one protagonist number per card (48–64 px); body ≥16 px; touch targets ≥48 px
(56–64 px for ✓ and ±); radius 16–20 px, elevation by card color, no heavy shadows. State is never color-only
(icon + text). Charts: 2 px line in the metric color, 15 % gradient area, near-invisible grid, last value
labeled. Motion 150–600 ms, honoring `prefers-reduced-motion`. Every block with too little data shows an honest
"coletando dados" state saying what is missing, never an empty or misleading chart.

**Use the impeccable skill (`.claude/skills/impeccable`) for all UI work**: read its `SKILL.md`, run its
`context` step, follow `reference/craft-floor.md` before editing UI, and use its commands (critique, audit,
polish, clarify, harden, onboard) for reviews. `PRODUCT.md` / `DESIGN.md` hold the product and design context.
