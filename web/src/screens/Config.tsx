import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Database, Info, LogOut, Wifi, WifiOff } from 'lucide-react'
import { useLastData } from '../lib/api'
import { supabase } from '../lib/supabase'
import { go } from '../lib/router'
import { relTime } from '../lib/format'
import { Button, Card, CardHead, IconButton, Skeleton } from '../components/ui'

declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
declare const __BUILD_DATE__: string

const TABLE_LABEL: Record<string, string> = {
  sessions: 'sessão', set_logs: 'série', body_metrics: 'peso/medida', food_logs: 'refeição', bot_notes: 'nota', daily_checks: 'creatina/água',
}

export function Config({ email }: { email: string }) {
  const last = useLastData()
  const ping = useQuery({
    queryKey: ['ping'],
    refetchInterval: 30_000,
    retry: 0,
    queryFn: async () => {
      const t = performance.now()
      const { error } = await supabase!.from('goals').select('id').limit(1)
      if (error) throw new Error(error.message)
      return Math.round(performance.now() - t)
    },
  })
  const online = ping.isSuccess

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-1 pt-1">
        <IconButton label="Voltar" onClick={() => (history.length > 1 ? history.back() : go('hoje'))}><ArrowLeft size={24} /></IconButton>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Configurações</h1>
      </header>

      <Card aria-labelledby="st-title">
        <CardHead id="st-title" title="Status" />
        <dl className="mt-3 divide-y divide-line">
          <Row icon={online ? <Wifi size={20} className="text-ok" /> : <WifiOff size={20} className="text-err" />} label="Conexão com o banco">
            {ping.isPending ? 'testando…' : online ? <span className="text-ok">ok · {ping.data} ms</span> : <span className="text-err">sem resposta</span>}
          </Row>
          <Row icon={<Database size={20} className="text-muted" />} label="Último dado">
            {last.isPending ? <Skeleton className="h-5 w-24 rounded-md" /> : last.data
              ? <>{relTime(last.data.at!)} <span className="text-muted">({TABLE_LABEL[last.data.table] ?? last.data.table})</span></>
              : <span className="text-muted">nenhum ainda</span>}
          </Row>
          <Row icon={<Info size={20} className="text-muted" />} label="Versão">
            <span className="tabular-nums">{__APP_VERSION__} · {__BUILD_SHA__}</span> <span className="text-muted">({__BUILD_DATE__})</span>
          </Row>
        </dl>
      </Card>

      <Card aria-labelledby="acc-title">
        <CardHead id="acc-title" title="Conta" sub={email} />
        <Button variant="danger" size="lg" className="mt-4 w-full" onClick={() => supabase?.auth.signOut()}>
          <LogOut size={20} aria-hidden="true" /> Sair
        </Button>
      </Card>

      <p className="px-1 text-sm leading-relaxed text-muted">
        App pessoal do Kaluan. Peso, medidas, refeições, fotos e remarcações entram pelo chat com o assistente; aqui ficam
        os registros de treino e a creatina. Horários em America/São Paulo.
      </p>
    </div>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span aria-hidden="true">{icon}</span>
      <dt className="flex-1 text-[15px] text-muted">{label}</dt>
      <dd className="text-right text-[15px]">{children}</dd>
    </div>
  )
}
