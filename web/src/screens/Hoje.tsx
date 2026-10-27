import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Arrow, PlanItem, Recomposition } from '../lib/types'
import { hhmm, num, signed, todayLabel, weekdayShort } from '../lib/format'

const NAME = 'Kaluan'
const DONE = new Set(['feito', 'parcial', 'faltou'])

async function fetchView<T>(view: string, order?: [string, string?]): Promise<T[]> {
  if (!supabase) return []
  let q = supabase.from(view).select('*')
  if (order) for (const col of order) if (col) q = q.order(col)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as T[]
}

export function Hoje() {
  const today = useQuery({ queryKey: ['v_today'], queryFn: () => fetchView<PlanItem>('v_today', ['start_time']) })
  const week = useQuery({ queryKey: ['v_week'], queryFn: () => fetchView<PlanItem>('v_week', ['date', 'start_time']) })
  const recomp = useQuery({
    queryKey: ['v_recomposition'],
    queryFn: async () => (await fetchView<Recomposition>('v_recomposition'))[0] ?? null,
  })

  const now = Date.now()
  const items = today.data ?? []
  const pending = items.filter((i) => i.active && !DONE.has(i.session_status ?? '') && Date.parse(i.ends_at) > now)
  const hero = pending[0]
  const todayDate = items[0]?.date
  const next =
    pending[1] ??
    (week.data ?? []).find((i) => i.active && !i.session_status && (!todayDate || i.date > todayDate) && Date.parse(i.starts_at) > now)
  const skipped = items.filter((i) => !i.active)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between pt-2">
        <div>
          <p className="text-sm text-muted">{capitalize(todayLabel())}</p>
          <h1 className="text-2xl font-semibold">Olá, {NAME}</h1>
        </div>
        <button
          type="button" onClick={() => supabase?.auth.signOut()}
          className="h-12 rounded-xl px-3 text-sm text-muted hover:text-fg" aria-label="Sair"
        >
          Sair
        </button>
      </header>

      {today.isError ? (
        <ErrorCard message={(today.error as Error).message} onRetry={() => today.refetch()} />
      ) : today.isPending ? (
        <Card className="h-56 animate-pulse" />
      ) : (
        <AgoraCard item={hero} isNow={!!hero && Date.parse(hero.starts_at) <= now} />
      )}

      <EvolucaoCard data={recomp.data} loading={recomp.isPending} />

      {skipped.map((s) => (
        <Card key={`${s.start_time}-${s.title}`} className="flex items-start gap-3 py-4">
          <span aria-hidden="true" className="text-warn">⤼</span>
          <div>
            <p><span className="line-through text-muted">{hhmm(s.start_time)} · {s.title}</span> <Badge tone="warn">pulado</Badge></p>
            {s.motivo && <p className="text-sm text-muted">{s.motivo}</p>}
          </div>
        </Card>
      ))}

      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Próxima atividade</p>
          {next ? (
            <p className="mt-1 text-lg font-medium">
              {next.date !== todayDate && <span className="capitalize">{weekdayShort(next.date)} · </span>}
              {hhmm(next.start_time)} · {next.title}
            </p>
          ) : (
            <p className="mt-1 text-lg text-muted">Nada planejado</p>
          )}
        </div>
        {next && next.plan_kind !== 'base' && <Badge tone="lime">{kindLabel(next.plan_kind)}</Badge>}
      </Card>
    </div>
  )
}

function AgoraCard({ item, isNow }: { item?: PlanItem; isNow: boolean }) {
  if (!item) {
    return (
      <Card className="bg-card-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Agora</p>
        <p className="mt-2 text-3xl font-bold">Descanso</p>
        <p className="mt-1 text-muted">Nada mais planejado para hoje. Recupere bem.</p>
      </Card>
    )
  }
  const strength = item.modality === 'musculacao' && !!item.template_id
  const meta = [
    `${hhmm(item.start_time)}`,
    strength ? `${item.exercise_count} exercícios` : item.modality_label !== item.title ? item.modality_label : null,
    `~${item.est_minutes ?? item.duration_min} min`,
  ].filter(Boolean)

  return (
    <Card className="bg-card-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">{isNow ? 'Agora' : 'A seguir'}</p>
        {item.plan_kind !== 'base' && <Badge tone="lime">{kindLabel(item.plan_kind)}</Badge>}
      </div>
      <p className="mt-2 text-4xl font-bold leading-tight">{item.title}</p>
      <p className="mt-1 text-lg text-muted">{meta.join(' · ')}</p>
      {item.motivo && <p className="mt-2 text-sm text-muted">{item.motivo}</p>}

      {strength ? (
        <button
          type="button"
          onClick={() => navigator.vibrate?.(15)}
          className="mt-5 h-16 w-full rounded-2xl bg-lime text-xl font-semibold text-bg transition-transform duration-150 active:scale-[0.98]"
        >
          Iniciar treino
        </button>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" className="h-16 rounded-2xl bg-lime text-lg font-semibold text-bg">✓ Feito</button>
          <button type="button" className="h-16 rounded-2xl border border-line text-lg text-fg">✕ Faltei</button>
        </div>
      )}
      <p className="mt-2 text-center text-xs text-muted">Registro de treino chega na F1.</p>
    </Card>
  )
}

function EvolucaoCard({ data, loading }: { data?: Recomposition | null; loading: boolean }) {
  if (loading) return <Card className="h-40 animate-pulse" />
  if (!data) return null
  return (
    <Card>
      <p className="text-sm font-medium uppercase tracking-wide text-muted">Evolução · ~4 semanas</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-5xl font-bold">{num(data.weight_now_kg)}</span>
        <span className="text-muted">kg · média 7d</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <ArrowStat label="Peso" arrow={data.weight_arrow} value={`${signed(data.weight_delta_kg)} kg`} goodWhenDown />
        <ArrowStat label="Cintura" arrow={data.waist_arrow} value={`${signed(data.waist_delta_cm)} cm`} goodWhenDown />
        <ArrowStat label="Força" arrow={data.strength_arrow} value={`${signed(data.strength_delta_pct)}%`} />
      </div>
      <p className="mt-4 text-fg">{data.reading_text}</p>
    </Card>
  )
}

function ArrowStat({ label, arrow, value, goodWhenDown }: { label: string; arrow: Arrow; value: string; goodWhenDown?: boolean }) {
  const icon = arrow === 'down' ? '↓' : arrow === 'up' ? '↑' : arrow === 'flat' ? '→' : '·'
  const text = arrow === 'down' ? 'caindo' : arrow === 'up' ? 'subindo' : arrow === 'flat' ? 'estável' : 'coletando'
  const good = arrow === 'flat' ? null : goodWhenDown ? arrow === 'down' : arrow === 'up'
  const tone = arrow == null || good == null ? 'text-muted' : good ? 'text-ok' : 'text-warn'
  return (
    <div className="rounded-2xl bg-card-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 flex items-center gap-1.5 font-semibold ${tone}`}>
        <span aria-hidden="true" className="text-2xl leading-none">{icon}</span>
        <span className="text-sm">{text}</span>
      </p>
      <p className="text-sm text-muted">{arrow ? value : '–'}</p>
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <p className="text-err">⚠ Não consegui carregar o dia.</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 h-12 rounded-xl border border-line px-4">Tentar de novo</button>
    </Card>
  )
}

function Card({ className = '', children }: { className?: string; children?: ReactNode }) {
  return <section className={`rounded-[var(--radius-card)] bg-card p-5 ${className}`}>{children}</section>
}

function Badge({ tone, children }: { tone: 'lime' | 'warn'; children: ReactNode }) {
  const cls = tone === 'lime' ? 'bg-lime/15 text-lime' : 'bg-warn/15 text-warn'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{children}</span>
}

function kindLabel(kind: PlanItem['plan_kind']) {
  return kind === 'substituido' ? 'exceção' : kind === 'adicionado' ? 'remarcado' : kind === 'pulado' ? 'pulado' : ''
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
