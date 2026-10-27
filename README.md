# Fitness Kaluan — F0 (Fundação)

PWA pessoal (single user) sobre Supabase. O app é um painel; a entrada de dados é pelo chat (o assistente
escreve direto no banco com o role `bot`). Plano completo: `../app-plan.md`.

## Estrutura

```
supabase/
  migrations/                      SQL versionado (estilo Supabase CLI, aplicado em ordem)
    20261027120000_schema.sql      enum modality, tabelas, trigger updated_at, today_sp()
    20261027120100_views.sql       plan_between/plan_with_sessions + todas as views v_*
    20261027120200_security.sql    app_config + is_owner(), RLS, role bot, grants (anon sem nada)
  seed.sql                         exercícios, fichas A/B, grade base, exceções de 27–28/10, metas
  test/00_supabase_stubs.sql       SÓ TESTE: emula roles/auth do Supabase num Postgres local
  test/dev_synthetic.sql           SÓ DEV: ~8 semanas de dados sintéticos (nunca no banco real)
scripts/                           bash + psql (nenhum imprime URL, senha ou chave)
web/                               Vite + React + TS + Tailwind + vite-plugin-pwa + supabase-js + TanStack Query
```

### Banco
- Tabelas: `goals`, `body_metrics` (1 linha por data), `progress_photos`, `exercises` (`main_lift`),
  `workout_templates`, `template_exercises`, `schedule_slots`, `schedule_overrides`
  (`skip` | `replace` | `add`), `sessions`, `set_logs` (`warmup`), `foods`, `food_portions`,
  `food_logs` (snapshot de macros, `estimated`), `daily_checks`, `bot_notes`. Sem `user_id`.
  Colunas comuns: `id`, `created_at`, `updated_at` (trigger), `source` (`app` | `bot`).
- Dono: `public.app_config.owner_uuid` (1 linha, começa **NULL** = ninguém acessa). `is_owner()` é
  `security definer` e compara com `auth.uid()`.
- RLS em todas as tabelas: `to authenticated using (is_owner())` + `to bot using (true)`. `anon` não tem grant algum.
- `bot`: `NOLOGIN NOBYPASSRLS` na migration; SELECT/INSERT/UPDATE nas tabelas do app, DELETE só em
  `schedule_overrides`, `food_logs`, `set_logs`, `body_metrics`; SELECT nas views; sem DDL, sem `auth`.
- Views (`security_invoker`): `v_today`, `v_week`, `v_last_sets`, `v_daily_nutrition`, `v_weight_trend`
  (média 7d por janela de data), `v_e1rm` (Epley, 1–12 reps, sem aquecimento), `v_e1rm_session`
  (top set, volume, PR de volume), `v_prs` (flags `is_load_pr` / `is_e1rm_pr` / `is_pr`), `v_pr_bests`,
  `v_recomposition` (3 setas com limiares 0,3 kg / 0,5 cm / 2 % + texto de leitura), `v_streaks`,
  `v_weekly_summary`, `v_monthly_summary`. Corte de dia/semana em `America/Sao_Paulo`.

## Scripts

Conexão admin: variável `SUPABASE_DB_URL` **ou** arquivo `/home/box/.secrets/fitness_db_url` (chmod 600).
Use a connection string **Session pooler** (`*.pooler.supabase.com:5432`, usuário `postgres.<project_ref>`)
se a conexão direta (IPv6) não funcionar no box.

| Script | O que faz |
|---|---|
| `scripts/apply_migrations.sh [--no-seed]` | aplica as migrations novas em ordem (registro em `public._migrations` com checksum) e o seed (idempotente) |
| `scripts/create_bot_role_password.sh` | senha aleatória (`openssl rand`), `ALTER ROLE bot LOGIN PASSWORD`, grava a URL do bot em `/home/box/.secrets/fitness_bot_db_url` (600). No pooler o usuário vira `bot.<project_ref>`. Rodar de novo = rotacionar a senha |
| `scripts/create_login_user.sh [email]` (padrão kaluanbernardo@gmail.com) | cria o usuário pela Admin API (`SUPABASE_SERVICE_ROLE_KEY` ou `/home/box/.secrets/fitness_service_role_key`), grava a senha temporária em `/home/box/.secrets/fitness_login_password` (600) e chama `set_owner.sh` |
| `scripts/set_owner.sh <uuid>` | grava o UUID do dono em `app_config` |
| `scripts/backup_nightly.sh` | `pg_dump -Fc` do schema `public` em `/home/box/backups/fitness/`, retenção de 30 dias (`BACKUP_SCHEMAS="public auth"` para incluir mais) |
| `scripts/keepalive.sh` | `select 1` com a URL do bot; se falhar, ping REST com a anon key; log em `/home/box/backups/fitness/keepalive.log` |
| `scripts/verify_local.sh` | sobe um Postgres 17 descartável em `/tmp/pgtest:54329`, aplica stubs + migrations + seed (2×) + sintéticos, consulta todas as views e testa bot/anon/authenticated e os scripts. Sai ≠ 0 em falha |

**Fallback sem service role key:** Dashboard → Authentication → Users → *Add user* (marcar *Auto Confirm
User*), copiar o UUID e rodar `scripts/set_owner.sh <uuid>`.

### Ordem para colocar no ar

```bash
export SUPABASE_DB_URL=...            # ou arquivo /home/box/.secrets/fitness_db_url
scripts/apply_migrations.sh
scripts/create_bot_role_password.sh
SUPABASE_SERVICE_ROLE_KEY=... scripts/create_login_user.sh <email>
```

Depois, **desligar o cadastro público** (não dá para fazer por SQL no Supabase hospedado):
Dashboard → Authentication → Sign In / Providers → desmarcar **"Allow new users to sign up"**.
(Mesmo que ele fique ligado, a RLS só libera o UUID do dono.)

### Cron sugerido (NÃO instalado)

```cron
# backup 03:30 e keepalive 09:00 (horário do box)
30 3 * * * /caminho/para/app/scripts/backup_nightly.sh >> /home/box/backups/fitness/backup.log 2>&1
0 9 * * *  /caminho/para/app/scripts/keepalive.sh
```

## Front (`web/`)

```bash
cd web
cp .env.example .env.local   # preencher VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # ou: npm run build  (gera dist/ com service worker + manifest)
npm run icons                # regenera os PNGs em public/icons (sharp)
```

Sem a anon key o app mostra a tela amigável "Quase lá" em vez de quebrar. A F0 entrega: login com e-mail +
senha (sem cadastro), a aba **Hoje** (card "Agora" lendo `v_today`, botão "Iniciar treino" ainda sem ação,
card de Evolução com `v_recomposition`, itens pulados e próxima atividade via `v_week`) e as outras 4 abas
como "Em breve (F1)". Tema escuro com a paleta da seção 10 do plano; manifest "Fitness Kaluan" / "Fitness",
cor `#0E1116`, ícones 192/512 + maskable.

## Estado atual (27/10/2026) — aplicado via HTTPS

As portas 5432/6543 estão bloqueadas no box, então tudo foi feito pela **Supabase Management API**
(`POST /v1/projects/qlphmxjehsexuxspspaw/database/query`, token em `$SUPABASE_ACCESS_TOKEN` ou
`/home/box/.secrets/supabase_access_token`, 600). Os scripts psql acima continuam válidos para quando houver acesso direto.

- 5 migrations aplicadas (registradas em `public._migrations`, incluindo `20261027190000_bot_set_role.sql`,
  que faz `grant bot to postgres with set true, inherit false` para o admin poder executar *como* bot) + seed.
- Usuário de login criado (Admin API, e-mail confirmado), senha em `/home/box/.secrets/fitness_login_password` (600);
  `app_config.owner_uuid` gravado. Chaves anon/service_role em `/home/box/.secrets/fitness_supabase_keys.env` (600).
- Cadastro público **desligado** via `PATCH /v1/projects/{ref}/config/auth {"disable_signup": true}` (verificado: signup → 422).
- `web/.env.local` (não versionado) com URL + anon key; `npm run build` ok.

### Acesso do bot: `scripts/fit` (HTTPS, executa como role `bot`)

Cada chamada vira `begin; set local role bot; <um comando>; commit;` — RLS e grants mínimos do `bot` valem
(DDL e `auth` negados). O CLI recusa `;`, `$`, comentários e palavras de controle (`role`, `reset`, `begin`,
`commit`, `set_config`...) para impedir sair do role. Obs.: o token da Management API é de admin; o isolamento é
do CLI, não do token.

```bash
scripts/fit sql "select * from v_week"      # SQL arbitrário como bot (um comando)
scripts/fit today                            # v_today
scripts/fit body 93.8 [101.5] [--date 2026-10-27]   # upsert peso (e cintura) do dia
scripts/fit evo                              # v_recomposition + v_weight_trend
scripts/fit admin-sql "..."                  # manutenção como postgres (evitar)
```

### Backup e keepalive (instalados no crontab do box, CRON_TZ=America/Sao_Paulo)

```cron
30 3 * * * /workspace/fitness/app/scripts/backup_https.sh >> /workspace/fitness/backups/backup.log 2>&1
0 9 * * * /workspace/fitness/app/scripts/keepalive_https.sh
```
`backup_https.sh`: JSON (gzip) de todas as tabelas de `public` em `/workspace/fitness/backups/`, retenção 30 dias
(não inclui `auth`). `keepalive_https.sh`: consulta leve como bot, log em `/workspace/fitness/backups/keepalive.log`.

## Pendências (do Kaluan / próximos passos)

1. ~~anon key~~ (feito) — falta colocá-la nas env vars do Cloudflare Pages no deploy.
2. **Connection string do Session pooler** com a senha do banco → `/home/box/.secrets/fitness_db_url` (600).
   Este box não alcança as portas 5432/6543 hoje, então as migrations **ainda não** foram aplicadas no projeto remoto.
3. **E-mail do login** → `create_login_user.sh` (ou o fallback do Dashboard + `set_owner.sh`).
4. **Desligar o cadastro público** no Dashboard (acima).
5. Instalar os crons (acima) e configurar o deploy (Cloudflare Pages: raiz `web/`, `npm run build`, saída `web/dist`).
6. F1: peso atual, cintura de base e links do YouTube (`exercises.video_url`), tudo pelo chat.

Nota: o Crossfit feito em 27/10 não está no seed (o seed só tem o plano); quem registra isso em `sessions` é o bot.
