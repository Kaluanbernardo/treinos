---
name: Fitness Kaluan
description: Gym-panel PWA (dark by default, with a light theme) where body recomposition is the protagonist, readable at arm's length.
colors:
  bg: "#0E1116"
  card: "#171B22"
  card-2: "#1F2530"
  line: "#2A3140"
  fg: "#F2F4F7"
  muted: "#9AA4B2"
  lime: "#C6F432"
  kcal: "#FF8A3D"
  protein: "#38BDF8"
  carb: "#C6F432"
  fat: "#A78BFA"
  ok: "#34D399"
  warn: "#FBBF24"
  err: "#F87171"
typography:
  display-hero:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\" 1, \"cv11\" 1"
  display:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1, \"cv11\" 1"
  headline:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  numeral:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  title-screen:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title-section:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  title-card:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-secondary:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  badge:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
rounded:
  bar: "4px"
  seal: "6px"
  segment: "8px"
  control: "12px"
  panel: "16px"
  card: "20px"
  sheet: "24px"
  full: "9999px"
spacing:
  hairline: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.bg}"
    typography: "{typography.title-section}"
    rounded: "{rounded.panel}"
    height: "64px"
    padding: "0 24px"
  button-primary-md:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.bg}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.card-2}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  button-ghost:
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
  button-danger:
    textColor: "{colors.err}"
    rounded: "{rounded.control}"
    height: "48px"
  icon-button:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    size: "48px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-raised:
    backgroundColor: "{colors.card-2}"
    rounded: "{rounded.card}"
    padding: "20px"
  inset-panel:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.panel}"
    padding: "8px"
  badge:
    textColor: "{colors.muted}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  chip:
    backgroundColor: "{colors.card-2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 16px"
  chip-selected:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 16px"
  segmented:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "4px"
  segmented-selected:
    backgroundColor: "{colors.card-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.segment}"
    height: "44px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.fg}"
    rounded: "{rounded.panel}"
    height: "56px"
    padding: "0 16px"
  stepper-button:
    backgroundColor: "{colors.card-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    height: "56px"
    width: "64px"
  nav-tab:
    textColor: "{colors.muted}"
    typography: "{typography.badge}"
    height: "64px"
  nav-tab-active:
    textColor: "{colors.lime}"
    typography: "{typography.badge}"
    height: "64px"
  pr-seal:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.bg}"
    rounded: "{rounded.seal}"
    padding: "2px 6px"
---

# Design System: Fitness Kaluan

## Overview

**Creative North Star: "The Gym-Floor Instrument Panel"**

A near-black panel read at arm's length, sweaty, in low light. Each card carries one protagonist number in heavy tabular Inter and a plain-language reading under it; everything else is quiet grey. Density is deliberately low: big cards, few facts per screen, primary actions in the bottom third.

Evolution is the protagonist. The recomposition triad (peso · cintura · força) is the system's instrument row, and missing data is stated in words with what is still needed, never drawn as an empty chart. Lime is the single loud voice: it means "do this", "you did it" or "here, now".

Depth comes from stepping the card colour, not from shadows. Motion is short, eased out, and only confirms: rings grow, the check pops, the PR seal stamps.

**Key Characteristics:**
- Dark ground, cards stepped by colour, 1px hairlines.
- One protagonist numeral per card (34–56px bold, tabular) against 13–16px labels.
- Lime reserved for action, achievement and "now"; metric hues only on their data.
- Every state is colour plus word or icon.
- Honest "coletando dados" states with a count of what is missing.
- 48px minimum touch targets; 56–64px on set confirmation and steppers.

## Colors

A cool near-black ground with one acid-lime voice and four metric hues that live only inside data.

### Primary
- **Gym Lime** (`lime`): the primary action button (with `bg` text on top), PR seal and record trophies, active tab with its 2px top bar, focus outline, input caret, live dot, collected-progress segments, and the "today/now" ring (`lime` at 30–40% as a 1px ring). Text on lime is always `bg`.

### Secondary (metric hues, data only)
- **Ember Orange** (`kcal`): calories ring and kcal series.
- **Sky Protein** (`protein`): protein ring and series.
- **Carb Lime** (`carb`): carbohydrate data; same hex as `lime` by plan §10, so it appears only inside nutrition data, never as a button or label.
- **Soft Violet** (`fat`): fat data.

### Tertiary (status)
- **Mint OK** (`ok`): good direction on the triad, "no rumo" reading, target bands on charts (8–10% fill).
- **Amber Warn** (`warn`): wrong direction, "platô"/"déficit agressivo", the over-target arc on rings, "exceção" badges.
- **Coral Error** (`err`): load errors (`err` at 8% fill, 30% border), "alerta cintura", danger buttons.

### Neutral
- **Pit Black** (`bg`): app ground, text on lime, inset panels at 60–70% (triad, stepper rows), bottom nav at 92% with blur.
- **Panel** (`card`): base card, sheet, segmented track, inputs.
- **Raised Panel** (`card-2`): raised card (Agora, weekly summary, active set), secondary buttons, tooltips, toasts, selected segment.
- **Hairline** (`line`): borders, dividers, ring tracks, dashed collecting outlines, unfilled progress, scrollbar.
- **Chalk** (`fg`): primary text, protagonist numbers, selected chip fill.
- **Slate** (`muted`): labels, units, meta lines, axis ticks, inactive icons.

### Light theme (Claro)
Chosen in Configurações → Tema (Claro · Escuro · Sistema, default Sistema, stored in `localStorage.theme`, applied to `<html data-theme>` by an inline script before first paint). Same token names, overridden under `:root[data-theme="light"]` in `web/src/index.css`; the `dark:` / `light:` Tailwind variants follow the attribute, not the media query. Elevation still goes toward light: ground `#E8ECF1`, `card` `#F7F9FB`, `card-2` `#FFFFFF`, `line` `#CDD4DE`, `fg` `#10141B`, `muted` `#4F5A69`. Inks are darkened so every one passes AA (≥4.5:1) on bg, card and card-2: `lime` `#456F0A`, `kcal` `#B23C0A`, `protein` `#0369A1`, `carb` `#456F0A`, `fat` `#6D28D9`, `ok` `#047857`, `warn` `#A14A06`, `err` `#B91C1C`; chart grid `--color-grid`, float shadows `--shadow-toast` / `--shadow-tip`.

**Lime is two tokens.** `lime` is the ink (text, strokes, rings, dots, 15% tints) and darkens in light. `action` is the vivid `#C6F432` fill of the primary button, PR seal, today disc and check, always with `on-action` (`#0E1116`) text, via the `action-fill` utility, which adds a 1px inner olive edge in light so the fill holds its shape on white. Never put `text-bg` on a lime fill.

### Named Rules
**The One Lime Rule.** Lime marks action, achievement and "now", nothing else. A screen has one solid-lime button at most; other lime is rings, seals, dots and 15%-tint badges.

**The Data-Owns-Its-Hue Rule.** `kcal`, `protein`, `carb` and `fat` appear only on their own numbers, rings and series. Never as decoration, headings or buttons.

**The Colour-Plus-Word Rule.** No state is carried by colour alone: triad arrows carry a drawn arrow plus "caindo/estável/subindo", badges carry text, modality dots sit beside the modality name.

## Typography

**Display Font:** Inter Variable (self-hosted via @fontsource-variable, fallback Inter, system-ui)
**Body Font:** the same Inter Variable
**Label/Mono Font:** none distinct; `font-mono` only for config keys.

**Character:** One family, contrast carried by weight and size alone. Tabular figures (`tnum`) and the open-digit alternate (`cv11`) are on globally so numbers never jitter while they change.

### Hierarchy
- **Display hero** (700, 56px, 1, -0.03em): the single weight number on the Hoje Evolução card.
- **Display** (700, 44px, 1, -0.02em): hero numbers on Evolução (7-day average, top e1RM) and the session hero stat.
- **Headline** (700, 36px, 1.05, -0.02em, balanced wrap): the Agora / active-session title.
- **Numeral** (700, 32–34px, 1): rest timer, kcal remaining, the summary's hero stat, session title.
- **Title, screen** (700, 28px, -0.02em): screen header h1; also the stepper value.
- **Title, section / card** (600, 20px / 18px): section headings outside cards and sheet titles / card headings.
- **Body** (400, 16px): the minimum running text size. **Body secondary** (15px, 1.6): readings, explanations, toasts.
- **Label** (400, 13–14px, `muted`): stat labels, triad labels, sub-lines. **Badge / nav** (600 or 500, 12px).

### Named Rules
**The One Protagonist Rule.** Each card has exactly one numeral at 32px or larger; everything around it is 13–16px. If two numbers compete, one becomes a label line.

**The Unit Steps Down Rule.** Units and denominators sit beside the number at base or `text-lg` size, normal weight, `muted` ("81,9 kg", "2/9").

## Layout

Single mobile column, max width 512px (`max-w-lg`) centred, 16px side gutter, `min-h-100dvh`. Top padding respects the safe area (min 16px). The sticky bottom nav (64px tabs) and toasts (88px above the bottom inset) respect `safe-area-inset-bottom`. The fullscreen session view drops the nav.

Rhythm is a 4px base: 8 / 12 / 16 px gaps inside cards, 16px between cards, 20px card padding, 16px inner-panel padding. Two-column grids only for paired stats (summary stats, Feito / Faltei). The triad is always three equal columns divided by hairlines.

## Elevation & Depth

Flat by colour. Depth goes `bg` → `card` → `card-2`; inset instruments drop back to `bg` at 60–70% with a 1px `line` ring. Shadows exist only on floating layers that leave the page plane.

### Shadow Vocabulary
- **Toast float** (`box-shadow: 0 8px 24px -8px rgb(0 0 0 / 0.6)`): toasts.
- **Tooltip float** (`box-shadow: 0 8px 20px -8px rgb(0 0 0 / 0.7)`): chart tooltips.
- **Segment lip** (`box-shadow: inset 0 1px 0 0 var(--color-line)`): the selected segment.

### Named Rules
**The Elevation-Is-Colour Rule.** A card that needs more emphasis moves to `card-2` and, if it means "now", gets a 1px lime ring at 30–40%. It never gets a shadow.

## Shapes

Soft, large corners scaled to the element: cards 20px, sheets 24px on top, inner panels / list rows / large buttons 16px, controls 12px, segments 8px, the PR seal 6px, bar tops 4px. Pills (`full`) for badges, chips, progress segments and dots. Borders are 1px `line`; dashed only for collecting states. Ring arcs and progress use round caps.

## Components

### Buttons
Tactile, heavy and bottom-weighted.
- **Shape:** 12px at md (48px tall), 16px at lg/xl (56 / 64px tall).
- **Primary:** lime fill, `bg` text, semibold; xl (64px, 20px text) for the card's main action, full width.
- **Secondary:** `card-2` fill, 1px `line` border, `fg` text; border lifts toward `muted` on hover.
- **Ghost / Danger:** muted text going to `fg` on hover / `err` text on 12% `err` tint with a 30% border.
- **States:** 150ms transitions, press scales to 0.98, disabled at 50% opacity, focus is the global 2px lime outline at 2px offset.
- **Icon button:** 48×48, 12px radius, `muted` going to `fg` on a `card` hover.

### Chips and Badges
- **Badge:** pill, 12px semibold, tone at 15% tint with full-strength text (`lime`, `ok`, `warn`, `err`, metric hues); neutral is `line` at 60% with `muted` text. It may lead with the live dot.
- **Chip (exercise / metric picker):** 40px pill, `card-2` with `muted` text; selected inverts to `fg` fill with `bg` text. A completed exercise chip is lime at 15%.
- **Segmented control:** `card` track with 4px padding; the selected segment is `card-2` with a hairline inset lip; 44px (md) or 40px (sm).

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** `card` by default, `card-2` for the hero or active card.
- **Shadow Strategy:** none (see Elevation).
- **Border:** none; emphasis is a 1px lime ring at 30–40%.
- **Internal Padding:** 20px. Header is an 18px semibold h2 with an optional muted sub-line and right-aligned aside.

### Inputs / Fields
- **Style:** 56px tall, 16px radius, `card` fill, 1px `line` border, lime caret.
- **Focus:** the border turns lime; inline stepper editing uses a 2px lime ring.

### Navigation
Five tabs (Hoje, Treino, Evolução, Nutrição, Calorias) in a sticky bar. Agenda left the bar for Calorias and opens from Hoje (week strip, next activity, "Treinos na semana") with a back arrow: `bg` at 92% with backdrop blur and a top hairline. 64px targets, 22px icon over a 12px medium label. Active: the icon sits in a 56×32 `lime`/15 pill with a lime 2.4 stroke and the label turns `fg`; inactive is `muted`.

### Recomposition Triad (signature)
Three equal cells (Peso · Cintura · Força) on an inset `bg`/60 panel with a 16px radius, a hairline ring and hairline dividers. Each cell: 13px label, then a drawn arrow (22–26px, 2.5 stroke) plus a word ("caindo / estável / subindo"), coloured `ok` when moving the good way, `warn` when moving the wrong way, `fg` when flat; then a 13px tabular delta. With no data, the cell shows an hourglass plus when the arrow will appear ("seta em 12/11", "sem pesagem"). It is the same component on Hoje and Evolução.

### Calorias (in × out)
Gasto = basal (Mifflin-St Jeor) + rotina (basal × 0,20) + exercício (watch active kcal, or a MET estimate); saldo = comida − gasto. Rule and the NEAT-factor choice: `docs/calorias.md`. Food keeps the `kcal` hue; expenditure is a neutral `fg` ramp (basal 30 %, rotina 15 %, exercício solid; estimated exercise is striped plus an "estimado" badge) so no other metric hue is borrowed. The hero is the day's saldo (44px, signed) with an arrow + word badge (déficit / superávit / déficit alto, never "alto" on the day still in progress) over two bars on one scale (Entrou / Saiu). The period chart is diverging bars from zero in `kcal` with the selected day full and the rest at 45 %, the target as a dashed `ok` line. Without height, birth date or sex the basal, gasto and saldo stay blank and a card sends to Configurações → Perfil (the only data-entry form in the app, by explicit request).

### PR Seal (signature)
A lime 6px-radius tag with "PR" in 12px black weight and `bg` text. It stamps in (520ms scale + rotate, eased out) with a double haptic pulse the moment a confirmed set beats a record. Records elsewhere use a lime trophy icon.

### Set Stepper
A row on an inset `bg`/70 panel with a hairline ring: label (+ unit), a 64×56 minus, the value at 28px bold tabular (tap to type; a pencil icon when empty), and a 64×56 plus. Each bump gives an 8ms haptic. "Confirmar série" is the xl lime button below it. A confirmed set shows a 36px lime check circle that pops.

### Rings
SVG ring with a `line` track, a round-capped arc in the metric colour, and value and target centred. Above target, an inner amber (`warn`) arc at 45% stroke shows the excess. The arc grows over 600ms on open.

### Charts
- Trend: a 2px line in the metric colour (7-day average for weight), the area under it a gradient from 15% to 0, daily values as 3px `muted` dots. Grid is horizontal only at `line`/55%. Axes are 12px `muted` with no axis or tick lines. Only the last value is labelled (13px bold `fg`). Target is an `ok` band at 8% or a dashed `muted` line. Draw time 500ms.
- Bars: single series, 4px top corners, non-highlighted bars at 45% opacity.
- Tooltip on touch: `card-2`, hairline border, 12px radius, tabular values, date in `muted`.

### States
- **Coletando dados:** a 16px-radius dashed `line` outline with an hourglass, a plain sentence of what is missing, and an optional segmented progress bar (lime collected, `line` remaining) with "N de M registros · faltam K". It replaces the chart; never draw an empty axis.
- **Loading:** flat `card` blocks at card radius and final size, pulsing opacity over 1.4s (no shimmer gradient).
- **Error:** `role="alert"` panel, `err` 8% fill and 30% border, warning icon plus "Não consegui carregar …", an offline-aware sub-line, and a secondary "Tentar de novo" button.
- **Toast:** `card-2`, hairline (lime or err border by tone), 15px text, optional lime text action; slides up in 220ms.
- **Sheet:** native dialog bottom sheet, `card`, 24px top radius, a grab handle, `black`/60 backdrop, rises in 260ms.

### Visual primitives (`web/src/components/viz.tsx`, inline SVG)
Copy is the last resort: a number, a mark or a bar says it first, and at most one short line explains.
- **Rings:** concentric arcs (outside → in), track = the arc's own hue at 16%, round caps; Hoje uses treinos (lime) · kcal · proteína. Single rings (`Ring.tsx`) for kcal, session progress, rest countdown and finish %.
- **Meter:** 6–8px pill bar at the true ratio; a 2px `fg` tick marks a single target, an `ok`/25 band marks a min–max range; overshoot past a tick turns `warn`.
- **Spark:** 2px line in the metric hue, 15% fade, last point dotted; never drawn with fewer than 2 points (3 on Hoje).
- **Delta:** drawn arrow + signed value; `ok` when moving the good way, `warn` the wrong way, `muted` when flat.
- **Big:** the protagonist numeral (56 / 44 / 32 / 24px, bold, tabular) with a `muted` unit.
- **WeekStrip:** Mon–Sun columns; today is a lime disc, a fully done day an `ok` check, one pip per activity (dot = feito, ring = a fazer/sem registro, ✕ icon = faltou, dash = pulado).
- **PlanBars:** weekly columns, track = planned, fill = done; the current week is lime, past weeks `muted`.
- **DateTile:** 56px "Qua / 28" tile, lime when it is today.

### Motion
One easing, `cubic-bezier(0.16, 1, 0.3, 1)`. State transitions take 150ms; rings, bars and charts grow over 500–600ms. Confirmations: check pop 320ms, PR seal 520ms, live dot pulse 1.8s. `prefers-reduced-motion` zeroes all durations.

## Do's and Don'ts

### Do:
- **Do** keep text on lime in `bg` and use one solid-lime button per screen, placed in the bottom third of its card.
- **Do** pair every status colour with an arrow, icon or word (The Colour-Plus-Word Rule).
- **Do** replace any chart without enough data with the Collecting state, stating how many records are missing.
- **Do** give every tappable element at least 48px, and 56–64px for set confirmation and steppers.
- **Do** step emphasis by surface colour (`card` → `card-2`) and a 1px lime ring at 30–40% for "now".
- **Do** use tabular figures for every changing number and label only the last value on a trend.
- **Do** respect `prefers-reduced-motion` and add haptics only to confirmations (15ms check, 8ms stepper, double pulse PR).

### Don't:
- **Don't** use `kcal`, `protein`, `carb` or `fat` outside their own data.
- **Don't** put drop shadows on cards; shadows belong only to toasts and tooltips.
- **Don't** draw an empty or one-point chart to fill space.
- **Don't** put two protagonist numerals of 32px or more in the same card.
- **Don't** set running text below 14px; 12–13px is for labels, badges and meta lines only.
- **Don't** make a hidden gesture the only way to do something.
