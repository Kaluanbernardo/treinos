# Calorias: como o app calcula gasto e saldo

Fonte única: a view `v_energy_daily` (1 linha por dia, do primeiro dado até hoje). O app (aba Calorias) e o
assistente (`fit kcal-day`) leem a mesma view.

## Gasto do dia = basal + rotina + exercício

- **Basal (BMR):** Mifflin-St Jeor com o último peso de `body_metrics` até a data (antes da 1ª pesagem,
  `goals.peso_ref_kg`): `10·kg + 6,25·cm − 5·idade + 5` (homem) ou `− 161` (mulher). Altura, data de
  nascimento e sexo vêm de `profile`. Se faltar qualquer um, o basal, o gasto e o saldo ficam `NULL` e o app
  pede os dados em Configurações (`bmr_missing` lista o que falta). Nunca preencher com valores inventados.
- **Rotina (escolha):** fator modesto de **1,20 sobre o basal** (`profile.activity_factor`, ajustável de
  1,00 a 1,60), mostrado **separado** do basal. Por quê: sem esse fator o gasto ignora a digestão (~10 %) e o
  movimento mínimo do dia, e um dia comendo abaixo do gasto real apareceria como superávit. 1,20 é o
  multiplicador "sedentário" clássico; os treinos não entram nele (vêm à parte), então não há contagem dupla.
  Se o peso médio de 2–3 semanas contradizer o saldo, o assistente ajusta o fator com `fit perfil --fator`.
- **Exercício:** kcal **ativas** do relógio (`exercise_kcal`, source `relogio`), não as totais (as totais
  já incluem o basal). Por sessão (`session_id`, 1 leitura por sessão) ou do dia inteiro (sem sessão).
  O app também grava a leitura da sessão ao tocar "Finalizar treino" (campo opcional, source `app`),
  junto com a duração informada (vira `ended_at = started_at + minutos`).
  - Sessão feita/parcial sem leitura → **estimativa**: `(MET − 1) × kg × horas` (só o que passa do repouso).
    MET (`modality_met`): musculação 5, muay thai 10, jiu-jitsu 8, cross 8, funcional 6. Duração: início→fim
    da sessão, senão a da grade/exceção, senão a estimada da ficha, senão 60 min (teto 180).
  - Uma leitura do **dia inteiro** cobre todos os treinos do dia: nenhuma estimativa nesse dia.
  - `is_estimate` = o número do dia tem alguma parte estimada (o app mostra "estimado").

## Passos (só exibição)

`daily_checks.steps` (gravado com `fit steps`) aparece no Hoje e na quebra do dia da aba Calorias, com a
referência de 10 000 passos. **Não entra no gasto:** a rotina continua basal × 0,20 (`activity_factor` 1,20).

Ideia futura, ainda não implementada: trocar o fator fixo por NEAT a partir dos passos (ordem de grandeza
~0,04–0,05 kcal por passo para ~94 kg). Antes de fazer isso: (1) decidir o que acontece com o fator 1,20, que
já cobre digestão e movimento mínimo, para não contar duas vezes; (2) descontar os passos feitos durante os
treinos, que já entram em exercício (relógio ou MET); (3) ter algumas semanas de passos registrados para
comparar com a tendência de peso antes de mexer no número.

## Saldo = comida − gasto

`balance_kcal` negativo = déficit. Só existe quando há basal **e** refeição registrada no dia. É o **saldo real**: zero
é manutenção (comer exatamente o gasto).

## Meta fixa e permissão (decisão do Kaluan, 11/11/2026)

A meta do dia é **um saldo fixo**, treine ou não: **saldo-alvo = −300 kcal/dia** (déficit). Guardado em
`goals.deficit_kcal = 300` e exposto como `v_energy_daily.target_balance_kcal = −300`. Muda sem código com
`fit saldo-alvo <kcal>` (só a pedido do Kaluan; grava `decisao`). O seed reaplicado não mexe nesse valor.

O que o treino muda é **quanto dá para comer**, não a meta:

```
pode consumir (permissão) = basal + rotina + exercício já feito + saldo-alvo      (= gasto − 300)
ainda resta               = pode consumir − comida
saldo contra a meta       = comida − permissão                                    (= saldo real + 300)
```

Fonte única: `v_day_targets` (migração `20261111200000_saldo_alvo_macros.sql`): `allowance_kcal`, `remaining_kcal`,
`balance_vs_target_kcal`. Sem basal, a permissão cai em `goals.kcal_target` (meta fixa, sem treino somado). O app
mostra **uma** meta (−300) mais "pode consumir hoje" e "ainda resta", e diz quanto o treino somou na permissão. Treino
de hoje ainda por fazer não entra na conta: aparece só como aviso ("quando registrar, a permissão sobe ≈ 830 kcal",
estimativa por MET). Não existe mais o par "com treino / sem treino".

## Diário incompleto

`daily_checks.diary_incomplete` marca o dia em que o diário alimentar ficou incompleto (refeição sem registro, ou dia
placeholder como 05/11/2026). O assistente marca só com o que o Kaluan disser (`fit diario incompleto <data>`); o
app nunca deduz por heurística (comer pouco não é diário incompleto). `v_day_targets.day_state` resume:
`na_conta` · `hoje` · `incompleto` · `sem_refeicao` · `sem_basal`. **Só `na_conta` entra nas somas** (saldo da semana e
do mês, saldo acumulado, médias dos resumos).

## Saldo acumulado (app: Treino → Calendário → Kcal)

O modo Kcal do calendário (antes um mapa de calor de kcal de exercício) virou um gráfico do **saldo real acumulado**.
O mapa de calor de treinos não mudou. Conta em `web/src/lib/balance.ts` (`cumulativeBalance`):

- **Linha real:** Σ (comida − gasto) dia a dia no período; o zero é manutenção. Trechos abaixo de zero em verde
  (déficit acumulado), acima em âmbar (superávit acumulado).
- **Linha da meta:** Σ saldo-alvo (−300) **nos mesmos dias** que entram no real: depois de N dias na conta, −300 × N.
  Tracejada e neutra, com rótulo "meta".
- **Barras:** o saldo real de cada dia (outro painel, mesma linha do tempo, escala própria).
- **Períodos:** Semana (seg–dom) e Mês (do calendário), com setas para os anteriores; 90 dias e Tudo terminam hoje.
- **Dias fora da conta** (hoje, diário incompleto, sem refeição, sem basal): **ficam de fora das duas linhas**, que
  ficam paradas nesses dias; o dia ganha um anel vazio nas barras e aparece nomeado em "Fora da conta". Por quê:
  somar um dia sem tudo registrado inventaria um déficit (o gasto inteiro contra parte da comida), e somar −300 na
  meta por um dia sem dados cobraria uma meta que não dá para medir. Destacar e ainda assim somar levaria o número
  principal a mentir.

## Saldo da semana e do mês (app: Nutrição → Semana / Mês)

Soma de `balance_kcal` no cliente, em `web/src/lib/balance.ts`, sem coluna nova na view:

- **Semana:** segunda a domingo. **Mês:** do dia 1 ao último do calendário. "Hoje" é sempre `America/Sao_Paulo`;
  as setas voltam para períodos anteriores (leitura direta de `v_energy_daily` por intervalo de datas).
- **Na conta:** só dia fechado com saldo e diário completo. Comida, gasto e média por dia usam os mesmos dias, então
  comida − gasto = saldo.
- **Fora da conta, e nomeado na tela:**
  - **hoje:** basal do dia inteiro contra a comida até agora daria um déficit falso; aparece à parte como
    "até agora" e entra na soma quando o dia fechar;
  - **dia sem refeição:** o saldo é `NULL`; não vira zero nem déficit do gasto inteiro;
  - **dia com refeição, sem basal:** idem, com o motivo;
  - **diário incompleto** (marcado no chat): fica fora, nomeado;
  - **dia futuro.**
- "Déficit alto" no período compara a **média por dia** com o mesmo limite do dia (−600 kcal). O equivalente em kg
  usa 7700 kcal/kg, como a aba Calorias.

A aba Calorias ("Saldo diário") tem outra janela: últimos 7/30 dias corridos, com hoje na média.

## Meta de kcal de hoje (app: Hoje, Nutrição, Calorias)

Conta no cliente, em `web/src/lib/kcal.ts` (`useDayAllowance()`), a partir de `v_energy_daily` (linha de hoje) e do
plano do dia, com a mesma regra de `v_day_targets`:

```
meta        = target_balance_kcal (−300), fixa
pode consumir = bmr_kcal + daily_life_kcal + exercise_kcal (já registrado hoje) + target_balance_kcal
ainda resta = pode consumir − comida de hoje
aviso       = Σ treinos de hoje ainda sem registro: (MET − 1) × kg × min/60, mesma regra de v_energy_daily
              (min da grade/ficha, senão 60, teto 180); sem peso: média de exercise_kcal dos últimos 14 dias
```

O anel de kcal usa a permissão. O que passou não muda a permissão de hoje (sem ajuste pelos dias anteriores). Dias
passados (Nutrição/Calorias) mostram a permissão real do dia: `out_kcal − 300`.

Na aba Calorias, um dia fechado com saldo real abaixo de −600 kcal aparece como "déficit alto".

## Comandos

```bash
scripts/fit kcal 347 --session efc6ec36      # kcal ativas de um treino (upsert)
scripts/fit kcal 520 --date ontem            # total ativo do dia, sem sessão
scripts/fit kcal-day [data]                  # quebra do dia, meta, pode consumir e resta
scripts/fit saldo-alvo [-300]                # mostra ou muda a meta fixa (só a pedido do Kaluan)
scripts/fit diario incompleto ontem --nota "jantar sem registro"   # tira o dia das somas (completo desfaz)
scripts/fit steps 8432 --date ontem          # passos do dia (só exibição)
scripts/fit perfil --altura 178 --nascimento 1990-05-01 --sexo M   # só com dados ditos pelo Kaluan
FIT_ROLLBACK=1 scripts/fit kcal 300 --date hoje                     # testa sem gravar
```
