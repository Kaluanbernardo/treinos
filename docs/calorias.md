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
  movimento mínimo do dia, e um dia comendo no déficit de 300 kcal apareceria como superávit. 1,20 é o
  multiplicador "sedentário" clássico; os treinos não entram nele (vêm à parte), então não há contagem dupla.
  Se o peso médio de 2–3 semanas contradizer o saldo, o assistente ajusta o fator com `fit perfil --fator`.
- **Exercício:** kcal **ativas** do relógio (`exercise_kcal`, source `relogio`), não as totais (as totais
  já incluem o basal). Por sessão (`session_id`, 1 leitura por sessão) ou do dia inteiro (sem sessão).
  - Sessão feita/parcial sem leitura → **estimativa**: `(MET − 1) × kg × horas` (só o que passa do repouso).
    MET (`modality_met`): musculação 5, muay thai 10, jiu-jitsu 8, cross 8, funcional 6. Duração: início→fim
    da sessão, senão a da grade/exceção, senão a estimada da ficha, senão 60 min (teto 180).
  - Uma leitura do **dia inteiro** cobre todos os treinos do dia: nenhuma estimativa nesse dia.
  - `is_estimate` = o número do dia tem alguma parte estimada (o app mostra "estimado").

## Saldo = comida − gasto

`balance_kcal` negativo = déficit. Só existe quando há basal **e** refeição registrada no dia. A meta
(`target_balance_kcal`) é `−goals.deficit_kcal` (−300).

## Comandos

```bash
scripts/fit kcal 347 --session efc6ec36      # kcal ativas de um treino (upsert)
scripts/fit kcal 520 --date ontem            # total ativo do dia, sem sessão
scripts/fit kcal-day [data]                  # quebra do dia
scripts/fit perfil --altura 178 --nascimento 1990-05-01 --sexo M   # só com dados ditos pelo Kaluan
FIT_ROLLBACK=1 scripts/fit kcal 300 --date hoje                     # testa sem gravar
```
