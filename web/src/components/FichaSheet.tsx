import { useRef, useState } from 'react'
import { Check, ChevronDown, Flame, Play, PlayCircle, SkipForward, Undo2 } from 'lucide-react'
import {
  useActiveSession, useDeleteSet, useExerciseSessions, useFinishSession, useLogSet, usePrevBests, useSessionSets,
  useSessions, useSkipExercise, useSkips, useStartSession, useToday,
} from '../lib/api'
import { go } from '../lib/router'
import type { ExerciseSession, PrevBest, SetLog, Template, TemplateExercise } from '../lib/types'
import { suggest } from '../lib/target'
import { kgFmt, todaySP } from '../lib/format'
import { prFlagsFor } from '../lib/pr'
import { sessionProgress } from '../lib/session'
import { Badge, Button, Sheet, Skeleton, haptic, toast } from './ui'
import { historyByExercise, repsLabel } from './Ficha'
import { Ring } from './Ring'

/**
 * Ficha com registro direto: carga × reps por série, ✓ e pular, sem abrir o modo treino.
 * O primeiro registro cria a sessão de hoje (ligada ao horário da grade, se houver); depois continua nela.
 */
export function FichaSheet({ template, onClose }: { template: Template | null; onClose: () => void }) {
  return (
    <Sheet open={!!template} onClose={onClose} title={template?.name ?? ''}>
      {template && <FichaBody key={template.id} template={template} onClose={onClose} />}
    </Sheet>
  )
}

const EMPTY = new Set<string>()

function FichaBody({ template, onClose }: { template: Template; onClose: () => void }) {
  const active = useActiveSession()
  const sessions = useSessions(40)
  const today = useToday()
  const exHist = useExerciseSessions()
  const start = useStartSession()
  const finish = useFinishSession()
  const logSet = useLogSet()
  const skip = useSkipExercise()
  const [createdId, setCreatedId] = useState<string | null>(null)
  const creating = useRef<Promise<string> | null>(null)
  const [openId, setOpenId] = useState<string | null | undefined>(undefined) // undefined = segue o primeiro em aberto
  const [confirming, setConfirming] = useState(false)

  const mine = active.data?.template_id === template.id ? active.data : null
  const other = active.data && !mine ? active.data : null
  const liveId = mine?.id ?? (other ? null : createdId)
  const doneToday = liveId ? undefined : (sessions.data ?? []).find((s) =>
    s.template_id === template.id && s.date === todaySP() && (s.status === 'feito' || s.status === 'parcial'))
  const shownId = liveId ?? doneToday?.id ?? null
  const readOnly = !!other || !!doneToday

  const sets = useSessionSets(shownId)
  const skips = useSkips(shownId)
  const bests = usePrevBests(liveId)
  const delSet = useDeleteSet(shownId ?? '')

  const exercises = template.template_exercises
  const logged = (sets.data ?? []).filter((s) => !s.warmup)
  const skipped = skips.data ?? EMPTY
  const prog = sessionProgress(exercises, logged, skipped)
  const history = historyByExercise(exHist.data)
  const autoOpen = exercises.find((te) => !prog.settled(te))?.exercises.id ?? null
  const expanded = openId === undefined ? autoOpen : openId

  if (active.isPending || sessions.isPending) return <Skeleton className="h-96" />

  function ensureSession(): Promise<string> {
    if (liveId) return Promise.resolve(liveId)
    if (!creating.current) {
      const plan = (today.data ?? []).find((i) => i.active && i.template_id === template.id && !i.session_status)
      creating.current = start.mutateAsync({ template_id: template.id, modality: template.modality, slot_id: plan?.slot_id, override_id: plan?.override_id })
        .then((id) => { setCreatedId(id); return id })
        .catch((e) => { creating.current = null; throw e })
    }
    return creating.current
  }

  async function log(te: TemplateExercise, n: number, kg: number | null, reps: number) {
    let sid: string
    try { sid = await ensureSession() } catch (e) { toast(`Não deu para começar o treino: ${(e as Error).message}`, { tone: 'err' }); return }
    const ex = te.exercises
    const exSets = logged.filter((s) => s.exercise_id === ex.id)
    const row: SetLog = { id: crypto.randomUUID(), session_id: sid, exercise_id: ex.id, set_number: n, kg, reps, warmup: false, logged_at: new Date().toISOString() }
    const best = (bests.data ?? []).find((b) => b.exercise_id === ex.id)
    const isPr = prFlagsFor([...exSets, row], best).get(row.id)
    haptic(isPr ? [30, 60, 30] : 15)
    logSet.mutate(row, { onError: () => toast('Sem conexão: a série não foi salva. Toque de novo.', { tone: 'err', ms: 6000 }) })
    if (isPr) toast(`PR! ${ex.name}: ${kgFmt(kg)} kg × ${reps}`, { tone: 'lime' })
    if (exSets.length + 1 >= te.sets) setOpenId(undefined)
    setConfirming(false)
  }

  async function setSkip(te: TemplateExercise, next: boolean) {
    let sid: string
    try { sid = await ensureSession() } catch (e) { toast(`Não salvou: ${(e as Error).message}`, { tone: 'err' }); return }
    haptic(next ? [10, 40, 10] : 10)
    skip.mutate({ session_id: sid, exercise_id: te.exercises.id, skipped: next }, {
      onError: () => toast('Sem conexão: não salvou. Tente de novo.', { tone: 'err', ms: 6000 }),
    })
    if (next) {
      setOpenId(undefined)
      toast(`${te.exercises.name}: pulado.`, { action: { label: 'Desfazer', run: () => setSkip(te, false) } })
    }
    setConfirming(false)
  }

  function undo(s: SetLog) {
    haptic(10)
    delSet.mutate(s.id, { onError: () => toast('Não consegui desfazer. Tente de novo.', { tone: 'err' }) })
  }

  function onFinish() {
    if (!liveId) return
    if (!confirming) { setConfirming(true); return }
    finish.mutate({ id: liveId, status: prog.status }, {
      onSuccess: () => { haptic([20, 40, 20]); onClose(); go(`sessao/${liveId}`) },
      onError: (e) => toast(`Não salvou: ${e.message}`, { tone: 'err' }),
    })
  }

  async function guided() {
    if (other) { onClose(); go(`sessao/${other.id}`); return }
    try { const id = await ensureSession(); onClose(); go(`sessao/${id}`) } catch (e) { toast(`Não deu para iniciar: ${(e as Error).message}`, { tone: 'err' }) }
  }

  return (
    <>
      {other ? (
        <div className="flex items-center gap-3 rounded-2xl bg-bg/60 p-3 ring-1 ring-lime/40">
          <span className="live-dot ml-1 h-2 w-2 shrink-0 rounded-full bg-lime" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[15px]"><span className="text-muted">Em andamento:</span> <b className="font-semibold">{other.title}</b></p>
          <Button size="md" onClick={guided}>Continuar</Button>
        </div>
      ) : doneToday ? (
        <div className="flex items-center gap-3 rounded-2xl bg-bg/60 p-3 ring-1 ring-line">
          <Badge tone="ok"><Check size={13} aria-hidden="true" /> {doneToday.status === 'parcial' ? 'parcial' : 'feito'} hoje</Badge>
          <span className="min-w-0 flex-1 text-[15px] tabular-nums text-muted">{doneToday.n_sets} séries</span>
          <Button size="md" onClick={() => { onClose(); go(`sessao/${doneToday.id}`) }}>Ver resumo</Button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Ring value={prog.done} target={prog.target} color="var(--color-lime)" size={56} stroke={6} label={`${prog.done} de ${prog.target} séries`} />
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight tabular-nums">{prog.done}<span className="text-base font-medium text-muted">/{prog.target} séries</span></p>
            <p className="text-sm tabular-nums text-muted">
              {liveId ? 'salvando no treino de hoje' : `${exercises.length} exercícios · ~${template.est_minutes ?? 60} min`}
              {prog.nSkipped > 0 && ` · ${prog.nSkipped} ${prog.nSkipped === 1 ? 'pulado' : 'pulados'}`}
            </p>
          </div>
        </div>
      )}

      {template.warmup && (
        <p className="mt-3 flex gap-2 rounded-2xl bg-card-2 px-4 py-3 text-[15px] text-muted">
          <Flame size={18} className="mt-0.5 shrink-0 text-kcal" aria-hidden="true" />
          <span className="line-clamp-2"><span className="font-medium text-fg">Aquecimento</span> · {template.warmup}</span>
        </p>
      )}
      {template.note && <p className="mt-3 text-[15px] text-warn">{template.note}</p>}

      <ol className="mt-2 divide-y divide-line" aria-label="Exercícios">
        {exercises.map((te) => (
          <ExerciseLog
            key={te.id} te={te} readOnly={readOnly} open={expanded === te.exercises.id}
            onToggle={() => setOpenId(expanded === te.exercises.id ? null : te.exercises.id)}
            sets={logged.filter((s) => s.exercise_id === te.exercises.id).sort((a, b) => a.set_number - b.set_number)}
            skipped={skipped.has(te.exercises.id)} last={history.get(te.exercises.id)?.filter((h) => h.session_id !== shownId).at(-1)}
            best={(bests.data ?? []).find((b) => b.exercise_id === te.exercises.id)}
            onLog={(n, kg, reps) => log(te, n, kg, reps)} onUndo={undo} onSkip={(v) => setSkip(te, v)}
          />
        ))}
      </ol>

      {!readOnly && (
        <div className="sticky -bottom-5 -mx-5 mt-2 border-t border-line bg-card px-5 pt-4 pb-5">
          {confirming && (
            <p className="mb-3 text-[15px] tabular-nums text-muted" role="status">
              {prog.done}/{prog.target} séries{prog.nSkipped > 0 && ` · ${prog.nSkipped} ${prog.nSkipped === 1 ? 'pulado' : 'pulados'}`} · fica como <b className="font-semibold text-fg">{prog.status}</b>
            </p>
          )}
          {prog.done > 0 && liveId ? (
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <Button size="xl" onClick={guided} aria-label="Abrir modo treino"><Play size={22} aria-hidden="true" /></Button>
              <Button variant="primary" size="xl" onClick={onFinish} disabled={finish.isPending}>
                <Check size={24} strokeWidth={3} aria-hidden="true" /> {confirming ? 'Confirmar' : 'Finalizar'}
              </Button>
            </div>
          ) : (
            <Button size="lg" className="w-full" onClick={guided} disabled={start.isPending}>
              <Play size={20} aria-hidden="true" /> Modo treino (série a série)
            </Button>
          )}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------- um exercício
interface Draft { kg: string; reps: string }
const toNum = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null }
const show = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

function ExerciseLog({ te, sets, skipped, last, best, open, readOnly, onToggle, onLog, onUndo, onSkip }: {
  te: TemplateExercise; sets: SetLog[]; skipped: boolean; last?: ExerciseSession; best?: PrevBest
  open: boolean; readOnly: boolean; onToggle: () => void
  onLog: (n: number, kg: number | null, reps: number) => void; onUndo: (s: SetLog) => void; onSkip: (v: boolean) => void
}) {
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const ex = te.exercises
  const unit = te.reps_unit === 'max' || te.reps_unit === 's' ? 's' : te.reps_unit === 'm' ? 'm' : 'reps'
  const rows = Math.max(te.sets, sets.reduce((m, s) => Math.max(m, s.set_number), 0))
  const done = sets.length
  const complete = !skipped && done >= te.sets
  const prFlags = prFlagsFor(sets, best)

  // dentro da sessão vale a última série confirmada; antes dela, o alvo da ficha (ou a última sessão)
  const lastSet = sets[sets.length - 1]
  const sug = suggest(te, last ? { kg: last.top_kg, reps: last.top_reps } : null)
  const base: Draft = lastSet ? { kg: show(lastSet.kg), reps: show(lastSet.reps) } : { kg: show(sug.kg), reps: show(sug.reps) }
  const showSug = !readOnly && !skipped && !lastSet && (sug.kgSuggested || sug.repsSuggested)
  const draftOf = (n: number) => drafts[n] ?? base
  const edit = (n: number, d: Partial<Draft>) => setDrafts((all) => ({ ...all, [n]: { ...draftOf(n), ...d } }))

  function confirm(n: number) {
    const d = draftOf(n)
    const reps = toNum(d.reps)
    const kg = d.kg.trim() === '' ? null : toNum(d.kg)
    if (reps == null || reps <= 0) { toast(`Série ${n}: defina ${unit === 'reps' ? 'as repetições' : 'o tempo'}.`, { tone: 'err' }); return }
    if (kg == null && te.reps_unit !== 'max') { toast(`Série ${n}: defina a carga (0 = peso do corpo).`, { tone: 'err' }); return }
    onLog(n, kg, Math.round(reps))
    setDrafts((all) => { const next = { ...all }; delete next[n]; return next })
  }

  const fmtSet = (s: SetLog) => `${s.kg ? `${kgFmt(s.kg)} kg` : 'corpo'} × ${s.reps}${unit === 'reps' ? '' : ` ${unit}`}`

  return (
    <li className="py-1">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 py-2 text-left">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
          complete ? 'check-pop action-fill' : skipped ? 'border border-dashed border-muted/60 text-muted' : 'bg-card-2 text-muted'}`} aria-hidden="true">
          {complete ? <Check size={18} strokeWidth={3} /> : skipped ? <SkipForward size={16} /> : te.position}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold leading-snug ${skipped ? 'text-muted line-through decoration-1' : ''}`}>{ex.name}</span>
          <span className="mt-0.5 block text-sm tabular-nums text-muted">
            {te.sets}×{repsLabel(te)}
            {last?.top_kg ? ` · último ${kgFmt(last.top_kg)}×${last.top_reps}` : te.carga_alvo != null ? ` · alvo ${kgFmt(te.carga_alvo)} kg` : ''}
          </span>
        </span>
        {skipped ? (
          <Badge><SkipForward size={13} aria-hidden="true" /> pulado</Badge>
        ) : (
          <span className="flex shrink-0 gap-1" role="img" aria-label={`${done} de ${te.sets} séries`}>
            {Array.from({ length: Math.max(te.sets, done) }, (_, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < done ? 'bg-lime' : 'ring-1 ring-inset ring-muted/50'}`} />
            ))}
          </span>
        )}
        <ChevronDown size={20} className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="pb-3">
          {showSug && (
            <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-muted">
              <Badge>sugerido</Badge>
              <span className="text-fg">{sug.kg != null ? `${sug.kg ? `${kgFmt(sug.kg)} kg` : 'corpo'} × ` : ''}{sug.reps ?? '–'}{unit === 'reps' ? '' : ` ${unit}`}</span>
              {last?.top_kg != null && <span>· última vez {kgFmt(last.top_kg)}×{last.top_reps}</span>}
            </p>
          )}
          <ol className="flex flex-col gap-2" aria-label={`Séries de ${ex.name}`}>
            {Array.from({ length: rows }, (_, i) => i + 1).map((n) => {
              const s = sets.find((x) => x.set_number === n)
              if (s) {
                return (
                  <li key={n} className="flex h-14 items-center gap-2 rounded-2xl bg-card-2 pl-1">
                    <span className="w-7 text-center font-semibold tabular-nums text-muted">{n}</span>
                    <span className="flex-1 text-xl font-bold tabular-nums">{fmtSet(s)}</span>
                    {prFlags.get(s.id) && <span className="pr-seal rounded-md action-fill px-1.5 py-0.5 text-xs font-black tracking-wide">PR</span>}
                    {readOnly ? (
                      <span className="flex h-14 w-14 items-center justify-center" aria-label="feita"><Check size={22} strokeWidth={3} className="text-lime" aria-hidden="true" /></span>
                    ) : (
                      <button type="button" onClick={() => onUndo(s)} aria-label={`Série ${n} feita: ${fmtSet(s)}. Desfazer.`}
                        className="check-pop flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl action-fill">
                        <Check size={24} strokeWidth={3} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                )
              }
              if (readOnly || skipped) return null
              const d = draftOf(n)
              return (
                <li key={n} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-center font-semibold tabular-nums text-muted">{n}</span>
                  <NumField label={`Série ${n}: carga`} unit="kg" value={d.kg} onChange={(kg) => edit(n, { kg })} placeholder={te.reps_unit === 'max' ? 'corpo' : '0'} />
                  <NumField label={`Série ${n}: ${unit === 'reps' ? 'repetições' : unit === 'm' ? 'distância' : 'tempo'}`} unit={unit} value={d.reps} onChange={(reps) => edit(n, { reps })} integer />
                  <button type="button" onClick={() => confirm(n)} aria-label={`Confirmar série ${n}`}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-line text-muted transition-colors duration-150 hover:border-lime hover:text-lime active:scale-95">
                    <Check size={24} strokeWidth={3} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>
          {readOnly && done === 0 && <p className="text-[15px] text-muted">{skipped ? 'Pulado.' : 'Sem séries.'}</p>}

          {!readOnly && (
            <div className="mt-2 flex items-center gap-2">
              {skipped ? (
                <Button onClick={() => onSkip(false)}><Undo2 size={18} aria-hidden="true" /> Desfazer pulo</Button>
              ) : done < te.sets ? (
                <Button onClick={() => onSkip(true)}><SkipForward size={18} aria-hidden="true" /> Pular exercício</Button>
              ) : null}
              {ex.video_url && (
                <a href={ex.video_url} target="_blank" rel="noreferrer" aria-label={`Vídeo de execução: ${ex.name}`}
                  className="ml-auto inline-flex h-12 w-12 items-center justify-center rounded-xl text-muted hover:bg-card-2 hover:text-fg">
                  <PlayCircle size={24} aria-hidden="true" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function NumField({ label, unit, value, onChange, integer, placeholder }: {
  label: string; unit: string; value: string; onChange: (v: string) => void; integer?: boolean; placeholder?: string
}) {
  return (
    <label className="flex h-14 min-w-0 flex-1 items-center gap-1 rounded-2xl bg-bg/70 px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-lime">
      <input
        inputMode={integer ? 'numeric' : 'decimal'} enterKeyHint="done" aria-label={`${label} em ${unit}`}
        value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(integer ? /[^\d]/g : /[^\d.,]/g, ''))}
        onFocus={(e) => e.target.select()}
        className="w-full min-w-0 bg-transparent text-xl font-bold tabular-nums outline-none placeholder:font-medium placeholder:text-muted/70"
      />
      <span className="shrink-0 text-sm text-muted" aria-hidden="true">{unit}</span>
    </label>
  )
}
