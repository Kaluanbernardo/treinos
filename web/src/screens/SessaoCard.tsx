import { Trophy, X } from 'lucide-react'
import { useSession, useSessionExercises, useSessionKcal, useSessionPrs, useSessionSets, useTemplates } from '../lib/api'
import { go } from '../lib/router'
import type { SetLog, TemplateExercise } from '../lib/types'
import { capitalize, intFmt, kgFmt, longDay } from '../lib/format'
import { Badge, Button, ErrorState, IconButton, Skeleton } from '../components/ui'
import { MetricGrid, type Metric } from '../components/Metrics'

/**
 * Resumo do treino feito para print: uma coluna, pouca informação, marca Kalufit no topo e no rodapé.
 * Os controles ficam fora do cartão para o recorte sair limpo.
 */
export function ShareSummary({ id }: { id: string }) {
  const session = useSession(id)
  const sets = useSessionSets(id)
  const ex = useSessionExercises(id)
  const prs = useSessionPrs(id)
  const kcal = useSessionKcal(id)
  const templates = useTemplates()

  if (sets.isError) return <div className="pt-6"><ErrorState what="o resumo" onRetry={() => sets.refetch()} /></div>
  if (sets.isPending || templates.isPending) return <div className="mx-auto w-full max-w-md pt-6"><Skeleton className="h-[80vh]" /></div>

  const s = session.data!
  const tpl = templates.data?.find((t) => t.id === s.template_id)
  const teOf = new Map((tpl?.template_exercises ?? []).map((t, i) => [t.exercises.id, { te: t, pos: i }]))
  const prIds = new Set((prs.data ?? []).map((p) => p.set_id))
  const nameOf = (exId: string) =>
    teOf.get(exId)?.te.exercises.name
    ?? ex.data?.find((r) => r.exercise_id === exId)?.exercise_name
    ?? prs.data?.find((r) => r.exercise_id === exId)?.exercise_name
    ?? 'Exercício'

  // exercícios na ordem da ficha; os de fora (adicionados pelo chat) depois, pela hora da 1ª série
  const byEx = new Map<string, SetLog[]>()
  for (const set of [...(sets.data ?? [])].filter((x) => !x.warmup).sort((a, b) => a.set_number - b.set_number)) {
    byEx.set(set.exercise_id, [...(byEx.get(set.exercise_id) ?? []), set])
  }
  const firstAt = (l: SetLog[]) => l.reduce((m, x) => (x.logged_at < m ? x.logged_at : m), l[0].logged_at)
  const blocks = [...byEx.entries()]
    .sort(([a, la], [b, lb]) => (teOf.get(a)?.pos ?? 999) - (teOf.get(b)?.pos ?? 999) || (firstAt(la) < firstAt(lb) ? -1 : 1))
    .map(([exId, list]) => ({ exId, name: nameOf(exId), unit: teOf.get(exId)?.te.reps_unit ?? 'reps', groups: groupSets(list, prIds) }))

  const nSets = [...byEx.values()].reduce((n, l) => n + l.length, 0)
  const prEx = [...new Set((prs.data ?? []).map((p) => p.exercise_id))]
  const stats: Metric[] = [
    { label: 'Duração', value: s.duration_min != null ? String(s.duration_min) : '—', unit: 'min' },
    { label: 'Volume', value: intFmt(s.volume_kg), unit: 'kg' },
    kcal.data != null
      ? { label: 'Relógio', value: intFmt(kcal.data), unit: 'kcal', tone: 'text-kcal' }
      : { label: 'Séries', value: String(nSets) },
  ]

  return (
    <div className="mx-auto flex w-full max-w-md flex-col pb-[calc(env(safe-area-inset-bottom)+24px)] lg:pt-6">
      <div className="flex items-center gap-2 pt-[max(env(safe-area-inset-top),8px)] lg:pt-0">
        <IconButton label="Fechar resumo" className="-ml-2" onClick={() => go(`sessao/${id}`, { replace: true })}><X size={24} /></IconButton>
        <p className="text-sm text-muted">Tire um print para compartilhar.</p>
      </div>

      <article aria-label={`Resumo do treino ${s.title}`} className="mt-2 rounded-[24px] bg-card px-6 pt-8 pb-5">
        {/* marca como cabeçalho do print: grande e centralizada */}
        <header className="flex justify-center"><Wordmark hero /></header>

        <p className="mt-8 text-center text-[15px] text-muted">{capitalize(longDay(s.date))}</p>
        <h1 className="mt-1 text-center text-[34px] font-bold leading-[1.05] tracking-[-0.02em] [text-wrap:balance]">{s.title}</h1>
        {s.status === 'parcial' && <div className="mt-3 flex justify-center"><Badge tone="warn">treino parcial</Badge></div>}

        {/* três colunas iguais; valor + unidade numa linha só e o número encolhe para caber (360 px ok) */}
        <MetricGrid items={stats} center divided className="mt-7 border-y border-line py-5" />

        {prEx.length > 0 && (
          <p className="mt-5 flex items-start gap-2 text-[15px] leading-snug">
            <Trophy size={18} className="mt-px shrink-0 text-lime" aria-hidden="true" />
            <span>
              <b className="font-semibold text-lime">{prEx.length === 1 ? 'Novo recorde' : `${prEx.length} recordes`}</b>
              <span className="text-muted">{prEx.length === 1 ? ` em ${nameOf(prEx[0])}` : ` em ${prEx.map(nameOf).join(', ')}`}</span>
            </span>
          </p>
        )}

        {blocks.length === 0 ? (
          <p className="mt-6 text-muted">Nenhuma série registrada.</p>
        ) : (
          <ol className="mt-6 flex flex-col gap-6">
            {blocks.map((b) => (
              <li key={b.exId}>
                <h2 className="text-[17px] font-semibold leading-snug">{b.name}</h2>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {b.groups.map((g, i) => (
                    <li key={i} className="flex items-baseline gap-3 text-[16px] tabular-nums">
                      <span className="w-9 shrink-0 text-muted">{g.n}×</span>
                      <span className="font-semibold">{setLabel(g, b.unit)}</span>
                      {g.pr && <span className="self-center rounded-md action-fill px-1.5 py-0.5 text-[11px] font-black tracking-wide">PR</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}

        <footer className="mt-8 flex flex-col items-center gap-2 border-t border-line pt-5">
          <Wordmark />
          <span className="text-[13px] tabular-nums text-muted">
            {blocks.length} {blocks.length === 1 ? 'exercício' : 'exercícios'} · {nSets} {nSets === 1 ? 'série' : 'séries'}
          </span>
        </footer>
      </article>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => go(`sessao/${id}`, { replace: true })}>Ver detalhes</Button>
        <Button variant="primary" size="lg" onClick={() => go('hoje')}>Voltar ao Hoje</Button>
      </div>
    </div>
  )
}

function Wordmark({ small = false, hero = false }: { small?: boolean; hero?: boolean }) {
  return (
    <span className={`font-extrabold leading-none tracking-[-0.04em] ${small ? 'text-[18px] text-muted' : hero ? 'text-[44px]' : 'text-[36px]'}`} aria-label="Kalufit">
      Kalu<span className="text-lime">fit</span>
    </span>
  )
}

interface Group { n: number; kg: number | null; reps: number | null; pr: boolean }

/** Séries seguidas com mesma carga e reps viram uma linha ("3× 80 kg × 8"). */
function groupSets(list: SetLog[], prIds: Set<string>): Group[] {
  const out: Group[] = []
  for (const x of list) {
    const last = out[out.length - 1]
    if (last && last.kg === x.kg && last.reps === x.reps) { last.n += 1; last.pr ||= prIds.has(x.id) }
    else out.push({ n: 1, kg: x.kg, reps: x.reps, pr: prIds.has(x.id) })
  }
  return out
}

/** 80 kg × 8 · corpo × 12 · 60 s · 10 kg × 60 s (tempo e distância sem carga dispensam o "corpo") */
function setLabel(g: Group, u: TemplateExercise['reps_unit']) {
  const suffix = u === 'max' || u === 's' ? ' s' : u === 'm' ? ' m' : ''
  if (suffix && !g.kg) return `${g.reps ?? '—'}${suffix}`
  return `${g.kg ? `${kgFmt(g.kg)} kg` : 'corpo'} × ${g.reps ?? '—'}${suffix}`
}
