import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Info, Minus, PencilLine, PlayCircle, Plus, SkipForward, Timer, Trophy, Undo2,
} from 'lucide-react'
import {
  useDeleteSession, useDeleteSet, useFinishSession, useLogSet, usePrevBests, usePrevSets, useSession,
  useSessionExercises, useSessionPrs, useSessionSets, useTemplates,
} from '../lib/api'
import { go } from '../lib/router'
import type { PrevBest, PrevSet, SetLog, TemplateExercise } from '../lib/types'
import { dm, epley, intFmt, kgFmt, mmss, num, capitalize, wdShort } from '../lib/format'
import { Badge, Button, Card, ErrorState, IconButton, Sheet, Skeleton, haptic, toast } from '../components/ui'
import { targetLine } from '../components/Ficha'

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
  const logSet = useLogSet(id)
  const delSet = useDeleteSet(id)
  const finish = useFinishSession()
  const discard = useDeleteSession()

  const logged = useMemo(() => (sets.data ?? []).filter((s) => !s.warmup), [sets.data])
  const [idx, setIdx] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [extra, setExtra] = useState<Record<string, number>>({})
  const [focusSet, setFocusSet] = useState<Record<string, number>>({})
  const [rest, setRest] = useRest(id)
  const [finishing, setFinishing] = useState(false)
  const [tips, setTips] = useState(false)

  // abre no primeiro exercício com séries pendentes
  useEffect(() => {
    if (idx != null || !sets.data) return
    const first = exercises.findIndex((te) => logged.filter((s) => s.exercise_id === te.exercises.id).length < te.sets)
    setIdx(first === -1 ? exercises.length - 1 : first)
  }, [sets.data, idx, exercises, logged])

  const planned = exercises.reduce((n, te) => n + te.sets, 0)
  const doneCount = logged.length

  if (sets.isPending || prev.isPending || bests.isPending || idx == null) return <div className="pt-6"><Skeleton className="h-[70vh]" /></div>
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

  const keyOf = (n: number) => `${ex.id}:${n}`
  const defaultFor = (n: number): Draft => {
    const lastConf = exSets[exSets.length - 1]
    const p = exPrev.find((x) => x.set_number === n) ?? exPrev[exPrev.length - 1]
    const base = lastConf ?? p
    return {
      kg: base?.kg ?? te.carga_alvo ?? null,
      reps: base?.reps ?? te.reps_min ?? te.reps_max ?? null,
    }
  }
  const draftFor = (n: number) => drafts[keyOf(n)] ?? defaultFor(n)
  const setDraft = (n: number, d: Draft) => setDrafts((all) => ({ ...all, [keyOf(n)]: d }))

  function confirm(n: number) {
    const d = draftFor(n)
    if (d.reps == null || d.reps <= 0) { toast('Defina as repetições antes de confirmar.', { tone: 'err' }); return }
    const row: SetLog = {
      id: crypto.randomUUID(), session_id: id, exercise_id: ex.id, set_number: n,
      kg: d.kg ?? 0, reps: d.reps, warmup: false, logged_at: new Date().toISOString(),
    }
    const isPr = prFlagsFor([...exSets, row], exBest).get(row.id)
    haptic(isPr ? [30, 60, 30] : 15)
    logSet.mutate(row, {
      onError: () => toast('Sem conexão: a série não foi salva. Toque em ✓ de novo.', { tone: 'err', ms: 6000 }),
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

  const nextEx = exercises[idx + 1]
  const exDone = exSets.length >= te.sets

  return (
    <div className="flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)+132px)]">
      {/* barra superior */}
      <header className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg/95 px-2 pt-[max(env(safe-area-inset-top),8px)] pb-2 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <IconButton label="Voltar ao Hoje (o treino continua salvo)" onClick={() => go('hoje')}><ArrowLeft size={24} /></IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold leading-tight">{title}</p>
            <p className="text-sm tabular-nums text-muted"><Elapsed since={startedAt} /> · {doneCount}/{planned} séries</p>
          </div>
          <Button variant="secondary" className="mr-1 h-11 px-4" onClick={() => setFinishing(true)}>Finalizar</Button>
        </div>
        <nav aria-label="Exercícios" className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto px-2">
          {exercises.map((t, i) => {
            const n = logged.filter((s) => s.exercise_id === t.exercises.id).length
            const complete = n >= t.sets
            const on = i === idx
            return (
              <button
                key={t.id} type="button" onClick={() => { setIdx(i); setTips(false); window.scrollTo({ top: 0 }) }}
                aria-current={on ? 'step' : undefined}
                aria-label={`${t.exercises.name}: ${n} de ${t.sets} séries`}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold tabular-nums transition-colors duration-150 ${
                  on ? 'bg-fg text-bg' : complete ? 'bg-lime/15 text-lime' : 'bg-card text-muted'}`}
              >
                {complete ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <span>{i + 1}</span>}
                <span className="max-w-[9ch] truncate font-medium">{t.exercises.name.split(' ')[0]}</span>
              </button>
            )
          })}
        </nav>
      </header>

      {/* exercício atual */}
      <section aria-labelledby="ex-title">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="ex-title" className="text-[28px] font-bold leading-tight tracking-[-0.02em] [text-wrap:balance]">{ex.name}</h1>
            <p className="mt-1 text-[17px] text-muted">{targetLine(te)}</p>
          </div>
          <span className="mt-1 shrink-0 text-sm tabular-nums text-muted">{idx + 1}/{exercises.length}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ex.video_url ? (
            <a href={ex.video_url} target="_blank" rel="noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-card-2 px-4 font-medium hover:border-muted/60">
              <PlayCircle size={20} className="text-err" aria-hidden="true" /> Ver no YouTube
            </a>
          ) : null}
          {(ex.tips || te.warmup || te.note) && (
            <Button onClick={() => setTips((v) => !v)} aria-expanded={tips}><Info size={20} aria-hidden="true" /> Dicas</Button>
          )}
        </div>
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
                  <span className="check-pop flex h-9 w-9 items-center justify-center rounded-full bg-lime text-bg" aria-hidden="true"><Check size={20} strokeWidth={3} /></span>
                  <span className="text-muted">Série {n}</span>
                  <span className="text-lg font-semibold tabular-nums">{done.kg ? `${kgFmt(done.kg)} kg` : 'corpo'} × {done.reps}{unitSuffix(te)}</span>
                  {pr && <span className="pr-seal ml-1 rounded-md bg-lime px-1.5 py-0.5 text-xs font-black tracking-wide text-bg">PR</span>}
                  <Undo2 size={18} className="ml-auto text-muted" aria-hidden="true" />
                </button>
              </li>
            )
          }
          const d = draftFor(n)
          if (n !== current) {
            return (
              <li key={n}>
                <button
                  type="button" onClick={() => setFocusSet((f) => ({ ...f, [ex.id]: n }))}
                  className="flex h-14 w-full items-center gap-3 rounded-2xl border border-line px-4 text-left text-muted"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-line font-semibold tabular-nums" aria-hidden="true">{n}</span>
                  <span>Série {n}</span>
                  <span className="ml-auto tabular-nums">{d.kg ? `${kgFmt(d.kg)} kg × ` : ''}{d.reps != null ? `${d.reps}${unitSuffix(te) || ' reps'}` : ''}</span>
                </button>
              </li>
            )
          }
          return (
            <li key={n} className="rounded-[var(--radius-card)] bg-card-2 p-4 ring-1 ring-lime/30">
              <p className="text-[15px] font-medium text-muted">Série {n} de {rowCount}</p>
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

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => setExtra((e) => ({ ...e, [ex.id]: (e[ex.id] ?? 0) + 1 }))}>
          <Plus size={18} aria-hidden="true" /> Série extra
        </Button>
        {(extra[ex.id] ?? 0) > 0 && rowCount > Math.max(te.sets, maxLogged) && (
          <Button variant="ghost" onClick={() => setExtra((e) => ({ ...e, [ex.id]: Math.max(0, (e[ex.id] ?? 0) - 1) }))}>
            <Minus size={18} aria-hidden="true" /> Remover extra
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button size="lg" onClick={() => { setIdx(Math.max(0, idx - 1)); setTips(false); window.scrollTo({ top: 0 }) }} disabled={idx === 0} aria-label="Exercício anterior">
          <ChevronLeft size={22} aria-hidden="true" />
        </Button>
        {nextEx ? (
          <Button variant={exDone ? 'primary' : 'secondary'} size="lg" className="min-w-0" onClick={() => { setIdx(idx + 1); setTips(false); window.scrollTo({ top: 0 }) }}>
            <span className="truncate">Próximo: {nextEx.exercises.name}</span> <ChevronRight size={22} className="shrink-0" aria-hidden="true" />
          </Button>
        ) : (
          <Button variant={exDone ? 'primary' : 'secondary'} size="lg" onClick={() => setFinishing(true)}>Finalizar treino</Button>
        )}
      </div>

      <RestBar rest={rest} onChange={setRest} />

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Finalizar treino?">
        <p className="text-lg"><span className="font-semibold">{doneCount}</span> de {planned} séries planejadas.</p>
        <p className="mt-1 text-[15px] text-muted">
          {doneCount === 0 ? 'Nenhuma série registrada: dá para descartar este treino.'
            : doneCount / planned >= 0.8 ? 'Fica registrado como feito.' : 'Fica registrado como parcial. Correções finas vão pelo chat.'}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Button
            variant="primary" size="xl" disabled={doneCount === 0 || finish.isPending}
            onClick={() => finish.mutate({ id, status: doneCount / planned >= 0.8 ? 'feito' : 'parcial' }, {
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

/** PR = supera o melhor anterior (sessões anteriores + séries anteriores desta), mesma regra de v_prs. */
function prFlagsFor(exSets: SetLog[], best: PrevBest | undefined) {
  const flags = new Map<string, boolean>()
  let bestKg = best?.best_kg ?? null
  let bestE = best?.best_e1rm ?? null
  for (const s of [...exSets].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
    const kg = s.kg ?? 0
    const reps = s.reps ?? 0
    if (kg <= 0 || reps < 1) continue
    const e = epley(kg, reps)
    const pr = (bestKg != null && kg > bestKg) || (bestE != null && e != null && e > bestE)
    flags.set(s.id, pr)
    bestKg = Math.max(bestKg ?? 0, kg)
    if (e != null) bestE = Math.max(bestE ?? 0, e)
  }
  return flags
}

function PrevLine({ prev, best }: { prev: PrevSet[]; best?: PrevBest }) {
  if (!prev.length && !best) {
    return <p className="mt-3 text-[15px] text-muted">Primeira vez com este exercício: a carga de hoje vira a referência.</p>
  }
  return (
    <div className="mt-3 rounded-2xl bg-card px-4 py-3 text-[15px]">
      {prev.length > 0 && (
        <p className="text-muted">
          Última vez ({dm(prev[0].date)}):{' '}
          <span className="text-fg tabular-nums">{prev.map((p) => `${p.kg ? kgFmt(p.kg) : 'corpo'}×${p.reps}`).join(' · ')}</span>
        </p>
      )}
      {best && (best.best_kg || best.best_e1rm) && (
        <p className="mt-0.5 flex items-center gap-1.5 text-muted">
          <Trophy size={15} className="text-lime" aria-hidden="true" />
          Recorde: <span className="text-fg tabular-nums">{kgFmt(best.best_kg)} kg</span>
          {best.best_e1rm != null && <> · 1RM est. <span className="text-fg tabular-nums">{kgFmt(Math.round(best.best_e1rm * 10) / 10)} kg</span></>}
        </p>
      )}
    </div>
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-md" role="timer" aria-live="off">
      <div className="h-1 bg-line" aria-hidden="true"><div className="h-1 bg-lime transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} /></div>
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <Timer size={22} className="shrink-0 text-lime" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[34px] font-bold leading-none tabular-nums">{mmss(left)}</p>
          <p className="mt-1 truncate text-sm text-muted">Descanso · depois: {rest.label}</p>
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
  const templates = useTemplates()
  const s = session.data!
  const order = templates.data?.find((t) => t.id === s.template_id)?.template_exercises.map((t) => t.exercises.id) ?? []
  const rows = [...(ex.data ?? [])].sort((a, b) => order.indexOf(a.exercise_id) - order.indexOf(b.exercise_id))
  const prByEx = new Map<string, { kg: number; reps: number }>()
  for (const p of prs.data ?? []) {
    const cur = prByEx.get(p.exercise_id)
    if (!cur || p.kg > cur.kg) prByEx.set(p.exercise_id, { kg: p.kg, reps: p.reps })
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <header className="flex items-center gap-1 pt-[max(env(safe-area-inset-top),8px)]">
        <IconButton label="Voltar" onClick={() => (history.length > 1 ? history.back() : go('hoje'))}><ArrowLeft size={24} /></IconButton>
        <p className="text-muted">{capitalize(wdShort(s.date))}, {dm(s.date)}</p>
      </header>
      <div>
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em]">{s.title}</h1>
        <p className="mt-1 flex items-center gap-2 text-lg text-muted">
          <Badge tone={s.status === 'feito' ? 'ok' : 'warn'}><Check size={13} aria-hidden="true" /> {s.status === 'parcial' ? 'parcial' : 'concluído'}</Badge>
          {s.source === 'bot' && <span className="text-sm">registrado pelo chat</span>}
        </p>
      </div>

      <Card tone="raised">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
          <div className="col-span-2"><Stat label="Volume total" value={intFmt(s.volume_kg)} unit="kg" hero /></div>
          <Stat label="Séries" value={String(s.n_sets)} />
          <Stat label="Duração" value={s.duration_min != null ? String(s.duration_min) : '—'} unit={s.duration_min != null ? 'min' : undefined} />
        </dl>
      </Card>

      {(prs.data?.length ?? 0) > 0 && (
        <Card className="ring-1 ring-lime/40">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-lime"><Trophy size={20} aria-hidden="true" /> {prByEx.size === 1 ? 'Novo recorde' : `${prByEx.size} recordes`}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {[...prByEx.entries()].map(([exId, p]) => (
              <li key={exId} className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{rows.find((r) => r.exercise_id === exId)?.exercise_name ?? prs.data!.find((x) => x.exercise_id === exId)?.exercise_name}</span>
                <span className="text-lg font-bold tabular-nums text-lime">{kgFmt(p.kg)} kg × {p.reps}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold">Melhor série de cada exercício</h2>
        {ex.isPending ? <Skeleton className="mt-3 h-40" /> : rows.length === 0 ? (
          <p className="mt-2 text-muted">Nenhuma série com carga registrada.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.exercise_id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.exercise_name}</span>
                  <span className="block text-sm text-muted">{r.n_sets} séries · {intFmt(r.volume_kg)} kg{r.top_e1rm ? ` · 1RM est. ${kgFmt(Math.round(r.top_e1rm))} kg` : ''}</span>
                </span>
                {r.top_kg ? <span className="shrink-0 text-lg font-semibold tabular-nums">{kgFmt(r.top_kg)} × {r.top_reps}</span>
                  : <span className="shrink-0 text-right text-[13px] leading-snug text-muted">acima de 12 reps<br />(fora do 1RM)</span>}
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

function Stat({ label, value, unit, hero }: { label: string; value: string; unit?: string; hero?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span className={`${hero ? 'text-[44px] text-lime' : 'text-[28px]'} font-bold leading-none tracking-[-0.02em] tabular-nums`}>{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </dd>
    </div>
  )
}
