import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Info, Minus, PencilLine, PlayCircle, Plus, SkipForward, Timer, Trophy, Undo2,
} from 'lucide-react'
import {
  useDeleteSession, useDeleteSet, useFinishSession, useLogSet, usePrevBests, usePrevSets, useSession,
  useSessionExercises, useSessionPrs, useSessionSets, useSkipExercise, useSkips, useTemplates,
} from '../lib/api'
import { go } from '../lib/router'
import type { PrevBest, PrevSet, SetLog, TemplateExercise } from '../lib/types'
import { suggest } from '../lib/target'
import { prFlagsFor } from '../lib/pr'
import { sessionProgress } from '../lib/session'
import { dm, intFmt, kgFmt, mmss, num, capitalize, restLabel, wdShort } from '../lib/format'
import { Badge, Button, Card, ErrorState, IconButton, Sheet, Skeleton, haptic, toast } from '../components/ui'
import { repsLabel } from '../components/Ficha'
import { Ring } from '../components/Ring'
import { Big } from '../components/viz'

export function Sessao({ id }: { id: string }) {
  const session = useSession(id)
  const templates = useTemplates()

  if (session.isError || templates.isError) {
    return <div className="pt-6"><ErrorState what="o treino" onRetry={() => { session.refetch(); templates.refetch() }} /></div>
  }
  if (session.isPending || templates.isPending) return <div className="pt-6"><Skeleton className="h-[70vh]" /></div>
  if (!session.data) {
    return (
      <div className="pt-6">
        <Card>
          <p className="font-medium">Esse treino não existe mais.</p>
          <p className="mt-1 text-muted">Pode ter sido descartado ou corrigido pelo assistente.</p>
          <Button className="mt-4" onClick={() => go('treino', { replace: true })}>Ver fichas</Button>
        </Card>
      </div>
    )
  }
  if (session.data.status !== 'em_andamento') return <Resumo id={id} />
  const template = templates.data!.find((t) => t.id === session.data!.template_id)
  if (!template) return <div className="pt-6"><ErrorState what="a ficha deste treino" /></div>
  return <Andamento id={id} title={template.name} startedAt={session.data.started_at} exercises={template.template_exercises} />
}

// ---------------------------------------------------------------- treino em andamento
interface Draft { kg: number | null; reps: number | null }
interface Rest { end: number; total: number; label: string }

function Andamento({ id, title, startedAt, exercises }: { id: string; title: string; startedAt: string | null; exercises: TemplateExercise[] }) {
  const sets = useSessionSets(id)
  const prev = usePrevSets(id)
  const bests = usePrevBests(id)
  const logSet = useLogSet()
  const delSet = useDeleteSet(id)
  const skips = useSkips(id)
  const skip = useSkipExercise()
  const finish = useFinishSession()
  const discard = useDeleteSession()

  const logged = useMemo(() => (sets.data ?? []).filter((s) => !s.warmup), [sets.data])
  const skipped = useMemo(() => skips.data ?? new Set<string>(), [skips.data])
  const [idx, setIdx] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [extra, setExtra] = useState<Record<string, number>>({})
  const [focusSet, setFocusSet] = useState<Record<string, number>>({})
  const [rest, setRest] = useRest(id)
  const [finishing, setFinishing] = useState(false)
  const [tips, setTips] = useState(false)

  const prog = sessionProgress(exercises, logged, skipped)

  // abre no primeiro exercício com séries pendentes (pulados não contam)
  useEffect(() => {
    if (idx != null || !sets.data || skips.isPending) return
    const first = exercises.findIndex((te) => !skipped.has(te.exercises.id) && logged.filter((s) => s.exercise_id === te.exercises.id).length < te.sets)
    setIdx(first === -1 ? exercises.length - 1 : first)
  }, [sets.data, skips.isPending, idx, exercises, logged, skipped])

  const planned = prog.target
  const doneCount = prog.done
  const volume = logged.reduce((v, s) => v + (s.kg ?? 0) * (s.reps ?? 0), 0)

  if (sets.isPending || prev.isPending || bests.isPending || skips.isPending || idx == null) return <div className="pt-6"><Skeleton className="h-[70vh]" /></div>
  if (sets.isError) return <div className="pt-6"><ErrorState what="as séries" onRetry={() => sets.refetch()} /></div>

  const te = exercises[idx]
  const ex = te.exercises
  const exSets = logged.filter((s) => s.exercise_id === ex.id).sort((a, b) => a.set_number - b.set_number)
  const exPrev = (prev.data ?? []).filter((p) => p.exercise_id === ex.id)
  const exBest = (bests.data ?? []).find((b) => b.exercise_id === ex.id)
  const maxLogged = exSets.reduce((m, s) => Math.max(m, s.set_number), 0)
  const rowCount = Math.max(te.sets, maxLogged) + (extra[ex.id] ?? 0)
  const firstOpen = Array.from({ length: rowCount }, (_, i) => i + 1).find((n) => !exSets.some((s) => s.set_number === n))
  const current = focusSet[ex.id] && !exSets.some((s) => s.set_number === focusSet[ex.id]) ? focusSet[ex.id] : firstOpen
  const prFlags = prFlagsFor(exSets, exBest)
  const isSkipped = skipped.has(ex.id)

  const keyOf = (n: number) => `${ex.id}:${n}`
  // dentro da sessão vale a última série confirmada; antes dela, o alvo da ficha (ou a última sessão)
  const lastConf = exSets[exSets.length - 1]
  const sugOf = (n: number) => suggest(te, exPrev.find((x) => x.set_number === n) ?? exPrev[exPrev.length - 1])
  const defaultFor = (n: number): Draft => {
    if (lastConf) return { kg: lastConf.kg, reps: lastConf.reps }
    const s = sugOf(n)
    return { kg: s.kg, reps: s.reps }
  }
  const suggestedFor = (n: number) => {
    if (lastConf || drafts[keyOf(n)]) return false
    const s = sugOf(n)
    return s.kgSuggested || s.repsSuggested
  }
  const draftFor = (n: number) => drafts[keyOf(n)] ?? defaultFor(n)
  const setDraft = (n: number, d: Draft) => setDrafts((all) => ({ ...all, [keyOf(n)]: d }))

  function confirm(n: number) {
    const d = draftFor(n)
    if (d.reps == null || d.reps <= 0) { toast('Defina as repetições antes de confirmar.', { tone: 'err' }); return }
    if (d.kg == null && te.reps_unit !== 'max') { toast('Defina a carga antes de confirmar (0 = peso do corpo).', { tone: 'err' }); return }
    const row: SetLog = {
      id: crypto.randomUUID(), session_id: id, exercise_id: ex.id, set_number: n,
      kg: d.kg, reps: d.reps, warmup: false, logged_at: new Date().toISOString(),
    }
    const isPr = prFlagsFor([...exSets, row], exBest).get(row.id)
    haptic(isPr ? [30, 60, 30] : 15)
    logSet.mutate(row, {
      onError: () => toast('Sem conexão: a série não foi salva. Confirme de novo.', { tone: 'err', ms: 6000 }),
    })
    if (isPr) toast(`PR! ${ex.name}: ${kgFmt(row.kg)} kg × ${row.reps}`, { tone: 'lime' })
    setFocusSet((f) => ({ ...f, [ex.id]: 0 }))
    const restS = te.rest_s_min ?? 90
    const isLastOfAll = doneCount + 1 >= planned && n >= rowCount
    if (!isLastOfAll) {
      const nextLabel = n < rowCount ? `${ex.name}: série ${n + 1}` : exercises[idx! + 1] ? exercises[idx! + 1].exercises.name : 'próxima série'
      setRest({ end: Date.now() + restS * 1000, total: restS, label: nextLabel })
    }
  }

  function undo(s: SetLog) {
    haptic(10)
    delSet.mutate(s.id, { onError: () => toast('Não consegui desfazer. Tente de novo.', { tone: 'err' }) })
    setDraft(s.set_number, { kg: s.kg, reps: s.reps })
    toast(`Série ${s.set_number} desfeita.`)
  }

  const prevOf = (n: number) => {
    const p = exPrev.find((x) => x.set_number === n)
    return p ? `${p.kg ? kgFmt(p.kg) : 'corpo'}×${p.reps}` : null
  }
  const nextEx = exercises[idx + 1]
  const exDone = exSets.length >= te.sets || isSkipped

  function setSkip(exId: string, name: string, next: boolean) {
    haptic(next ? [10, 40, 10] : 10)
    skip.mutate({ session_id: id, exercise_id: exId, skipped: next }, {
      onError: () => toast('Sem conexão: não salvou. Tente de novo.', { tone: 'err', ms: 6000 }),
    })
    if (!next) return
    toast(`${name}: pulado.`, { action: { label: 'Desfazer', run: () => setSkip(exId, name, false) } })
    // segue para o próximo exercício ainda aberto (depois deste; senão, o primeiro que sobrou)
    const open = (i: number) => i !== idx && !prog.settled(exercises[i])
    const after = exercises.findIndex((_, i) => i > idx! && open(i))
    const any = after === -1 ? exercises.findIndex((_, i) => open(i)) : after
    if (any !== -1) pick(any)
  }

  function pick(i: number) { setIdx(i); setTips(false); window.scrollTo({ top: 0 }) }

  return (
    <div className="flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)+132px)] lg:pb-8">
      {/* barra superior: progresso das séries em anel + duração + volume */}
      <header className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg/95 px-2 pt-[max(env(safe-area-inset-top),8px)] pb-2 backdrop-blur-md lg:-mx-8 lg:px-6 lg:py-3">
        <div className="flex items-center gap-2">
          <IconButton label="Voltar ao Hoje (o treino continua salvo)" onClick={() => go('hoje')}><ArrowLeft size={24} /></IconButton>
          <Ring value={doneCount} target={planned} color="var(--color-lime)" size={44} stroke={5} label={`${doneCount} de ${planned} séries`}>
            <span className="text-[13px] font-bold tabular-nums">{doneCount}</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold leading-tight">{title}</p>
            <p className="text-sm tabular-nums text-muted"><Elapsed since={startedAt} /> · {doneCount}/{planned} · {intFmt(volume)} kg</p>
          </div>
          {doneCount === 0 && (
            <button
              type="button"
              className="h-11 shrink-0 px-2 text-sm font-medium text-err disabled:opacity-50"
              disabled={discard.isPending}
              onClick={() => discard.mutate(id, { onSuccess: () => { setRest(null); go('hoje', { replace: true }) } })}
            >Descartar</button>
          )}
          <Button variant="secondary" className="mr-1 h-11 px-4" onClick={() => setFinishing(true)}>Finalizar</Button>
        </div>
        <nav aria-label="Exercícios" className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto px-2 lg:hidden">
          {exercises.map((t, i) => {
            const n = prog.count(t.exercises.id)
            const off = skipped.has(t.exercises.id)
            const complete = !off && n >= t.sets
            const on = i === idx
            return (
              <button
                key={t.id} type="button" onClick={() => pick(i)}
                aria-current={on ? 'step' : undefined}
                aria-label={`${t.exercises.name}: ${off ? 'pulado' : `${n} de ${t.sets} séries`}`}
                className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold tabular-nums transition-colors duration-150 ${
                  on ? 'bg-fg text-bg' : complete ? 'bg-lime/15 text-lime' : off ? 'border border-dashed border-line text-muted' : 'bg-card text-muted'}`}
              >
                {complete ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : off ? <SkipForward size={15} aria-hidden="true" /> : <span>{i + 1}</span>}
                <span className={`max-w-[9ch] truncate font-medium ${off ? 'line-through decoration-1' : ''}`}>{t.exercises.name.split(' ')[0]}</span>
                {!complete && !off && n > 0 && <span className={`text-xs ${on ? 'text-bg/60' : 'text-muted'}`}>{n}/{t.sets}</span>}
              </button>
            )
          })}
        </nav>
      </header>

      {/* desktop: lista de exercícios à esquerda, exercício atual à direita */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Exercícios" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <ol className="flex flex-col gap-1.5">
          {exercises.map((t, i) => {
            const n = prog.count(t.exercises.id)
            const off = skipped.has(t.exercises.id)
            const complete = !off && n >= t.sets
            const on = i === idx
            return (
              <li key={t.id}>
                <button
                  type="button" onClick={() => pick(i)} aria-current={on ? 'step' : undefined}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors duration-150 ${
                    on ? 'bg-card-2 ring-1 ring-lime/30' : 'hover:bg-card'}`}
                >
                  <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                    complete ? 'action-fill' : off ? 'border border-dashed border-line text-muted' : on ? 'bg-fg text-bg' : 'border-2 border-line text-muted'}`}>
                    {complete ? <Check size={18} strokeWidth={3} /> : off ? <SkipForward size={16} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${on ? 'text-fg' : off ? 'text-muted line-through decoration-1' : 'text-fg/90'}`}>{t.exercises.name}</span>
                    <span className="block text-sm tabular-nums text-muted">{off ? 'pulado' : `${n} de ${t.sets} séries`}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
      {/* exercício atual */}
      <section aria-labelledby="ex-title">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm tabular-nums text-muted">Exercício {idx + 1} de {exercises.length}</p>
            <h1 id="ex-title" className="text-[30px] font-bold leading-tight tracking-[-0.02em] [text-wrap:balance]">{ex.name}</h1>
          </div>
          <div className="-mr-2 flex shrink-0">
            {ex.video_url && (
              <a href={ex.video_url} target="_blank" rel="noreferrer" aria-label={`Ver execução no YouTube: ${ex.name}`}
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-muted hover:bg-card hover:text-fg">
                <PlayCircle size={26} aria-hidden="true" />
              </a>
            )}
            {(ex.tips || te.warmup || te.note) && (
              <IconButton label="Dicas" aria-expanded={tips} onClick={() => setTips((v) => !v)} className={tips ? 'bg-card text-fg' : ''}><Info size={24} /></IconButton>
            )}
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-[15px]" aria-label="Meta">
          <li className="rounded-full bg-card px-3 py-1.5 font-bold tabular-nums">{te.sets} × {repsLabel(te)}</li>
          {te.rir && <li className="rounded-full bg-card px-3 py-1.5 text-muted">RIR <b className="font-semibold text-fg">{te.rir}</b></li>}
          {restLabel(te.rest_s_min, te.rest_s_max) && (
            <li className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-muted"><Timer size={15} aria-hidden="true" /><b className="font-semibold tabular-nums text-fg">{restLabel(te.rest_s_min, te.rest_s_max)}</b></li>
          )}
        </ul>
        {tips && (
          <div className="mt-3 rounded-2xl bg-card p-4 text-[15px] leading-relaxed text-muted">
            {ex.tips && <p>{ex.tips}</p>}
            {te.warmup && <p className="mt-2"><span className="text-fg">Aproximação:</span> {te.warmup}</p>}
            {te.note && <p className="mt-2 text-warn">{te.note}</p>}
          </div>
        )}
        <PrevLine prev={exPrev} best={exBest} />
      </section>

      <ol className="flex flex-col gap-2" aria-label="Séries">
        {Array.from({ length: rowCount }, (_, i) => i + 1).map((n) => {
          const done = exSets.find((s) => s.set_number === n)
          if (done) {
            const pr = prFlags.get(done.id)
            return (
              <li key={n}>
                <button
                  type="button" onClick={() => undo(done)}
                  className="flex h-16 w-full items-center gap-3 rounded-2xl bg-card px-4 text-left"
                  aria-label={`Série ${n} feita: ${kgFmt(done.kg)} kg × ${done.reps}. Tocar para desfazer.`}
                >
                  <span className="check-pop flex h-9 w-9 items-center justify-center rounded-full action-fill" aria-hidden="true"><Check size={20} strokeWidth={3} /></span>
                  <span className="w-6 text-center font-semibold tabular-nums text-muted">{n}</span>
                  <span className="text-xl font-bold tabular-nums">{done.kg ? `${kgFmt(done.kg)} kg` : 'corpo'} × {done.reps}{unitSuffix(te)}</span>
                  {pr && <span className="pr-seal ml-1 rounded-md action-fill px-1.5 py-0.5 text-xs font-black tracking-wide">PR</span>}
                  <Undo2 size={18} className="ml-auto text-muted" aria-hidden="true" />
                </button>
              </li>
            )
          }
          if (isSkipped) return null
          const d = draftFor(n)
          if (n !== current) {
            return (
              <li key={n}>
                <button
                  type="button" onClick={() => setFocusSet((f) => ({ ...f, [ex.id]: n }))}
                  className="flex h-14 w-full items-center gap-3 rounded-2xl border border-line px-4 text-left text-muted"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-line font-semibold tabular-nums" aria-hidden="true">{n}</span>
                  <span className="tabular-nums text-fg">{d.kg ? `${kgFmt(d.kg)} kg × ` : ''}{d.reps != null ? `${d.reps}${unitSuffix(te) || ' reps'}` : ''}</span>
                  <span className="ml-auto text-sm tabular-nums">{prevOf(n) ? `anterior ${prevOf(n)}` : ''}</span>
                </button>
              </li>
            )
          }
          return (
            <li key={n} className="rounded-[var(--radius-card)] bg-card-2 p-4 ring-1 ring-lime/30">
              <div className="flex items-baseline justify-between gap-2">
                <p className="flex items-center gap-2 text-lg font-semibold">
                  Série {n} <span className="font-normal text-muted">de {rowCount}</span>
                  {suggestedFor(n) && <Badge>sugerido</Badge>}
                </p>
                <p className="text-sm tabular-nums text-muted">{prevOf(n) ? <>anterior <b className="font-semibold text-fg">{prevOf(n)}</b></> : 'sem anterior'}</p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Stepper
                  label="Carga" unit="kg" value={d.kg} step={2.5} min={0} format={(v) => (v ? kgFmt(v) : 'corpo')}
                  onChange={(kg) => setDraft(n, { ...d, kg })}
                />
                <Stepper
                  label={te.reps_unit === 'max' || te.reps_unit === 's' ? 'Tempo' : te.reps_unit === 'm' ? 'Distância' : 'Reps'}
                  unit={te.reps_unit === 'max' || te.reps_unit === 's' ? 's' : te.reps_unit === 'm' ? 'm' : 'reps'}
                  value={d.reps} step={te.reps_unit === 'reps' ? 1 : 5} min={0} format={(v) => String(v)}
                  onChange={(reps) => setDraft(n, { ...d, reps })}
                />
              </div>
              <Button variant="primary" size="xl" className="mt-4 w-full" onClick={() => confirm(n)}>
                <Check size={26} strokeWidth={3} aria-hidden="true" /> Confirmar série {n}
              </Button>
            </li>
          )
        })}
      </ol>

      {isSkipped ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
          <SkipForward size={22} className="shrink-0 text-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Exercício pulado</p>
            <p className="text-sm tabular-nums text-muted">{exSets.length ? `${exSets.length} de ${te.sets} séries feitas` : 'Fora do treino de hoje'}</p>
          </div>
          <Button onClick={() => setSkip(ex.id, ex.name, false)}><Undo2 size={18} aria-hidden="true" /> Desfazer</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" className="-ml-2" onClick={() => setExtra((e) => ({ ...e, [ex.id]: (e[ex.id] ?? 0) + 1 }))}>
            <Plus size={18} aria-hidden="true" /> Série extra
          </Button>
          {(extra[ex.id] ?? 0) > 0 && rowCount > Math.max(te.sets, maxLogged) && (
            <Button variant="ghost" onClick={() => setExtra((e) => ({ ...e, [ex.id]: Math.max(0, (e[ex.id] ?? 0) - 1) }))}>
              <Minus size={18} aria-hidden="true" /> Remover
            </Button>
          )}
          {exSets.length < te.sets && (
            <Button className="ml-auto" onClick={() => setSkip(ex.id, ex.name, true)}>
              <SkipForward size={18} aria-hidden="true" /> Pular exercício
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button size="lg" onClick={() => pick(Math.max(0, idx - 1))} disabled={idx === 0} aria-label="Exercício anterior">
          <ChevronLeft size={22} aria-hidden="true" />
        </Button>
        {nextEx ? (
          <Button variant={exDone ? 'primary' : 'secondary'} size="lg" className="min-w-0" onClick={() => pick(idx + 1)}>
            <span className="truncate">Próximo: {nextEx.exercises.name}</span> <ChevronRight size={22} className="shrink-0" aria-hidden="true" />
          </Button>
        ) : (
          <Button variant={exDone ? 'primary' : 'secondary'} size="lg" onClick={() => setFinishing(true)}>Finalizar treino</Button>
        )}
      </div>

      <RestBar rest={rest} onChange={setRest} />
      </div>
      </div>

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Finalizar treino?">
        <div className="flex items-center gap-4">
          <Ring value={doneCount} target={planned} color="var(--color-lime)" size={96} stroke={10} label={`${doneCount} de ${planned} séries`}>
            <span className="text-2xl font-bold tabular-nums">{Math.round((doneCount / Math.max(1, planned)) * 100)}%</span>
          </Ring>
          <div>
            <Big size="md" value={doneCount} unit={`/${planned} séries`} />
            <p className="mt-1 text-[15px] tabular-nums text-muted">{intFmt(volume)} kg de volume</p>
            {prog.nSkipped > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-[15px] tabular-nums text-muted">
                <SkipForward size={16} aria-hidden="true" /> {prog.nSkipped} {prog.nSkipped === 1 ? 'exercício pulado' : 'exercícios pulados'}
              </p>
            )}
          </div>
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {doneCount === 0 ? 'Nenhuma série registrada: dá para descartar.'
            : prog.status === 'feito' ? 'Fica registrado como feito.'
              : prog.nSkipped > 0 ? 'Com exercício pulado, fica como parcial.' : 'Fica como parcial. Correções vão pelo chat.'}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Button
            variant="primary" size="xl" disabled={doneCount === 0 || finish.isPending}
            onClick={() => finish.mutate({ id, status: prog.status }, {
              onSuccess: () => { haptic([20, 40, 20]); setRest(null); setFinishing(false) },
              onError: (e) => toast(`Não salvou: ${e.message}`, { tone: 'err' }),
            })}
          >
            <Check size={24} aria-hidden="true" /> Finalizar e ver resumo
          </Button>
          {doneCount === 0 ? (
            <Button variant="danger" size="lg" onClick={() => discard.mutate(id, { onSuccess: () => { setRest(null); go('hoje', { replace: true }) } })}>
              Descartar treino
            </Button>
          ) : (
            <Button size="lg" onClick={() => setFinishing(false)}>Continuar treinando</Button>
          )}
        </div>
      </Sheet>
    </div>
  )
}

const unitSuffix = (te: TemplateExercise) => (te.reps_unit === 'max' || te.reps_unit === 's' ? ' s' : te.reps_unit === 'm' ? ' m' : '')

function PrevLine({ prev, best }: { prev: PrevSet[]; best?: PrevBest }) {
  if (!prev.length && !best) {
    return <p className="mt-3 text-[15px] text-muted">Primeira vez: hoje vira a referência.</p>
  }
  const top = prev.reduce<PrevSet | null>((m, p) => ((p.kg ?? 0) * 100 + (p.reps ?? 0) > ((m?.kg ?? 0) * 100 + (m?.reps ?? 0)) ? p : m), null)
  return (
    <dl className="mt-3 grid grid-cols-2 divide-x divide-line rounded-2xl bg-card py-3">
      <div className="px-4">
        <dt className="text-[13px] text-muted">Última vez{prev[0] ? ` · ${dm(prev[0].date)}` : ''}</dt>
        <dd className="mt-0.5 text-xl font-bold tabular-nums">{top ? `${top.kg ? kgFmt(top.kg) : 'corpo'}×${top.reps}` : '—'}</dd>
      </div>
      <div className="px-4">
        <dt className="flex items-center gap-1 text-[13px] text-muted"><Trophy size={13} className="text-lime" aria-hidden="true" /> Recorde</dt>
        <dd className="mt-0.5 text-xl font-bold tabular-nums">{best?.best_kg ? `${kgFmt(best.best_kg)} kg` : '—'}</dd>
        {best?.best_e1rm != null && <dd className="text-[13px] tabular-nums text-muted">1RM est. {kgFmt(Math.round(best.best_e1rm * 10) / 10)} kg</dd>}
      </div>
    </dl>
  )
}

function Stepper({ label, unit, value, step, min, format, onChange }: {
  label: string; unit: string; value: number | null; step: number; min: number; format: (v: number) => string; onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const v = value ?? 0
  const bump = (d: number) => { haptic(8); onChange(Math.max(min, Math.round((v + d) * 100) / 100)) }
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-bg/70 p-2 ring-1 ring-line">
      <p className="w-16 shrink-0 pl-2 text-sm font-medium text-muted">{label}{unit !== 'reps' && <span className="block text-xs text-muted/80">{unit}</span>}</p>
      <div className="flex flex-1 items-center justify-between gap-1">
        <button type="button" onClick={() => bump(-step)} aria-label={`Diminuir ${label.toLowerCase()} em ${num(step, step % 1 ? 1 : 0)}`}
          className="flex h-14 w-16 items-center justify-center rounded-xl bg-card-2 text-fg active:scale-95">
          <Minus size={22} aria-hidden="true" />
        </button>
        {editing ? (
          <input
            autoFocus inputMode="decimal" aria-label={`${label} em ${unit}`}
            defaultValue={value == null ? '' : String(value).replace('.', ',')}
            onBlur={(e) => { const n = parseFloat(e.target.value.replace(',', '.')); if (!Number.isNaN(n)) onChange(Math.max(min, n)); setEditing(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="h-14 w-full min-w-0 rounded-xl bg-card text-center text-2xl font-bold tabular-nums outline-none ring-2 ring-lime"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} aria-label={`${label}: ${value == null ? 'vazio' : format(v)} ${unit}. Tocar para digitar.`}
            className="h-14 min-w-0 flex-1 rounded-xl text-center text-[28px] font-bold tabular-nums leading-none">
            {value == null ? <PencilLine size={22} className="mx-auto text-muted" aria-hidden="true" /> : format(v)}
          </button>
        )}
        <button type="button" onClick={() => bump(step)} aria-label={`Aumentar ${label.toLowerCase()} em ${num(step, step % 1 ? 1 : 0)}`}
          className="flex h-14 w-16 items-center justify-center rounded-xl bg-card-2 text-fg active:scale-95">
          <Plus size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function Elapsed({ since }: { since: string | null }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [])
  if (!since) return <>—</>
  return <>{mmss((Date.now() - Date.parse(since)) / 1000)}</>
}

/** Timer de descanso persistido por sessão (sobrevive a recarregar a página). */
function useRest(sessionId: string): [Rest | null, (r: Rest | null) => void] {
  const k = `rest:${sessionId}`
  const [rest, setRestState] = useState<Rest | null>(() => {
    try { const r = JSON.parse(sessionStorage.getItem(k) ?? 'null') as Rest | null; return r && r.end > Date.now() ? r : null } catch { return null }
  })
  const set = (r: Rest | null) => {
    setRestState(r)
    if (r) sessionStorage.setItem(k, JSON.stringify(r)); else sessionStorage.removeItem(k)
  }
  return [rest, set]
}

function RestBar({ rest, onChange }: { rest: Rest | null; onChange: (r: Rest | null) => void }) {
  const [now, setNow] = useState(() => Date.now())
  const fired = useRef<number | null>(null)
  useEffect(() => {
    if (!rest) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [rest])
  const left = rest ? (rest.end - now) / 1000 : 0
  useEffect(() => {
    if (rest && left <= 0 && fired.current !== rest.end) {
      fired.current = rest.end
      haptic([200, 100, 200])
      toast(`Descanso encerrado. Bora: ${rest.label}.`, { tone: 'lime' })
      onChange(null)
    }
  }, [rest, left, onChange])
  if (!rest || left <= 0) return null
  const pct = Math.min(100, (1 - left / rest.total) * 100)
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:sticky lg:bottom-6 lg:rounded-2xl lg:border lg:pb-0 lg:shadow-[var(--shadow-toast)]" role="timer" aria-live="off">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 lg:max-w-none">
        <Ring value={pct} target={100} color="var(--color-lime)" size={52} stroke={5} label={`Descanso: ${Math.round(pct)}% concluído`}>
          <Timer size={20} className="text-lime" aria-hidden="true" />
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[34px] font-bold leading-none tabular-nums">{mmss(left)}</p>
          <p className="mt-1 truncate text-sm text-muted">depois: {rest.label}</p>
        </div>
        <button type="button" onClick={() => onChange({ ...rest, end: rest.end - 15_000 })} className="h-12 rounded-xl bg-card-2 px-3 font-semibold tabular-nums" aria-label="Menos 15 segundos">−15</button>
        <button type="button" onClick={() => onChange({ ...rest, end: rest.end + 15_000, total: rest.total + 15 })} className="h-12 rounded-xl bg-card-2 px-3 font-semibold tabular-nums" aria-label="Mais 15 segundos">+15</button>
        <IconButton label="Pular descanso" className="bg-card-2 text-fg" onClick={() => onChange(null)}><SkipForward size={20} /></IconButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- resumo
function Resumo({ id }: { id: string }) {
  const session = useSession(id)
  const ex = useSessionExercises(id)
  const prs = useSessionPrs(id)
  const skips = useSkips(id)
  const templates = useTemplates()
  const s = session.data!
  const tpl = templates.data?.find((t) => t.id === s.template_id)
  const order = tpl?.template_exercises.map((t) => t.exercises.id) ?? []
  const planned = tpl?.template_exercises.reduce((n, t) => n + t.sets, 0) ?? 0
  const rows = [...(ex.data ?? [])].sort((a, b) => order.indexOf(a.exercise_id) - order.indexOf(b.exercise_id))
  const maxVol = Math.max(1, ...rows.map((r) => Number(r.volume_kg)))
  const skippedEx = (tpl?.template_exercises ?? []).filter((t) => skips.data?.has(t.exercises.id) && !rows.some((r) => r.exercise_id === t.exercises.id))
  const nSkipped = skips.data?.size ?? s.n_skipped ?? 0
  const prByEx = new Map<string, { kg: number; reps: number }>()
  for (const p of prs.data ?? []) {
    const cur = prByEx.get(p.exercise_id)
    if (!cur || p.kg > cur.kg) prByEx.set(p.exercise_id, { kg: p.kg, reps: p.reps })
  }

  return (
    <div className="flex flex-col gap-4 pb-28 lg:mx-auto lg:w-full lg:max-w-2xl lg:pb-12">
      <header className="flex items-center gap-1 pt-[max(env(safe-area-inset-top),8px)]">
        <IconButton label="Voltar" onClick={() => (history.length > 1 ? history.back() : go('hoje'))}><ArrowLeft size={24} /></IconButton>
        <p className="text-muted">{capitalize(wdShort(s.date))}, {dm(s.date)}</p>
        {s.source === 'bot' && <span className="ml-auto text-sm text-muted">registrado pelo chat</span>}
      </header>
      <div>
        <Badge tone={s.status === 'feito' ? 'ok' : 'warn'}><Check size={13} aria-hidden="true" /> {s.status === 'parcial' ? 'parcial' : 'concluído'}</Badge>
        <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-[-0.02em]">{s.title}</h1>
      </div>

      <Card tone="raised" aria-label="Números do treino">
        <div className="flex items-center gap-5">
          {planned > 0 ? (
            <Ring value={s.n_sets} target={planned} color="var(--color-lime)" size={112} stroke={11} label={`${s.n_sets} de ${planned} séries`}>
              <span className="text-[28px] font-bold leading-none tabular-nums">{s.n_sets}</span>
              <span className="mt-0.5 text-xs text-muted">de {planned} séries</span>
            </Ring>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-muted">Volume</p>
            <Big size="lg" value={intFmt(s.volume_kg)} unit="kg" />
            <dl className="mt-3 flex gap-5">
              {!planned && <div><dt className="text-[13px] text-muted">Séries</dt><dd className="text-xl font-bold tabular-nums">{s.n_sets}</dd></div>}
              <div><dt className="text-[13px] text-muted">Duração</dt><dd className="text-xl font-bold tabular-nums">{s.duration_min ?? '—'}<span className="text-sm font-medium text-muted"> min</span></dd></div>
              <div><dt className="text-[13px] text-muted">Recordes</dt><dd className={`text-xl font-bold tabular-nums ${prByEx.size ? 'text-lime' : ''}`}>{prByEx.size}</dd></div>
              {nSkipped > 0 && <div><dt className="text-[13px] text-muted">Pulados</dt><dd className="text-xl font-bold tabular-nums">{nSkipped}</dd></div>}
            </dl>
          </div>
        </div>
      </Card>

      {prByEx.size > 0 && (
        <Card className="ring-1 ring-lime/40">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-lime"><Trophy size={20} aria-hidden="true" /> {prByEx.size === 1 ? 'Novo recorde' : `${prByEx.size} recordes`}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {[...prByEx.entries()].map(([exId, p]) => (
              <li key={exId} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{rows.find((r) => r.exercise_id === exId)?.exercise_name ?? prs.data!.find((x) => x.exercise_id === exId)?.exercise_name}</span>
                <span className="shrink-0 text-xl font-bold tabular-nums text-lime">{kgFmt(p.kg)} × {p.reps}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card aria-labelledby="ex-res">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="ex-res" className="text-lg font-semibold">Exercícios</h2>
          <span className="text-[13px] text-muted">barra = volume</span>
        </div>
        {ex.isPending ? <Skeleton className="mt-3 h-40" /> : rows.length === 0 && skippedEx.length === 0 ? (
          <p className="mt-2 text-muted">Nenhuma série com carga.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.exercise_id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="truncate">{r.exercise_name}</span>
                    {prByEx.has(r.exercise_id) && <span className="rounded-md action-fill px-1.5 py-0.5 text-[11px] font-black">PR</span>}
                    {skips.data?.has(r.exercise_id) && <SkipForward size={15} className="shrink-0 text-muted" aria-label="pulado no meio" />}
                  </span>
                  {r.top_kg ? <span className="shrink-0 text-lg font-bold tabular-nums">{kgFmt(r.top_kg)} × {r.top_reps}</span>
                    : <span className="shrink-0 text-sm text-muted">+12 reps (sem 1RM)</span>}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-line" aria-hidden="true">
                    <div className="meter-fill h-1.5 rounded-full bg-fg/70" style={{ width: `${(Number(r.volume_kg) / maxVol) * 100}%` }} />
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-muted">
                    {r.n_sets}× · {intFmt(r.volume_kg)} kg{r.top_e1rm ? ` · 1RM ${kgFmt(Math.round(r.top_e1rm))}` : ''}
                  </span>
                </div>
              </li>
            ))}
            {skippedEx.map((t) => (
              <li key={t.id} className="flex min-h-12 items-center justify-between gap-3 py-3 text-muted">
                <span className="truncate font-medium line-through decoration-1">{t.exercises.name}</span>
                <Badge><SkipForward size={13} aria-hidden="true" /> pulado</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => go('evolucao')}>Ver evolução</Button>
        <Button variant="primary" size="lg" onClick={() => go('hoje')}>Voltar ao Hoje</Button>
      </div>
    </div>
  )
}
