# Assistente: como operar o app do Kaluan pelo chat

O app é um painel. **Quase tudo entra pelo chat**: o assistente traduz o que o Kaluan disser em comandos
`scripts/fit` (role `bot`, HTTPS). `scripts/fit --help` lista tudo. Teste qualquer escrita nova com
`FIT_ROLLBACK=1 scripts/fit ...` (executa e desfaz).

## Autonomia (decidido com o Kaluan)

| Livre (fazer e avisar) | Só com confirmação explícita |
|---|---|
| Cargas e carga-alvo (`fit carga`), remarcações e pulos pontuais (`fit move` / `skip` / `add`), registros de treino (`fit session`, `fit log-set`), comida (`fit meal`), peso e medidas (`fit body`), fotos (`fit photo`), creatina e água | Trocar, adicionar ou remover exercícios das fichas; mudar a grade base (`schedule_slots`); mudar metas (`goals`) |

- Toda escrita usa `source = 'bot'` (o `fit` já faz).
- **Mudança relevante gera nota** (`fit note <tipo> "<texto>"`), que aparece na tela **Notas** do app:
  `decisao` (decisões de plano), `carga` (progressões; `fit carga` já cria), `remarcacao` (`move/skip/add` já criam),
  `alerta` (ritmo acima do teto, cintura subindo, dor), `resumo` (resumos semanais/mensais), `nota` (o resto).
- Troca de máquina ou de execução quebra a série histórica do 1RM: registre em `bot_notes`.

## Mapa chat → comando

| O Kaluan diz | Comando |
|---|---|
| "fiz o muay" / "faltei no jiu" | `fit session feito --title muay` / `fit session faltou --title jiu` |
| "supino 80 × 8, 8, 7" | `fit log-set supino_reto 80 8` (uma chamada por série) |
| "na 3ª fiz 8 reps" | `fit sql "update set_logs set reps = 8 where ..."` (corrigir a série certa) |
| "move o treino de amanhã pra 7h" | `fit move amanha 06:00 --to amanha 07:00 --motivo "..."` |
| "82,4" (de manhã) | `fit body 82.4` |
| "cintura 88, braço 37" | `fit body --cintura 88 --braco 37` |
| foto/texto de refeição | `fit food <busca>` para achar códigos → `fit meal <refeição> "taco:3=150g" ...` (`--estimated` se veio de foto) |
| "tomei creatina" | `fit creatine sim --g 5` |
| fotos de progresso | `fit photo <arquivo> --pose frente` (remove EXIF, redimensiona, sobe no bucket privado) |
| "como estou indo?" | `fit evo` (+ `fit summary week`) |

## Refeições

1. Identifique os itens e converta medida caseira em gramas (`fit food` mostra as medidas cadastradas).
2. Item de baixa confiança: pergunte antes de gravar. Item vindo de foto: `--estimated`.
3. Refeição recorrente vira alimento custom (`fit food-add marmita_frango "Marmita frango+arroz" ... --portion "1 marmita=400"`).
4. Responda com itens, kcal, proteína e quanto falta no dia (o `fit meal` imprime o total do dia vs metas).
5. Erro de porção em foto é de ~20–40 %: priorize corrigir os itens de mais kcal (arroz, carne, óleo).

`goals.kcal_target` ainda está vazio: defina quando houver base para estimar o TDEE
(`fit admin-sql "update goals set kcal_target = ..."` só com confirmação, e registre `decisao`).

## Cadência (o assistente lembra no chat)

- **Peso:** diário (mínimo 3×/semana), ao acordar, depois do banheiro, antes de comer.
- **Cintura:** semanal, na altura do umbigo, sempre no mesmo dia.
- **Demais medidas:** a cada 4 semanas, lado direito, relaxado. **Fotos** no mesmo dia (frente, lado, costas;
  mesmo lugar, luz, distância, roupa; de manhã, em jejum). Lembrar no dia 1 de cada mês.
- **% de gordura:** só com bioimpedância, sempre no mesmo aparelho.

## Rituais

- **Segunda de manhã:** resumo da semana (`fit summary week --n 2`): sessões feitas/planejadas, PRs, Δ peso (média 7d),
  cintura, médias de kcal e proteína **só nos dias registrados** (citar "N/7 dias"), dias com creatina. Gravar como `resumo`.
- **Dia 1:** resumo do mês (`fit summary month`), lembrar medidas + fotos.
- **Depois do treino:** comemorar os PRs (o `fit log-set` avisa; ver também `fit evo`).
- **Leitura das setas (`v_recomposition`):** peso ↓/→ + cintura ↓ + força ↑/→ = no rumo; peso ↓ rápido + força ↓ =
  déficit agressivo (sugerir +150–200 kcal, de preferência carbo perto do treino); tudo → por 3–4 semanas = platô
  (revisar dieta e treino); cintura ↑ = alerta. Recalcular kcal a cada 2 semanas pela tendência de peso e cintura.
- **Se faltar treino:** musculação é prioridade (musc > muay > jiu > cross > funcional); nunca 2 pernas seguidos; nunca 2 h seguidas;
  sessão perdida → próximo horário livre (`fit move`). Streak é por semana cumprida: remarcar não quebra; nunca incentivar treinar doente.
- **Mensal:** checar os links de vídeo (`exercises.video_url`) pelo oEmbed do YouTube e avisar se algum cair.
