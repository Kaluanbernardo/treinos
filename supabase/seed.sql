-- Seed versionado: exercícios, fichas (TAREFA.md), grade base, exceções desta semana e metas.
-- Idempotente: pode rodar de novo sem duplicar.

begin;

-- ---------------------------------------------------------------- metas
insert into public.goals (singleton, deficit_kcal, protein_g_per_kg_min, protein_g_per_kg_max,
                          creatine_g_min, creatine_g_max, water_ml_per_kg_min, water_ml_per_kg_max,
                          max_loss_pct_week, peso_ref_kg, note)
values (true, 300, 2.0, 2.2, 3, 5, 35, 40, 0.5, 94,
        'kcal-alvo = TDEE − 300, calculado pelo assistente a partir do 1º peso. Recalcular a cada 2 semanas.')
on conflict (singleton) do update set
  deficit_kcal = excluded.deficit_kcal,
  protein_g_per_kg_min = excluded.protein_g_per_kg_min,
  protein_g_per_kg_max = excluded.protein_g_per_kg_max,
  creatine_g_min = excluded.creatine_g_min,
  creatine_g_max = excluded.creatine_g_max,
  water_ml_per_kg_min = excluded.water_ml_per_kg_min,
  water_ml_per_kg_max = excluded.water_ml_per_kg_max,
  max_loss_pct_week = excluded.max_loss_pct_week,
  peso_ref_kg = excluded.peso_ref_kg;
-- proteína: protein_g_min/max são colunas geradas (94 kg → 188–207 g)

-- ---------------------------------------------------------------- 1º peso (dito no chat em 27/10/2026)
insert into public.body_metrics (date, peso_kg, source)
values ('2026-10-27', 94, 'bot')
on conflict (date) do update set peso_kg = excluded.peso_kg, source = excluded.source;

-- ---------------------------------------------------------------- exercícios
insert into public.exercises (slug, name, muscle_group, main_lift, tips) values
  ('supino_reto',            'Supino reto',                    'peito',            true,  'Escápulas retraídas e pés firmes. Barra desce na linha do mamilo, cotovelos ~45°.'),
  ('puxada_frontal',         'Puxada frontal',                 'costas',           true,  'Peito alto, puxe com os cotovelos em direção às costelas. Sem balançar o tronco.'),
  ('desenvolvimento_halteres','Desenvolvimento com halteres',  'ombros',           true,  'Core firme, sem arquear a lombar. Halteres sobem levemente à frente da cabeça.'),
  ('remada_curvada',         'Remada curvada',                 'costas',           true,  'Tronco ~45°, coluna neutra. Puxe a barra até o umbigo e controle a descida.'),
  ('elevacao_lateral',       'Elevação lateral',               'ombros',           false, 'Cotovelos levemente flexionados, suba até a linha do ombro. Sem impulso.'),
  ('triceps_corda',          'Tríceps na corda',               'tríceps',          false, 'Cotovelos colados ao corpo; abra a corda no final do movimento.'),
  ('barra_fixa',             'Barra fixa',                     'costas',           true,  'Comece pendurado com ombros ativos; suba até o queixo passar a barra. Elástico se < 6 reps.'),
  ('supino_inclinado_halteres','Supino inclinado com halteres','peito',            true,  'Banco a 30°. Desça controlado até alongar o peito, suba sem bater os halteres.'),
  ('remada_unilateral',      'Remada unilateral',              'costas',           true,  'Apoie mão e joelho no banco; puxe o halter em direção ao quadril.'),
  ('face_pull',              'Face pull',                      'ombros (posterior)',false, 'Polia na altura do rosto; puxe abrindo as mãos e girando os ombros para fora.'),
  ('rosca_direta',           'Rosca direta',                   'bíceps',           false, 'Cotovelos fixos ao lado do corpo; sem balançar o tronco.'),
  ('pendurar_barra',         'Pendurar na barra',              'pegada',           false, 'Ombros ativos, respiração calma. Pare ~5 s antes de soltar.'),
  ('agachamento_livre',      'Agachamento livre',              'quadríceps',       true,  'Joelhos na direção dos pés, tronco firme. Desça até onde mantém a coluna neutra.'),
  ('leg_press_45',           'Leg press 45°',                  'quadríceps',       true,  'Lombar colada no encosto; não trave os joelhos no topo.'),
  ('afundo_bulgaro',         'Afundo búlgaro',                 'quadríceps',       false, 'Pé de trás no banco; desça vertical, joelho da frente alinhado ao pé.'),
  ('cadeira_extensora',      'Cadeira extensora',              'quadríceps',       false, 'Segure 1 s em cima; desça controlado.'),
  ('mesa_flexora',           'Mesa flexora',                   'posterior de coxa',false, 'Quadril colado no banco; suba sem tirar o quadril.'),
  ('panturrilha_em_pe',      'Panturrilha em pé',              'panturrilha',      false, 'Amplitude total; pausa 1 s embaixo (alongado).'),
  ('terra_romeno',           'Terra romeno',                   'posterior de coxa',true,  'Quadril vai para trás, barra rente às pernas, coluna neutra. Pare ao sentir o posterior alongar.'),
  ('hip_thrust',             'Hip thrust',                     'glúteos',          true,  'Queixo recolhido, costelas para baixo; pausa 1 s no topo apertando o glúteo.'),
  ('flexora',                'Flexora',                        'posterior de coxa',false, 'Movimento controlado; não deixe o quadril subir.'),
  ('goblet_ou_hack',         'Goblet ou hack',                 'quadríceps',       false, 'Tronco alto, desça entre as pernas; joelhos acompanham os pés.'),
  ('panturrilha_sentado',    'Panturrilha sentado',            'panturrilha',      false, 'Pausa embaixo, suba o máximo possível.'),
  ('farmers_walk',           'Farmer''s walk',                 'pegada',           false, 'Ombros para trás e para baixo, passos curtos e firmes.'),
  ('pescoco_anilha',         'Pescoço com anilha deitado',     'pescoço',          false, 'Carga leve, movimento lento e sem dor. Anilha protegida com toalha.')
on conflict (slug) do update set
  name = excluded.name, muscle_group = excluded.muscle_group,
  main_lift = excluded.main_lift, tips = coalesce(public.exercises.tips, excluded.tips);

-- ---------------------------------------------------------------- fichas
insert into public.workout_templates (slug, name, modality, warmup, note, est_minutes) values
  ('superior_a', 'Superior A', 'musculacao',
   '8 min: bike/corda, rotação de ombro com elástico, séries de aproximação.', null, 60),
  ('superior_b', 'Superior B', 'musculacao',
   '8 min: remo, pendurar 2×20 s, pull-apart.', null, 60),
  ('inferiores_a', 'Inferiores A', 'musculacao',
   '8 min: bike, mobilidade de quadril/tornozelo, 10 agachamentos livres, aproximação.',
   null, 60),
  ('inferiores_b', 'Inferiores B', 'musculacao',
   '8 min: bike, ponte de glúteo 2×12, good morning sem peso, aproximação.', null, 60)
on conflict (slug) do update set
  name = excluded.name, warmup = excluded.warmup, note = excluded.note, est_minutes = excluded.est_minutes;

with rows (tpl, pos, ex, sets, rmin, rmax, unit, per_side, rir, rest_min, rest_max, note) as (values
  -- Superior A
  ('superior_a', 1, 'supino_reto',              4, 6,  8,  'reps', false, '2',               120, 150, null),
  ('superior_a', 2, 'puxada_frontal',           3, 8,  10, 'reps', false, '2',               120, 120, null),
  ('superior_a', 3, 'desenvolvimento_halteres', 3, 8,  10, 'reps', false, '2',               120, 120, null),
  ('superior_a', 4, 'remada_curvada',           3, 8,  10, 'reps', false, '2',               120, 120, null),
  ('superior_a', 5, 'elevacao_lateral',         3, 12, 15, 'reps', false, '0–1 na última',   60,  60,  null),
  ('superior_a', 6, 'triceps_corda',            2, 10, 12, 'reps', false, '0–1 na última',   60,  60,  null),
  -- Superior B
  ('superior_b', 1, 'barra_fixa',               4, 6,  10, 'reps', false, '2',               120, 150, 'Elástico se < 6 reps.'),
  ('superior_b', 2, 'supino_inclinado_halteres',3, 8,  12, 'reps', false, '1–2',             90,  90,  null),
  ('superior_b', 3, 'remada_unilateral',        3, 10, 12, 'reps', false, '1–2',             90,  90,  null),
  ('superior_b', 4, 'elevacao_lateral',         3, 12, 15, 'reps', false, '0–1',             60,  60,  null),
  ('superior_b', 5, 'face_pull',                2, 12, 15, 'reps', false, null,              60,  60,  null),
  ('superior_b', 6, 'rosca_direta',             3, 8,  12, 'reps', false, '0–1',             60,  60,  null),
  ('superior_b', 7, 'pendurar_barra',           2, null, null, 'max', false, null,           null, null, 'Máximo de tempo.'),
  -- Inferiores A
  ('inferiores_a', 1, 'agachamento_livre',      4, 6,  8,  'reps', false, '2–3',             150, 180, null),
  ('inferiores_a', 2, 'leg_press_45',           3, 10, 12, 'reps', false, '2',               120, 120, null),
  ('inferiores_a', 3, 'afundo_bulgaro',         2, 8,  10, 'reps', true,  '2',               90,  90,  null),
  ('inferiores_a', 4, 'cadeira_extensora',      3, 12, 15, 'reps', false, '1',               60,  60,  'Segurar 1 s.'),
  ('inferiores_a', 5, 'mesa_flexora',           2, 10, 12, 'reps', false, '2',               60,  60,  null),
  ('inferiores_a', 6, 'panturrilha_em_pe',      3, 10, 15, 'reps', false, null,              60,  60,  'Pausa 1 s.'),
  -- Inferiores B
  ('inferiores_b', 1, 'terra_romeno',           4, 6,  8,  'reps', false, '2',               150, 150, null),
  ('inferiores_b', 2, 'hip_thrust',             3, 8,  10, 'reps', false, '1–2',             120, 120, 'Pausa 1 s.'),
  ('inferiores_b', 3, 'flexora',                3, 10, 12, 'reps', false, '1',               60,  90,  null),
  ('inferiores_b', 4, 'goblet_ou_hack',         2, 10, 12, 'reps', false, '2',               90,  90,  null),
  ('inferiores_b', 5, 'panturrilha_sentado',    3, 12, 15, 'reps', false, '1',               60,  60,  null),
  ('inferiores_b', 6, 'farmers_walk',           3, 30, 40, 'm',    false, null,              90,  90,  null),
  ('inferiores_b', 7, 'pescoco_anilha',         2, 15, 15, 'reps', false, null,              45,  45,  'Carga leve.')
)
insert into public.template_exercises (template_id, exercise_id, position, sets, reps_min, reps_max,
                                       reps_unit, per_side, rir, rest_s_min, rest_s_max, note)
select t.id, e.id, r.pos, r.sets, r.rmin, r.rmax, r.unit, r.per_side, r.rir, r.rest_min, r.rest_max, r.note
from rows r
join public.workout_templates t on t.slug = r.tpl
join public.exercises e on e.slug = r.ex
on conflict (template_id, position) do update set
  exercise_id = excluded.exercise_id, sets = excluded.sets,
  reps_min = excluded.reps_min, reps_max = excluded.reps_max, reps_unit = excluded.reps_unit,
  per_side = excluded.per_side, rir = excluded.rir,
  rest_s_min = excluded.rest_s_min, rest_s_max = excluded.rest_s_max, note = excluded.note;
  -- carga_alvo não é sobrescrita: é o bot que ajusta.

-- ---------------------------------------------------------------- grade base (ISO: 1 = seg)
with rows (wd, st, dur, m, tpl, title, note) as (values
  (1, '06:00'::time, 60, 'musculacao'::public.modality, 'superior_a',   'Superior A', null),
  (1, '19:00'::time, 60, 'muay_thai'::public.modality,  null,           'Muay thai',  null),
  (2, '06:00'::time, 60, 'musculacao'::public.modality, 'inferiores_a', 'Inferiores A', null),
  (3, '20:00'::time, 60, 'cross'::public.modality,      null,           'Cross training', null),
  (4, '06:00'::time, 60, 'musculacao'::public.modality, 'superior_b',   'Superior B', null),
  (4, '20:00'::time, 60, 'muay_thai'::public.modality,  null,           'Muay thai',  'Técnico se estiver cansado.'),
  (5, '06:00'::time, 60, 'musculacao'::public.modality, 'inferiores_b', 'Inferiores B', null),
  (6, '09:00'::time, 60, 'funcional'::public.modality,  null,           'Funcional',  'Sem pliometria pesada para as pernas.')
)
insert into public.schedule_slots (weekday, start_time, duration_min, modality, template_id, title, note)
select r.wd, r.st, r.dur, r.m, t.id, r.title, r.note
from rows r left join public.workout_templates t on t.slug = r.tpl
on conflict (weekday, start_time) do update set
  duration_min = excluded.duration_min, modality = excluded.modality,
  template_id = excluded.template_id, title = excluded.title, note = excluded.note;
-- Domingo: folga (sem slots).
-- Jiu-jitsu (ter 19:00) saiu da grade em 27/10/2026: desativa o slot se existir.
update public.schedule_slots set active = false
where weekday = 2 and start_time = '19:00' and modality = 'jiu_jitsu' and active;

-- ---------------------------------------------------------------- exceções desta semana
-- Ter 27/10 06:00: Inferiores A substituído por Crossfit (feito de manhã).
insert into public.schedule_overrides (date, action, slot_id, modality, title, motivo, source)
select '2026-10-27', 'replace', s.id, 'cross', 'Crossfit',
       'Fez Crossfit de manhã no lugar de Inferiores A (remarcado para qua 28/10 às 6h).', 'bot'
from public.schedule_slots s
where s.weekday = 2 and s.start_time = '06:00'
  and not exists (select 1 from public.schedule_overrides o where o.date = '2026-10-27' and o.slot_id = s.id);

-- Qua 28/10 06:00: Inferiores A remarcado.
insert into public.schedule_overrides (date, action, start_time, duration_min, modality, template_id, title, motivo, source)
select '2026-10-28', 'add', '06:00', 60, 'musculacao', t.id, 'Inferiores A',
       'Remarcado de ter 27/10 (Crossfit no lugar).', 'bot'
from public.workout_templates t
where t.slug = 'inferiores_a'
  and not exists (select 1 from public.schedule_overrides o
                  where o.date = '2026-10-28' and o.action = 'add' and o.template_id = t.id);

-- Qui 29/10 20:00: muay pulado (compromisso pessoal).
insert into public.schedule_overrides (date, action, slot_id, motivo, source)
select '2026-10-29', 'skip', s.id,
       'Compromisso pessoal na quinta à noite (ausência planejada).', 'bot'
from public.schedule_slots s
where s.weekday = 4 and s.start_time = '20:00'
  and not exists (select 1 from public.schedule_overrides o where o.date = '2026-10-29' and o.slot_id = s.id);

commit;
