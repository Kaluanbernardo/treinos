import { useState } from 'react'
import { ArrowLeft, Ban, CalendarClock, Check, ChevronLeft, ChevronRight, Clock, MessageCircle, Moon, X } from 'lucide-react'
import { usePlan, useTemplates } from '../lib/api'
import type { PlanItem } from '../lib/types'
import { addDays, capitalize, dm, hhmm, todaySP, wdShort, weekStart } from '../lib/format'
import { Badge, Button, Card, ErrorState, IconButton, Sheet, Skeleton } from '../components/ui'
import { Big, DateTile, WeekStrip } from '../components/viz'
import { markOf, weekDays } from '../lib/week'
import { MODALITY, ModalityDot } from '../components/modality'
import { go } from '../lib/router'
import { FichaDetail } from '../components/Ficha'

export function Agenda() {
  const today = todaySP()
  const [ws, setWs] = useState(weekStart(today))
  const plan = usePlan(ws, addDays(ws, 6))
  const templates = useTemplates()
  const [open, setOpen] = useState<PlanItem | null>(null)
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const items = plan.data ?? []
  const active = items.filter((i) => i.active)
  const done = active.filter((i) => i.session_status === 'feito' || i.session_status === 'parcial').length
  const exceptions = items.filter((i) => i.plan_kind !== 'base').length
  const isCurrent = ws === weekStart(today)
  const tpl = open?.template_id ? templates.data?.find((t) => t.id === open.template_id) : undefined

  const marks = active.map((i) => markOf(i))
  const days7 = weekDays(ws, items, today)
  const pick = (d: string) => document.getElementById(`dia-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-1 pt-1">
        <IconButton label="Voltar" onClick={() => (history.length > 1 ? history.back() : go('hoje'))}><ArrowLeft size={24} /></IconButton>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Agenda</h1>
      </header>

      <div className="flex items-center justify-between rounded-2xl bg-card p-1" role="group" aria-label="Semana">
        <IconButton label="Semana anterior" onClick={() => setWs(addDays(ws, -7))}><ChevronLeft size={24} /></IconButton>
        <div className="text-center">
          <p className="font-semibold">{isCurrent ? 'Esta semana' : ws === addDays(weekStart(today), 7) ? 'Próxima semana' : ws === addDays(weekStart(today), -7) ? 'Semana passada' : `Semana de ${dm(ws)}`}</p>
          <p className="text-sm tabular-nums text-muted">{dm(ws)} a {dm(addDays(ws, 6))}</p>
        </div>
        <IconButton label="Próxima semana" onClick={() => setWs(addDays(ws, 7))}><ChevronRight size={24} /></IconButton>
      </div>

      {plan.isError ? <ErrorState what="a agenda" onRetry={() => plan.refetch()} /> : plan.isPending ? <Skeleton className="h-[60vh]" /> : (
        <>
          <Card aria-label="Resumo da semana">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted">{ws <= today ? 'Feitas' : 'Planejadas'}</p>
                <Big size="lg" value={ws <= today ? done : active.length} unit={ws <= today ? `/${active.length}` : 'atividades'} />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {exceptions > 0 && <Badge tone="warn"><CalendarClock size={13} aria-hidden="true" /> {exceptions} {exceptions === 1 ? 'exceção' : 'exceções'}</Badge>}
                {!isCurrent && <button type="button" className="h-10 px-1 text-[15px] font-semibold text-lime" onClick={() => setWs(weekStart(today))}>voltar para hoje</button>}
              </div>
            </div>
            {marks.length > 0 && (
              <div className="mt-3 flex h-2 gap-1" aria-hidden="true">
                {marks.map((m, k) => <span key={k} className={`flex-1 rounded-full ${m === 'done' ? 'bg-ok' : m === 'missed' ? 'bg-muted/40' : 'bg-line'}`} />)}
              </div>
            )}
            <div className="-mx-2 mt-3"><WeekStrip days={days7} onPick={pick} /></div>
          </Card>

          <ol className="flex flex-col gap-2">
            {days.map((d) => {
              const list = items.filter((i) => i.date === d)
              const isToday = d === today
              if (list.length === 0) {
                return (
                  <li key={d} id={`dia-${d}`} className="flex scroll-mt-4 items-center gap-3 px-4 py-2 text-muted">
                    <span className="w-14 text-center text-sm font-medium tabular-nums">{capitalize(wdShort(d))} {Number(d.slice(8))}</span>
                    <Moon size={16} aria-hidden="true" /> <span className="text-[15px]">Folga</span>
                  </li>
                )
              }
              return (
                <li key={d} id={`dia-${d}`} className="scroll-mt-4">
                  <Card className={`flex gap-3 px-4 py-3 ${isToday ? 'ring-1 ring-lime/40' : ''}`} as="div">
                    <div className="pt-1"><DateTile iso={d} active={isToday} /></div>
                    <ul className="min-w-0 flex-1">
                      {list.map((i) => (
                        <li key={`${i.start_time}-${i.title}-${i.plan_kind}`}>
                          <button type="button" data-plan onClick={() => setOpen(i)}
                            className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-card-2">
                            <span className="min-w-0 flex-1">
                              <span className={`flex items-center gap-2 font-semibold ${i.active ? '' : 'text-muted line-through'}`}>
                                <ModalityDot modality={i.modality} /><span className="truncate">{i.title}</span>
                              </span>
                              <span className="mt-0.5 block text-sm tabular-nums text-muted">
                                {hhmm(i.start_time)} · {i.template_id ? `${i.exercise_count} ex · ` : ''}{i.duration_min} min
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1"><Status i={i} today={today} /></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              )
            })}
          </ol>
          <p className="flex items-center gap-2 px-1 text-sm text-muted">
            <MessageCircle size={16} className="shrink-0" aria-hidden="true" /> Remarcar ou pular: pelo chat. Não quebra a sequência.
          </p>
        </>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && (
          <>
            <p className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
              <span className="inline-flex items-center gap-1.5"><Clock size={16} aria-hidden="true" /> {capitalize(wdShort(open.date))} {dm(open.date)} · {hhmm(open.start_time)} · {open.duration_min} min</span>
              <span className={`inline-flex items-center gap-1.5 ${MODALITY[open.modality].text}`}><ModalityDot modality={open.modality} /> {open.modality_label}</span>
            </p>
            {open.plan_kind !== 'base' && (
              <div className="mt-3 flex gap-2 rounded-2xl bg-warn/10 p-4 text-[15px]">
                <CalendarClock size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                <span><b className="text-warn">{open.plan_kind === 'pulado' ? 'Pulado' : open.plan_kind === 'adicionado' ? 'Remarcado / extra' : 'Exceção'}</b>{open.motivo ? `: ${open.motivo}` : ''}</span>
              </div>
            )}
            <div className="mt-3">
              {tpl ? <FichaDetail template={tpl} /> : open.template_id ? <Skeleton className="h-40" /> : (
                <p className="text-[15px] text-muted">Aula na Pugna. Registre com Feito/Faltei no Hoje ou pelo chat.</p>
              )}
            </div>
            <Button className="mt-4 w-full" size="lg" onClick={() => setOpen(null)}>Fechar</Button>
          </>
        )}
      </Sheet>
    </div>
  )
}

function Status({ i, today }: { i: PlanItem; today: string }) {
  if (!i.active) return <Badge tone="warn"><Ban size={13} aria-hidden="true" /> pulado</Badge>
  const kind = i.plan_kind === 'substituido' ? <Badge tone="warn">exceção</Badge> : i.plan_kind === 'adicionado' ? <Badge tone="lime">remarcado</Badge> : null
  const st = i.session_status === 'feito' ? <Badge tone="ok"><Check size={13} aria-hidden="true" /> feito</Badge>
    : i.session_status === 'parcial' ? <Badge tone="ok">parcial</Badge>
      : i.session_status === 'faltou' ? <Badge tone="muted"><X size={13} aria-hidden="true" /> faltou</Badge>
        : i.session_status === 'em_andamento' ? <Badge tone="lime">agora</Badge>
          : i.date < today ? <Badge tone="muted">sem registro</Badge> : null
  return <>{st}{kind}</>
}
