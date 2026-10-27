import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, missingConfig } from './lib/supabase'
import { useRoute } from './lib/router'
import { BottomNav, type Tab } from './components/BottomNav'
import { Toaster } from './components/ui'
import { Login } from './screens/Login'
import { Hoje } from './screens/Hoje'
import { Treino } from './screens/Treino'
import { Sessao } from './screens/Sessao'
import { Evolucao } from './screens/Evolucao'
import { Nutricao } from './screens/Nutricao'
import { Agenda } from './screens/Agenda'
import { Notas } from './screens/Notas'
import { Config } from './screens/Config'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const route = useRoute()
  const qc = useQueryClient()

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) qc.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  if (!supabase) return <ConfigMissing />
  if (session === undefined) return <div className="min-h-full" aria-busy="true" />
  if (!session) return <Login />

  const fullscreen = route.name === 'sessao'
  const tab: Tab | null = ['hoje', 'treino', 'evolucao', 'nutricao', 'agenda'].includes(route.name) ? (route.name as Tab) : null

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col">
      <main
        className={`flex-1 px-4 ${fullscreen ? '' : 'pt-[max(env(safe-area-inset-top),16px)] pb-8'}`}
      >
        {route.name === 'hoje' && <Hoje />}
        {route.name === 'treino' && <Treino />}
        {route.name === 'sessao' && <Sessao id={route.id} />}
        {route.name === 'evolucao' && <Evolucao />}
        {route.name === 'nutricao' && <Nutricao />}
        {route.name === 'agenda' && <Agenda />}
        {route.name === 'notas' && <Notas email={session.user.email ?? ''} />}
        {route.name === 'config' && <Config email={session.user.email ?? ''} />}
      </main>
      {!fullscreen && <BottomNav tab={tab} />}
      <Toaster />
    </div>
  )
}

function ConfigMissing() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Quase lá</h1>
      <div className="rounded-[var(--radius-card)] bg-card p-5">
        <p className="text-muted">
          O app ainda não tem a configuração do Supabase. Falta definir no <code className="text-fg">.env.local</code>:
        </p>
        <ul className="mt-3 space-y-1">
          {missingConfig.map((k) => (
            <li key={k} className="font-mono text-warn">{k}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">Depois é só rodar o build de novo.</p>
      </div>
    </div>
  )
}
