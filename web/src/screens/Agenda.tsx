import { useState } from 'react'
import { Ban, CalendarClock, Check, ChevronLeft, ChevronRight, Clock, MessageCircle, Moon, X } from 'lucide-react'
import { usePlan, useTemplates } from '../lib/api'
import type { PlanItem } from '../lib/types'
import { addDays, capitalize, dm, hhmm, todaySP, wdShort, weekStart } from '../lib/format'
import { Badge, Button, Card, ErrorState, IconButton, ScreenHeader, Sheet, Skeleton } from '../components/ui'
import { MODALITY, ModalityDot } from '../components/modality'
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

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Agenda" sub="Grade da Pugna com as exceções da semana" />

      <div className="flex items-center justify-between rounded-2xl bg-card p-1" role="group" aria-label="Semana">
        <IconButton label="Semana anterior" onClick={() => setWs(addDays(ws, -7))}><ChevronLeft size={24} /></IconButton>
        <div className="text-center">
          <p className="font-semibold">{isCurrent ? 'Esta semana' : ws === addDays(weekStart(today), 7) ? 'Próxima semana' : ws === addDays(weekStart(today), -7) ? 'Semana passada' : `Semana de ${dm(ws)}`}</p>
          <p className="text-sm text-muted">{dm(ws)} a {dm(addDays(ws, 6))}</p>
        </div>
        <IconButton label="Próxima semana" onClick={() => setWs(addDays(ws, 7))}><ChevronRight size={24} /></IconButton>
      </div>

      {plan.isError ? <ErrorState what="a agenda" onRetry={() => plan.refetch()} /> : plan.isPending ? <Skeleton className="h-[60vh]" /> : (
        <>
          <p className="px-1 text-[15px] text-muted">
            <b className="text-fg tabular-nums">{active.length}</b> atividades
            {ws <= today && <> · <b className="text-fg tabular-nums">{done}</b> feitas</>}
            {exceptions > 0 && <> · <b className="text-warn tabular-nums">{exceptions}</b> {exceptions === 1 ? 'exceção' : 'exceções'}</>}
            {!isCurrent && <button type="button" className="ml-2 font-semibold text-lime" onClick={() => setWs(weekStart(today))}>voltar para hoje</button>}
          </p>
          <ol className="flex flex-col gap-3">
            {days.map((d) => {
              const list = items.filter((i) => i.date === d)
              const isToday = d === today
              return (
                <li key={d}>
                  <Card className={`py-4 ${isToday ? 'ring-1 ring-lime/40' : ''} ${d < today ? 'opacity-90' : ''}`}>
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-baseline gap-2">
                        <span className={`text-lg font-semibold ${isToday ? 'text-lime' : ''}`}>{capitalize(wdShort(d))}</span>
                        <span className="text-[15px] tabular-nums text-muted">{dm(d)}</span>
                      </h2>
                      {isToday && <Badge tone="lime">hoje</Badge>}
                    </div>
                    {list.length === 0 ? (
                      <p className="mt-2 flex items-center gap-2 text-[15px] text-muted"><Moon size={16} aria-hidden="true" /> Folga</p>
                    ) : (
                      <ul className="mt-2 flex flex-col">
                        {list.map((i) => (
                          <li key={`${i.start_time}-${i.title}-${i.plan_kind}`}>
                            <button type="button" data-plan onClick={() => setOpen(i)}
                              className="-mx-2 flex w-[calc(100%+16px)] items-start gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-card-2">
                              <span className={`w-12 shrink-0 pt-0.5 font-medium tabular-nums ${i.active ? 'text-fg' : 'text-muted line-through'}`}>{hhmm(i.start_time)}</span>
                              <ModalityDot modality={i.modality} className="mt-2" />
                              <span className="min-w-0 flex-1">
                                <span className={`block font-medium ${i.active ? '' : 'text-muted line-through'}`}>{i.title}</span>
                                <span className="block text-sm text-muted">
                                  {i.template_id ? `${i.exercise_count} exercícios · ` : i.modality_label !== i.title ? `${i.modality_label} · ` : ''}{i.duration_min} min
                                </span>
                                {i.motivo && i.plan_kind !== 'base' && <span className="mt-1 block text-sm leading-snug text-warn/90">{i.motivo}</span>}
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5"><Status i={i} today={today} /></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </li>
              )
            })}
          </ol>
          <p className="flex items-start gap-2 px-1 text-sm leading-relaxed text-muted">
            <MessageCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Para remarcar ou pular, é só falar no chat ("move o treino de amanhã pras 7h"). Remarcação não quebra a sequência.
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
                <p className="text-[15px] leading-relaxed text-muted">Aula na Pugna. O registro é pelo botão Feito/Faltei no Hoje ou pelo chat.</p>
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
