import { ArrowDownRight, ArrowUpRight, Camera, ChevronLeft, ChevronRight, MessageCircle, UserRound } from 'lucide-react'
import { useEnergyRange } from '../lib/api'
import { type BalanceKind, type BalanceSummary, HIGH_DEFICIT_KCAL, KCAL_PER_KG_FAT, type PeriodRange, periodRange, signedInt, summarizeBalance } from '../lib/balance'
import { capitalize, dm, intFmt, monthLabel, num, plural, todaySP, wdShort } from '../lib/format'
import { go } from '../lib/router'
import { Badge, Button, Card, CardHead, Collecting, ErrorState, IconButton, Skeleton } from '../components/ui'
import { Big } from '../components/viz'
import { BalanceBars, type BalancePoint } from '../components/charts'

/** Saldo da semana e do mês em Nutrição. Mesma view da aba Calorias; regra em docs/calorias.md. */

/** Abaixo disto o gráfico vira "coletando dados" (mesmo corte da aba Calorias). */
const CHART_MIN_DAYS = 3
/** Em mês cheio de dias vazios, a lista de datas vira só a contagem. */
const MAX_DATES_LISTED = 6

const wdDm = (iso: string) => `${wdShort(iso).slice(0, 3)} ${dm(iso)}`

function periodTitle({ kind, from }: PeriodRange, offset: number) {
  if (kind === 'mes') return offset === 0 ? 'Este mês' : offset === -1 ? 'Mês passado' : capitalize(monthLabel(from))
  return offset === 0 ? 'Esta semana' : offset === -1 ? 'Semana passada' : `Há ${-offset} semanas`
}

function periodDates({ kind, from, to }: PeriodRange, offset: number) {
  if (kind === 'semana') return `${wdDm(from)} a ${wdDm(to)}`
  const span = `${dm(from)} a ${dm(to)}`
  return offset >= -1 ? `${capitalize(monthLabel(from))} · ${span}` : span
}

/** Setas para trocar de semana/mês; nunca passa do período atual. */
export function PeriodStepper({ kind, offset, onOffset }: { kind: BalanceKind; offset: number; onOffset: (o: number) => void }) {
  const range = periodRange(kind, todaySP(), offset)
  const unit = kind === 'semana' ? 'semana' : 'mês'
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-1" role="group" aria-label={kind === 'semana' ? 'Semana' : 'Mês'}>
      <IconButton label={`${capitalize(unit)} anterior`} onClick={() => onOffset(offset - 1)}><ChevronLeft size={24} /></IconButton>
      <p className="text-center" aria-live="polite">
        <span className="block font-semibold">{periodTitle(range, offset)}</span>
        <span className="block text-sm tabular-nums text-muted">{periodDates(range, offset)}</span>
      </p>
      <IconButton label={kind === 'semana' ? 'Próxima semana' : 'Próximo mês'} onClick={() => onOffset(offset + 1)} disabled={offset >= 0} className="disabled:opacity-30">
        <ChevronRight size={24} />
      </IconButton>
    </div>
  )
}

/** Cards do período: saldo à esquerda e gráfico à direita no desktop; um embaixo do outro no celular. */
export function SaldoPeriodo({ kind, offset }: { kind: BalanceKind; offset: number }) {
  const today = todaySP()
  const range = periodRange(kind, today, offset)
  const energy = useEnergyRange(range.from, range.to)

  if (energy.isError) {
    return <div className="lg:col-start-1"><ErrorState what="o saldo" message={energy.error?.message} onRetry={() => energy.refetch()} /></div>
  }
  if (energy.isPending) {
    return (
      <>
        <Skeleton className="h-96 lg:col-start-1" />
        <Skeleton className="h-72 lg:col-start-2 lg:row-start-2" />
      </>
    )
  }
  const s = summarizeBalance(energy.data, range, today)
  const noun = kind === 'semana' ? 'semana' : 'mês'
  return (
    <>
      <div className="flex flex-col gap-3 lg:col-start-1">
        {s.counted > 0 ? <BalanceHero s={s} kind={kind} /> : <NoBalance s={s} noun={noun} />}
      </div>
      {s.counted > 0 && (
        <div className="lg:col-start-2 lg:row-span-4 lg:row-start-2">
          <DailyBars s={s} kind={kind} target={energy.data.at(-1)?.target_balance_kcal || null} />
        </div>
      )}
    </>
  )
}

function BalanceHero({ s, kind }: { s: BalanceSummary; kind: BalanceKind }) {
  const bal = Math.round(s.balance!)
  const avg = Math.round(s.avg!)
  const high = avg < HIGH_DEFICIT_KCAL
  const tone = bal > 0 || high ? 'warn' : 'ok'
  const word = bal > 0 ? 'superávit' : high ? 'déficit alto' : bal < 0 ? 'déficit' : 'empate'
  const label = kind === 'semana' ? 'Saldo da semana' : 'Saldo do mês'
  return (
    <Card tone="raised" aria-label={label}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{label}</p>
          <Big size="lg" className="mt-1" value={signedInt(bal)} unit="kcal" />
        </div>
        <Badge tone={tone} className="mt-1">
          {bal > 0 ? <ArrowUpRight size={14} strokeWidth={2.5} aria-hidden="true" /> : <ArrowDownRight size={14} strokeWidth={2.5} aria-hidden="true" />}
          {word}
        </Badge>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] tabular-nums text-muted">
        <span><b className="font-semibold text-fg">{s.counted} de {s.days.length} dias</b> na conta</span>
        {s.estimated && <Badge tone="warn"><Camera size={13} aria-hidden="true" /> com estimativa</Badge>}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
        <Fact label="Comida" value={<span className="text-kcal">{intFmt(s.food)}</span>} sub="kcal nos dias na conta" />
        <Fact label="Gasto" value={intFmt(s.out)} sub="basal + rotina + exercício" />
        <Fact label="Média por dia" value={signedInt(avg)} sub="kcal" />
        <Fact label="Equivale a" value={`≈ ${num(Math.abs(s.balance!) / KCAL_PER_KG_FAT, 2)} kg`} sub={bal > 0 ? 'de gordura a mais' : 'de gordura a menos'} />
      </dl>
      <OutOfCount s={s} />
    </Card>
  )
}

function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd>
        <span className="text-[22px] font-bold leading-tight tabular-nums">{value}</span>
        <span className="block text-[13px] text-muted">{sub}</span>
      </dd>
    </div>
  )
}

const todayText = (s: BalanceSummary) =>
  s.todayBalance != null ? `${signedInt(Math.round(s.todayBalance))} kcal até agora` : s.todayNoBmr ? 'sem basal' : 'sem refeição ainda'

const datesOrCount = (dates: string[]) =>
  dates.length <= MAX_DATES_LISTED ? dates.map(dm).join(', ') : plural(dates.length, 'dia', 'dias')

/** O que ficou fora da soma, por quê, e o saldo parcial de hoje: a conta acima fecha sem surpresa. */
function OutOfCount({ s }: { s: BalanceSummary }) {
  const rows = [
    s.hasToday && { k: 'Hoje, em andamento', v: todayText(s) },
    s.noFood.length > 0 && { k: 'Sem refeição', v: datesOrCount(s.noFood) },
    s.noBmr.length > 0 && { k: 'Sem basal', v: datesOrCount(s.noBmr) },
    s.future > 0 && { k: 'Ainda por vir', v: plural(s.future, 'dia', 'dias') },
  ].filter(Boolean) as { k: string; v: string }[]
  if (rows.length === 0) return null
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-[15px] font-semibold">Fora da conta</h3>
      <dl className="mt-1.5 flex flex-col gap-1.5 text-[15px]">
        {rows.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-muted">{r.k}</dt>
            <dd className="text-right tabular-nums">{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Nenhum dia na conta: diz o motivo em vez de mostrar um zero que parece resultado. */
function NoBalance({ s, noun }: { s: BalanceSummary; noun: string }) {
  const startedToday = s.hasToday && s.days[0].state === 'today'
  return (
    <>
      {s.noBmr.length > 0 || s.todayNoBmr ? (
        <Collecting title="Sem basal, sem saldo" icon={<UserRound size={20} />}>
          Complete altura, nascimento e sexo para calcular o gasto.
          <Button className="mt-3 w-full" onClick={() => go('config/perfil')}>Completar em Configurações</Button>
        </Collecting>
      ) : startedToday ? (
        <Collecting title="Nenhum dia fechado ainda">
          {noun === 'mês' ? 'O mês começou hoje.' : 'A semana começou hoje.'} O saldo entra na conta quando o dia fechar.
        </Collecting>
      ) : (
        <Collecting title={s.hasToday ? 'Nenhum dia fechado com refeição' : 'Sem refeições neste período'} icon={<MessageCircle size={20} />}>
          O saldo soma só os dias com refeição registrada. Mande foto ou texto no chat.
        </Collecting>
      )}
      {s.hasToday && (
        <p className="flex items-baseline justify-between gap-4 rounded-2xl bg-card px-4 py-3 text-[15px]">
          <span className="text-muted">Hoje, em andamento</span>
          <span className="text-right tabular-nums">{todayText(s)}</span>
        </p>
      )}
    </>
  )
}

const STATE_NOTE = { today: 'dia em andamento', no_food: 'sem refeição', no_bmr: 'sem basal', future: 'ainda por vir' } as const

function DailyBars({ s, kind, target }: { s: BalanceSummary; kind: BalanceKind; target: number | null }) {
  const data: BalancePoint[] = s.days.map((d) => d.state === 'counted'
    ? { date: d.date, label: chartLabel(d.date, kind), value: Number(d.row!.balance_kcal), food: Number(d.row!.food_kcal), out: Number(d.row!.out_kcal) }
    : { date: d.date, label: chartLabel(d.date, kind), value: null, note: STATE_NOTE[d.state] })
  return (
    <Card aria-labelledby="saldo-dias-title">
      <CardHead id="saldo-dias-title" title="Dia a dia" sub={`comida − gasto · abaixo de zero é déficit${target != null ? ` · tracejado = meta ${signedInt(target)}` : ''}`} />
      <div className="mt-4">
        {s.counted < CHART_MIN_DAYS ? (
          <Collecting title="Coletando dados" progress={{ have: s.counted, need: CHART_MIN_DAYS, unit: 'dias na conta' }}>
            O gráfico aparece com {CHART_MIN_DAYS} dias fechados com refeição.
          </Collecting>
        ) : (
          <BalanceBars ariaLabel={`Saldo de cada dia, ${dm(s.days[0].date)} a ${dm(s.days.at(-1)!.date)}`} color="var(--color-kcal)" target={target} data={data} height={200} />
        )}
      </div>
    </Card>
  )
}

const chartLabel = (iso: string, kind: BalanceKind) => (kind === 'semana' ? capitalize(wdShort(iso)).slice(0, 3) : dm(iso))
