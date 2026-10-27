# Product

<!-- impeccable:product-schema 1 -->

> Written without a live interview (no question tool in the session that created it). Every fact comes
> from Kaluan's own words quoted in `../app-plan.md` and the build brief; items marked *(inferred)* are
> assumptions to confirm.

## Platform

web

## Users

One user, forever: **Kaluan**, Brazilian, pt-BR, ~94 kg, about 3 months into structured training, aiming
for **body recomposition** (lose fat, gain muscle) on a light deficit (~300 kcal/day). He trains ~9 sessions a
week at Pugna (6 a.m. weight training, evening muay thai, jiu-jitsu, cross, Saturday functional).
Two usage scenes:
- **On the gym floor**: phone at arm's length, sweaty hands, poor light, between sets, one hand free.
- **Checking in**: morning or evening glance at the day, the week, and above all whether he is progressing.

## Product Purpose

A personal dashboard plus quick taps. Kaluan's main interface is the **chat with his assistant**, which
logs meals (from photos or text), loads, sessions, weight, measurements, progress photos and schedule
changes straight into the database. The app exists so he can **see his evolution** ("o app é importante para
eu acompanhar minha evolução"), know what to do now, and log a workout set in one tap.
Success: he opens it daily, trusts the numbers (the same numbers the assistant quotes in chat), and can tell
within seconds whether the recomposition is on track.

## Positioning

Not a fitness app for anyone else. It is shaped entirely around his schedule, his routines, and a chat-first
workflow. Recomposition is judged by **three signals together** (7-day average weight, waist, strength via
estimated 1RM), never by weight alone.

## Operating Context

- Data enters through chat → assistant → `scripts/fit` → Supabase. The app has no forms for weight,
  measurements, meals or photos.
- The app writes only gym-floor events: sets (✓ in one tap, ±2.5 kg / ±1 rep), session start/finish,
  Feito/Faltei for classes, the daily creatine check.
- Weekly cadence: weight daily (≥3×/week), waist weekly, other measurements and progress photos monthly.
- Online-only; the gym signal is a known risk.

## Capabilities and Constraints

- Five tabs: Hoje · Treino · Evolução · Nutrição · Agenda; Notas (assistant notes) and Config as header icons.
- Evolution needs weeks of data. Early on, most blocks honestly say what data is still missing.
- No multi-user, onboarding, settings, food search, or in-app photo upload (all out of scope by decision).
- Progress photos are private (signed URLs, ~10 min) and never cached by the service worker.

## Brand Commitments

- Dark "gym panel" look with the palette pinned in plan §10 (lime `#C6F432` action, metric colors for
  kcal/protein/carb/fat). Inter, tabular numbers, one protagonist number per card.
- Voice: direct, warm, short pt-BR; honest about missing data; never guilt-trips (streaks reward completed
  weeks, rescheduling never breaks them).

## Evidence on Hand

Real data only: the seeded schedule, workout templates (TAREFA.md), goals, first weight (94 kg on 27/10/2026),
TACO 4ª ed. foods. No invented history in the real database; synthetic data lives only in
`supabase/test/dev_synthetic.sql` for local verification.

## Product Principles

1. Evolution first: every screen should make progress (or its absence) legible.
2. One tap on the gym floor; everything else goes through the chat.
3. Honest numbers: show what is missing instead of a misleading chart.
4. Same rule everywhere: app and assistant read the same database views.
5. Readable at arm's length: big numbers, big targets, high contrast.

## Accessibility & Inclusion

High contrast (text ≥7:1 on background), state never conveyed by color alone, touch targets ≥48 px,
`prefers-reduced-motion` respected *(inferred: no specific accessibility needs stated beyond the plan)*.
