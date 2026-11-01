// Casa sessão solta com o item do plano (src/lib/planLink.ts).
//   npx jiti scripts/test-plan-link.ts
import { pickPlanLink } from '../src/lib/planLink'
import type { PlanItem } from '../src/lib/types'

let fail = 0
const check = (desc: string, got: string | null, want: string | null) => {
  const ok = got === want
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${desc}${ok ? '' : ` (esperado ${want}, veio ${got})`}`)
}

function item(partial: Partial<PlanItem> & Pick<PlanItem, 'modality' | 'start_time' | 'title'>): PlanItem {
  const start = partial.start_time.slice(0, 5)
  return {
    date: '2026-11-01',
    duration_min: 60,
    starts_at: `2026-11-01T${start}:00-03:00`,
    ends_at: `2026-11-01T${start}:00-03:00`,
    modality_label: partial.modality,
    plan_kind: 'adicionado',
    active: true,
    motivo: null,
    slot_id: null,
    override_id: `ov-${start}`,
    template_id: null,
    template_slug: null,
    template_name: null,
    template_warmup: null,
    template_note: null,
    est_minutes: 60,
    exercise_count: 7,
    session_id: null,
    session_status: null,
    ...partial,
    starts_at: partial.starts_at ?? `2026-11-01T${start}:00-03:00`,
  }
}

const extra = item({ modality: 'musculacao', start_time: '10:00', title: 'Extra' })
const muay = item({ modality: 'muay_thai', start_time: '19:00', title: 'Muay thai', override_id: 'ov-muay' })
const cedo = item({ modality: 'musculacao', start_time: '08:00', title: 'Superior A', template_id: 'tpl-sup-a', override_id: 'ov-08' })
const tarde = item({ modality: 'musculacao', start_time: '18:00', title: 'Extra', override_id: 'ov-18' })

check('override sem ficha + sessão de outra ficha → o único item de musculação',
  pickPlanLink([extra, muay], { modality: 'musculacao', template_id: 'tpl-inf-b', started_at: '2026-11-01T11:00:00-03:00' })?.override_id ?? null,
  'ov-10:00')

check('muay thai do mesmo dia não herda a sessão de musculação',
  pickPlanLink([extra, muay], { modality: 'musculacao', template_id: 'tpl-inf-b' })?.modality ?? null,
  'musculacao')

check('dois horários de musculação e ficha que não é de nenhum → não vincula',
  pickPlanLink([cedo, tarde], { modality: 'musculacao', template_id: 'tpl-inf-b', started_at: '2026-11-01T18:20:00-03:00' })?.title ?? null,
  null)

check('ficha única entre dois horários → esse item',
  pickPlanLink([cedo, tarde], { modality: 'musculacao', template_id: 'tpl-sup-a' })?.override_id ?? null,
  'ov-08')

check('item já ocupado por outra sessão fica de fora',
  pickPlanLink([{ ...extra, session_id: 'outra' }, muay], { id: 'esta', modality: 'musculacao', template_id: 'tpl-inf-b' })?.title ?? null,
  null)

check('item já apontando para esta sessão continua elegível',
  pickPlanLink([{ ...extra, session_id: 'esta' }], { id: 'esta', modality: 'musculacao', template_id: null })?.override_id ?? null,
  'ov-10:00')

check('item pulado não recebe vínculo',
  pickPlanLink([{ ...extra, active: false }], { modality: 'musculacao', template_id: 'tpl-inf-b' })?.title ?? null,
  null)

const dupA = item({ modality: 'musculacao', start_time: '09:00', title: 'A', template_id: 'tpl-inf-b', override_id: 'ov-09' })
const dupB = item({ modality: 'musculacao', start_time: '18:00', title: 'B', template_id: 'tpl-inf-b', override_id: 'ov-18b' })
check('duas vezes a mesma ficha → a mais perto do início da sessão',
  pickPlanLink([dupA, dupB], { modality: 'musculacao', template_id: 'tpl-inf-b', started_at: '2026-11-01T18:10:00-03:00' })?.override_id ?? null,
  'ov-18b')

console.log(fail ? `plan-link: ${fail} falhas` : 'plan-link: tudo ok')
process.exit(fail ? 1 : 0)
