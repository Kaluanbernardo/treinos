---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: []
---

# Surface: Fitness Kaluan PWA (all tabs)

Scope: the whole mobile web app (Hoje, Treino + sessão em andamento, Evolução, Nutrição, Agenda, Notas, Config, Login).
Mode: Operate. Audience: Kaluan alone, on the gym floor (arm's length, sweaty, low light) and in quick daily check-ins.
Job: know what to do now, log a set in one tap, and see whether the recomposition is working.
Constraints: data entry is chat-first (no forms); pt-BR; dark palette and Inter pinned by app-plan §10; online-only.

## Direction contract

THESIS: A gym-panel dashboard where evolution is the protagonist. It refuses the generic fitness-app feed of equal tiles: each card has one protagonist number and a plain-language reading, and missing data is stated, never charted.

OWN-WORLD: Near-black ground #0E1116, cards stepped by color (#171B22 → #1F2530), hairline #2A3140. Lime #C6F432 is reserved for the action and for PRs; metric colors (kcal orange, protein sky, carb lime, fat violet) only on their data. Inter variable, tabular numbers, heavy numerals at 48–64 px against 14–16 px labels. Authored SVG icons, 2 px stroke, round caps.

STORY: Open → see today's next session and press one lime button → between sets, ✓ in one tap, the rest timer runs itself, PRs flash lime → afterwards, the Evolução tab shows the 7-day weight average, waist and estimated 1RM moving together, with an honest "faltam N registros" while data accumulates.

FIRST VIEWPORT (Hoje, 390×844): greeting row with Notas/Config icon buttons; the Agora card (title 34–40 px, time · details, lime 64 px primary action at the card's bottom); directly under it the Evolução card (hero weight number + the recomposition triad + latest PR seal + week adherence). Daily nutrition mini-rings, creatine toggle and next activity follow, all reachable above the bottom nav with safe-area padding.

FORM: Established world extended (palette, type and 5-tab structure pinned by plan §3/§10). seed:bf5c07637d932d3f (rolled for the record; world and screen structure stay pinned by plan §3/§10).

SIGNATURE: The recomposition triad: peso · cintura · força as one instrument row of drawn arrows with word + value, the same component on Hoje and at the top of Evolução (the week/month summaries sit directly below it and carry the same signals as period numbers, so the triad is not repeated there); plus the lime "PR" seal that pops (haptic double pulse) the moment a confirmed set beats a record.
