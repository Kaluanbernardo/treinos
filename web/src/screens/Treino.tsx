import { useState } from 'react'
import { ChevronRight, Dumbbell, History, Play, Trophy } from 'lucide-react'
import { useActiveSession, useSessions, useStartSession, useTemplates, useToday } from '../lib/api'
import { go } from '../lib/router'
import type { SessionRow, Template } from '../lib/types'
import { capitalize, dm, intFmt, wdShort } from '../lib/format'
import { Badge, Button, Card, CardHead, ErrorState, ScreenHeader, SectionTitle, Sheet, Skeleton, haptic, toast } from '../components/ui'
import { FichaDetail } from '../components/Ficha'
import { MODALITY } from '../components/modality'

export function Treino() {
  const templates = useTemplates()
  const sessions = useSessions(40)
  const today = useToday()
  const active = useActiveSession()
  const start = useStartSession()
  const [open, setOpen] = useState<Template | null>(null)

  const lastBy = new Map<string, string>()
  for (const s of sessions.data ?? []) if (s.template_id && !lastBy.has(s.template_id) && s.status !== 'faltou') lastBy.set(s.template_id, s.date)
  const todayStrength = (today.data ?? []).find((i) => i.active && i.template_id && i.modality === 'musculacao' && !i.session_status)

  async function begin(t: Template) {
    haptic(15)
    if (active.data) { go(`sessao/${active.data.id}`); return }
    const plan = todayStrength?.template_id === t.id ? todayStrength : null
    try {
      const id = await start.mutateAsync({ template_id: t.id, modality: t.modality, slot_id: plan?.slot_id, override_id: plan?.override_id })
      go(`sessao/${id}`)
    } catch (e) {
      toast(`Não deu para iniciar: ${(e as Error).message}`, { tone: 'err' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Treino" sub="Fichas de musculação e histórico" />

      {active.data && (
        <Card tone="raised">
          <CardHead title={active.data.title} sub={`Em andamento · ${active.data.n_sets} ${active.data.n_sets === 1 ? 'série' : 'séries'}`}
            aside={<Badge tone="lime"><span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" /> agora</Badge>} />
          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => go(`sessao/${active.data!.id}`)}>
            <Dumbbell size={20} aria-hidden="true" /> Continuar treino
          </Button>
        </Card>
      )}

      {templates.isError ? (
        <ErrorState what="as fichas" onRetry={() => templates.refetch()} />
      ) : templates.isPending ? (
        <Skeleton className="h-80" />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Fichas">
          {templates.data!.map((t) => {
            const isToday = todayStrength?.template_id === t.id
            const last = lastBy.get(t.id)
            return (
              <li key={t.id}>
                <button
                  type="button" onClick={() => setOpen(t)}
                  className={`flex w-full items-center gap-4 rounded-[var(--radius-card)] p-5 text-left transition-colors duration-150 ${isToday ? 'bg-card-2 ring-1 ring-lime/40' : 'bg-card hover:bg-card-2'}`}
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${isToday ? 'bg-lime text-bg' : 'bg-card-2 text-fg'}`} aria-hidden="true">
                    {t.name.replace(/^(\w)\w+ (\w)$/, '$1$2')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-xl font-semibold">{t.name}</span>
                      {isToday && <Badge tone="lime">hoje</Badge>}
                    </span>
                    <span className="mt-0.5 block text-[15px] text-muted">
                      {t.template_exercises.length} exercícios · ~{t.est_minutes ?? 60} min
                      {last ? ` · último em ${dm(last)}` : ' · ainda não feito'}
                    </span>
                  </span>
                  <ChevronRight size={22} className="shrink-0 text-muted" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <SectionTitle aside={<History size={20} className="text-muted" aria-hidden="true" />}>Histórico</SectionTitle>
      {sessions.isError ? (
        <ErrorState what="o histórico" onRetry={() => sessions.refetch()} />
      ) : sessions.isPending ? (
        <Skeleton className="h-40" />
      ) : sessions.data!.filter((s) => s.status !== 'em_andamento').length === 0 ? (
        <Card>
          <p className="font-medium">Nenhuma sessão registrada ainda.</p>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">
            Cada treino finalizado aparece aqui com volume, séries e recordes. Aulas marcadas como feitas (ou
            registradas pelo assistente no chat) também.
          </p>
        </Card>
      ) : (
        <Card className="py-2">
          <ul className="divide-y divide-line">
            {sessions.data!.filter((s) => s.status !== 'em_andamento').map((s) => <HistoryRow key={s.id} s={s} />)}
          </ul>
        </Card>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <>
            <p className="text-[15px] text-muted">{open.template_exercises.length} exercícios · ~{open.est_minutes ?? 60} min</p>
            <div className="mt-3"><FichaDetail template={open} /></div>
            <div className="sticky -bottom-5 -mx-5 mt-2 bg-gradient-to-t from-card from-70% to-transparent px-5 pt-6 pb-5">
              <Button variant="primary" size="xl" className="w-full" onClick={() => begin(open)} disabled={start.isPending}>
                <Play size={22} fill="currentColor" aria-hidden="true" />
                {active.data ? 'Continuar treino em andamento' : `Iniciar ${open.name}`}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

function HistoryRow({ s }: { s: SessionRow }) {
  const strength = s.modality === 'musculacao' && s.n_sets > 0
  const content = (
    <>
      <span className="w-14 shrink-0">
        <span className="block text-sm text-muted">{capitalize(wdShort(s.date))}</span>
        <span className="block font-semibold tabular-nums">{dm(s.date)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${MODALITY[s.modality].bg}`} aria-hidden="true" />
          <span className="truncate font-medium">{s.title}</span>
        </span>
        <span className="mt-0.5 block text-sm text-muted">
          {s.status === 'faltou' ? 'faltou' : strength
            ? `${s.n_sets} séries · ${intFmt(s.volume_kg)} kg de volume${s.duration_min ? ` · ${s.duration_min} min` : ''}`
            : s.status === 'parcial' ? 'parcial' : 'feito'}
          {s.source === 'bot' && ' · via chat'}
        </span>
      </span>
      {s.n_prs > 0 && <Badge tone="lime"><Trophy size={13} aria-hidden="true" /> {s.n_prs} PR</Badge>}
      {strength && <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />}
    </>
  )
  return (
    <li>
      {strength ? (
        <button type="button" onClick={() => go(`sessao/${s.id}`)} className="flex w-full items-center gap-3 py-3 text-left">{content}</button>
      ) : (
        <div className="flex items-center gap-3 py-3">{content}</div>
      )}
    </li>
  )
}
