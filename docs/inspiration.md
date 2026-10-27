# Inspiração — padrões de UI de apps de treino e nutrição

Pesquisa feita em **2026-10-27** para o redesign do app (PWA escuro, pt-BR, 412 px Android, um usuário só).
O objetivo é registrar padrões **concretos e verificáveis** de oito apps de referência e decidir qual tela nossa adota cada um.
Os detalhes vêm de help centers, páginas oficiais e reviews. Onde a fonte não descreve algo (cor, forma exata), isso fica dito. Nada aqui foi inventado a partir de screenshots.

Etiquetas: `[home]` hierarquia/dashboard · `[anel]` anéis/progresso · `[tendência]` sparklines/gráficos · `[KPI]` número protagonista ·
`[série]` registro de séries · `[macro]` barras/anéis de macros · `[constância]` streak/calendário · `[resumo]` tela pós-treino.

---

## Hevy

- `[série]` Coluna **PREVIOUS** à esquerda de cada linha de série, com peso×reps da última vez que o exercício foi feito. Ela só aparece durante um treino ao vivo (não ao editar rotina). Ao adicionar um exercício já feito, os valores anteriores vêm **pré-preenchidos** e editáveis.
- `[série]` **Checkmark por série.** Marcar a série é o que **dispara o descanso**. O timer é por exercício (5 s a 5 min), fica no topo do bloco do exercício e tem botões **−15 s / +15 s**. Ao zerar, chega uma notificação (também pela Live Activity, que permite marcar a série com a tela bloqueada). O descanso não dispara se a próxima série for drop set.
- `[série]` Tocar no número da série troca o tipo: Normal → **Aquecimento (W)**, **Drop**, **Falha**. Tem RPE opcional por série e calculadora de anilhas acima do teclado para barra.
- `[KPI]` Cabeçalho do treino ao vivo: **cronômetro de duração + séries concluídas + volume**, atualizando a cada série.
- `[série]` **Notificação de PR ao vivo** quando uma série bate recorde (1RM estimado, mais reps, maior duração). O PR fica salvo no detalhe do treino.
- `[resumo]` A tela ao salvar mostra o **número ordinal do treino** ("472º"), o **streak semanal**, os destaques de PR, um **resumo de constância dos últimos 7 dias** e o detalhe. Gera imagem compartilhável (fundo escuro, claro ou transparente).
- `[constância]` O streak é contado em **semanas** (não dias). O calendário do perfil marca os dias de treino em azul. Em Estatísticas, o "Last 7 days body graph" mostra quantas vezes treinou e destaca os músculos trabalhados num **diagrama do corpo**.
- `[tendência]` Por exercício: maior peso, **1RM projetado**, melhor volume de série e de sessão, mais reps, além de **Set Records** (melhor peso por nº de reps). Tem **séries por grupo muscular por semana** (calendário, não janela móvel) e distribuição muscular com recortes de 30 d, 3 m, 1 a e tudo.

Fonte(s): https://www.hevyapp.com/features/track-workouts/ · https://www.hevyapp.com/features/workout-rest-timer/ · https://www.hevyapp.com/features/gym-progress/ · busca: https://help.hevyapp.com/hc/en-us/articles/35702030346903 , https://help.hevyapp.com/hc/en-us/articles/35380117933207 (403 no fetch, só snippet) , https://www.hevyapp.com/features/workout-settings/

## Strong

- `[série]` Fluxo mínimo: digitar peso e reps e tocar no **checkbox** da série. Deslizar exclui. "Add Set" fica embaixo de cada exercício. Um review conta **~3 toques por série**, com os valores da última sessão aparecendo automaticamente.
- `[série]` Descanso: padrão **2:00 por exercício**, começa sozinho ao completar a série e aparece **no canto superior esquerdo** da tela do treino. Tocar abre o **modo tela cheia** (ajustar ou "Skip"), que pode virar o padrão.
- `[série]` Tags de série (aquecimento, drop, falha), RPE, **calculadora de anilhas** e **calculadora de aquecimento**.
- `[KPI]` **Focus Metric** por exercício: compara com a última vez que o exercício foi feito e mostra a variação em **%**. Exemplo da doc: volume 1000 → 900 lb = **−10%**, 1000 → 1100 = **+10%**.
- `[tendência]` A tela do exercício tem as abas About / History / Charts / **Records**. Records traz uma **tabela de recordes por nº de reps**: o melhor real e o **previsto** a partir do melhor esforço, com o real substituindo o previsto quando é maior. Só considera séries de ≤12 reps porque reps altas inflam a previsão.
- `[home]` O perfil é um painel de **widgets reordenáveis** (long-press e arrastar): **Treinos por semana com meta 🎯**, qualquer gráfico de exercício ou medida, calorias da semana e macros do dia contra meta.
- `[resumo]` Dá para encerrar a qualquer momento, mesmo com séries incompletas, e **salvar ou atualizar o template** ao terminar. A doc oficial não descreve a tela de resumo.

Fonte(s): https://help.strongapp.io/article/229-my-first-workout · https://help.strongapp.io/article/231-rest-timer · https://help.strongapp.io/article/226-focus-metric · https://help.strongapp.io/article/216-exercise-records-screen · https://help.strongapp.io/article/237-about-exercise-detail · https://help.strongapp.io/article/239-profile-widgets · https://help.strongapp.io/category/165-logging-a-workout · https://repreturn.com/strong-app-review/

## Fitbod

- `[anel]`/`[constância]` **Mapa de recuperação muscular**: cada grupo muscular tem **0–100% de recuperação** num avatar frente/costas que gira com swipe. Tocar no músculo abre o histórico dele. Um músculo volta a 100% após ~7 dias sem treino. A fonte oficial não diz as cores.
- `[KPI]` **Strength Score** é um número único que resume a força geral. É a média dos scores por músculo e só aparece quando Push, Pull e Legs já têm dados (bom exemplo de "desbloqueio honesto").
- `[tendência]` **Estimated Strength (1RM estimado)** por exercício em gráfico de linha. A orientação oficial é ler a **tendência longa**, não as oscilações curtas. Os quatro levantamentos base (agachamento, terra, supino, desenvolvimento) ficam na tela Results.
- `[tendência]` Progresso por grupo muscular **sinalizando áreas pouco treinadas** (ex.: dorsais, deltoide posterior).
- `[resumo]` Marcos de PR em volume ou 1RM estimado. O formato visual não é documentado.

Fonte(s): https://fitbod.me/blog/muscle-recovery/ · https://fitbod.me/blog/how-fitbod-tracks-your-strength-progress-with-real-time-metrics-and-scores/ · busca: https://help.fitbod.me/hc/en-us/articles/12732749777047 , https://fitbod.me/blog/estimated-strength/ (snippets)

## MacroFactor

- `[tendência]` **Trend weight**: o peso da balança aparece como **linha/pontos claros** e a tendência como **linha roxa forte**, suavizada e pesando mais os dias recentes. Dias sem pesagem são **interpolados linearmente** (só para o cálculo). A tendência "olha para trás", então fica **acima da balança quando se está perdendo peso**, e isso vem explicado ao usuário.
- `[macro]` **Nutrition & Targets**: **uma coluna por dia** com **quatro barras** (kcal, proteína, gordura, carbo). Uma **linha cinza marca a meta** em cada barra, a barra fica **branca no tema escuro ao bater a meta** e o dia corrente fica emoldurado. Um toque alterna **consumido ↔ restante** e o app lembra a escolha.
- `[home]` Dashboard em blocos: Nutrição (Targets, Energy Balance de 30 d, **Food Log Focus** com consumo e meta de hoje em fonte grande) → Insights (Expenditure, Weight Trend, Goal Progress) → Hábitos (Habits, Scale Weight com **linha da última semana**, Nutrição com barras empilhadas de 7 d, Body Metrics) → Nutrientes.
- `[tendência]` **Goal Progress**: no corte, um **gráfico cascata** (barra "Semana 0" = tamanho total da meta, uma barra por semana, mais clara quando foi a favor e mais escura quando foi contra, e uma barra cinza com o que falta). Na manutenção, um **dial Abaixo/Na meta/Acima** com faixa de ±0,68 kg sobre o trend weight.
- `[tendência]` Gráficos com intervalos **3/7/14/30/90 d…** ao alcance do polegar. **Médias do intervalo acima do gráfico** ("Média kcal", "Média proteína") que acompanham o recorte. Long-press num ponto mostra tooltip com os macros do dia.
- `[constância]` Calendário de hábitos para pesagem e registro. A filosofia é **"colorido mas neutro quanto à adesão"**: o streak celebra registro e esforço, não perfeição, e não pune o dia ruim.
- `[resumo]` (MacroFactor Workouts) Na sessão, um cronômetro de duração à esquerda e o **descanso à direita** (toque = ±10 s). O cabeçalho mostra "Exercício, **Série 1 de 4**", cada linha tem a coluna anterior ou **"Sem anterior"**, e o app avança sozinho de exercício ao checar todas as séries. O resumo final traz visão geral + takeaways, **mapa corporal frente/costas** dos músculos treinados, PRs (volume, reps, força estimada), volume, duração e quebra por exercício.

Fonte(s): https://help.macrofactorapp.com/en/articles/22-get-to-know-your-dashboard · https://macrofactor.com/dashboard-revamp/ · https://help.macrofactorapp.com/dashboard/weight_trend/ · https://help.macrofactorapp.com/en/articles/310-how-to-log-a-workout

## Cronometer

- `[anel]` **Energy Summary** com **três círculos**: Consumido, Gasto e Meta/Saldo. A meta é a meta pessoal + exercício acima da base − consumido. O "modo saldo" mostra gasto − consumido.
- `[macro]` **Barras horizontais de meta** por macro com o **% da meta atingido** escrito dentro da barra. Tocar na barra abre o resumo do alvo com os **alimentos que mais contribuíram**.
- `[macro]` A **roda de calorias** mostra a divisão do que foi comido entre macros (fatias somam 100%). A própria comunidade aponta que **barra (progresso vs meta) e roda (composição)** respondem a perguntas diferentes e confundem quando ficam lado a lado sem rótulo.
- `[macro]` Cores dos alvos de nutrientes (help center atual): **cinza** = mínimo ainda não atingido, **verde** = dentro da faixa mín–máx, **vermelho** = passou do máximo. Um post antigo do fórum falava em amarelo, divergente da doc.

Fonte(s): https://forums.cronometer.com/discussion/11/difference-between-bars-and-wheel · busca (snippets, 403 no fetch): https://support.cronometer.com/hc/en-us/articles/360018069532 , https://support.cronometer.com/hc/en-us/articles/32689033683220

## Apple Fitness + Apple Health (Tendências)

- `[anel]` **Três anéis concêntricos**: Mover (vermelho, kcal ativas), Exercício (verde, minutos intensos), Ficar em pé (azul, horas com ≥1 min em pé). O anel que **dá mais de uma volta sobre si mesmo** indica que a meta foi superada.
- `[home]` A aba Resumo do iPhone tem anéis no topo, **calendário** para ver dias passados e Tendências mais abaixo. O resumo semanal traz **média diária + total semanal**.
- `[tendência]` **Setas de tendência**: comparam a **média de 90 dias com a de 365 dias**. Seta para cima = mantendo ou melhorando, seta para baixo = média de 90 d começou a cair, e **a seta para baixo vem com coaching** de como reverter. Precisa de **≥180 dias** de dados para aparecer (exemplo de honestidade com dados escassos).
- `[tendência]` No detalhe, o Health desenha **barras semanais + linha em degrau** (média de um período → média do seguinte), não reta de regressão. Um crítico aponta que o degrau pode fazer dados dispersos parecerem uma mudança clara. O Health também mostra "sem tendência" quando a variação não é significativa.
- `[constância]` Prêmios por **recordes, sequências e marcos**, e as metas dos anéis podem ser **pausadas** ou definidas por dia da semana (descanso não quebra a lógica).

Fonte(s): https://support.apple.com/en-us/108359 · https://leancrew.com/all-this/2024/11/apple-health-trends/ · busca: https://www.macworld.com/article/233093/ios-13-and-apple-watch-activity-trends-give-you-the-big-picture.html

## Google Fit

- `[anel]` **Dois anéis concêntricos**: Pontos Cardio (verde, externo) e Minutos de Movimento (azul, interno). Ao fechar, o anel **vira um octógono com animação**, e uma **seta dupla** no anel indica meta superada.
- `[KPI]` Abaixo dos anéis, em fonte **um degrau menor**: passos, kcal e distância. Tocar abre um gráfico por dia, semana ou mês.
- `[home]` Rolando: cards de passos, frequência cardíaca e **peso**. Os insights de coaching ficam logo abaixo das métricas do dia, e tem um botão "+" para registrar.
- `[anel]` A métrica pesa a intensidade (1 ponto por minuto moderado, 2 por minuto intenso). As metas começam baixas e o app sugere ajustar com o tempo.

Fonte(s): https://9to5google.com/2018/08/22/hands-on-google-fit-redesign/ · busca: https://www.engadget.com/2018-08-21-google-fit-redesign-move-heart-points.html (redesign de 2018, pode estar desatualizado)

## Whoop

- `[anel]` A home tem **três dials: Sono, Recuperação, Strain**, e cada um abre sua página de detalhe ("cada tile é uma porta, não um destino").
- `[KPI]` Recuperação de 0–100% em **três faixas de cor**: verde 67–100, amarelo 34–66, vermelho 0–33. A própria Whoop diz que as cores simplificam uma escala contínua. O número de Recuperação é **enorme (~72 pt)**, legível a um braço de distância, com o texto de apoio pequeno.
- `[KPI]` **Strain** numa escala **0–21** (inspirada na escala de Borg), com categorias Leve, Moderado, Alto e Máximo.
- `[tendência]` Hierarquia em **três níveis**: visão geral sem gráficos → tendências (Recuperação de 7 d com **zonas coloridas**, barras de Strain **contra a meta**, sono **contra a base pessoal**) → gráficos profundos (HRV, FC de repouso de 30 d…). Tudo é comparado com **a base da própria pessoa**, não com uma população.
- `[home]` Gráfico semanal de **Strain × Recuperação** na home. Recomendações ao longo do dia (Strain alvo conforme a recuperação). Botão "+" fixo para iniciar treino ou abrir o diário.
- `[home]` Paleta estreita repetida em todas as telas, **sem cores decorativas**. Tema escuro justificado pelo uso de manhã cedo e à noite. Transições animadas entre níveis para não perder o lugar.

Fonte(s): https://www.925studios.co/blog/whoop-design-breakdown · https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/ · busca: https://developer.whoop.com/docs/whoop-101 , https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/ (403 no fetch, só snippet)

---

## Adoção por tela

Restrições aplicadas: SVG inline (sem libs novas além do Recharts que já existe), nada de formulários (dados entram pelo chat), estado honesto com poucos dados ("coletando dados" dizendo o que falta).

| # | Padrão (origem) | Tela | Como adotamos |
|---|---|---|---|
| 1 | Tile como porta, não destino (Whoop) | **Hoje** | Cada card (peso, tríade, semana, nutrição) mostra um número protagonista, sem gráfico detalhado, e o toque leva à seção correspondente de Evolução ou Nutrição. |
| 2 | Uma ação primária grande (Whoop "+", MacroFactor shortcuts) | **Hoje** | O card "Próxima sessão" tem o único botão lime ("Começar treino") e o resto da tela é leitura. |
| 3 | Setas de tendência com janela explícita (Apple Trends) | **Hoje** | Tríade peso/cintura/força com seta ↑/↓/→ e texto ("média 7 d vs 7 d anteriores"). Com poucos dados aparece "coletando dados: faltam N pesagens", sem seta. |
| 4 | Trend weight explicado (MacroFactor) | **Hoje** | O número protagonista é a **média de 7 dias** e a pesagem de hoje fica pequena ao lado, com nota curta quando os dois divergem ("a média reage devagar"). |
| 5 | Constância em semanas, não dias (Hevy streak) | **Hoje** | A faixa da semana tem 7 pontos (feito ✓ / faltou ✕ / hoje / futuro), mais "N semanas seguidas ≥ meta". O descanso planejado não quebra a sequência (Apple pausa metas). |
| 6 | Food Log Focus: consumido vs meta em fonte grande (MacroFactor) | **Hoje** | Mini-card com kcal e proteína de hoje: número grande + "/ meta" pequeno + barra fina com marca de meta. |
| 7 | Widgets de "treinos por semana com meta" (Strong) | **Treino** | No topo da lista de templates, um sparkbar das últimas 8 semanas com linha de meta. Abaixo, os 4 templates com "última vez: há N dias". |
| 8 | Focus Metric em % vs última vez (Strong) | **Treino** (sheet do template) | Cada exercício do sheet mostra a última carga×reps e um selo "+5% vol." ou "−3% vol." comparando as duas últimas sessões, sempre com sinal e texto, nunca só cor. |
| 9 | Coluna "Anterior" + pré-preenchimento (Hevy, MacroFactor "Sem anterior") | **Sessão** | Cada linha de série mostra "Anterior 60×10" à esquerda e os steppers já vêm com esses valores. Na primeira vez aparece "Sem anterior". |
| 10 | Checkmark por série dispara o descanso (Hevy/Strong) | **Sessão** | O ✓ de 56–64 px confirma a série e inicia a barra de descanso. Desmarcar desfaz (MacroFactor). |
| 11 | Descanso com ±15 s e Pular (Hevy/Strong/MacroFactor) | **Sessão** | A barra de descanso fixa embaixo mostra tempo restante em fonte tabular, botões −15 / +15 / Pular de ≥48 px e vibração ao zerar. Padrão de 2:00 por exercício (Strong). |
| 12 | "Série 2 de 4" + avanço automático (MacroFactor Workouts) | **Sessão** | O chip do exercício ativo mostra o progresso "2/4" e, ao checar a última série, o próximo chip fica ativo sozinho. |
| 13 | PR ao vivo (Hevy) | **Sessão** | Selo "PR" (ícone + texto) aparece na linha que bateu o e1RM ou as reps máximas daquela carga, com animação curta respeitando `prefers-reduced-motion`. |
| 14 | Cabeçalho duração + séries + volume (Hevy) | **Sessão** | Barra superior com cronômetro, "séries 7/16" e volume em kg atualizando a cada ✓. |
| 15 | Ordinal + streak + PRs na tela de salvar (Hevy) | **Resumo** | Hero "Treino nº 37", com volume, séries e duração em três KPIs. Embaixo vem "N semanas seguidas" e a lista de PRs da sessão. |
| 16 | Melhor série por exercício + takeaways (MacroFactor/Fitbod) | **Resumo** | Uma linha por exercício com a melhor série (kg×reps, e1RM) e a variação vs última vez. A frase de takeaway vem pronta das views (sem IA no cliente). |
| 17 | Mapa corporal frente/costas (MacroFactor resumo, Hevy, Fitbod) | **Resumo** / **Evolução** | SVG inline simples com os grupos treinados destacados em lime e legenda textual dos grupos. Na Evolução vira "séries/semana por grupo", com destaque para grupos abaixo do alvo (Fitbod). |
| 18 | Balança clara + tendência forte (MacroFactor) | **Evolução** | Gráfico de peso com pontos pequenos `#9AA4B2` para as pesagens e uma linha de 2 px com área de 15% para a média de 7 d, mais o último valor rotulado. Interpolação só no cálculo, nunca mostrada como dado. |
| 19 | Médias do intervalo acima do gráfico + seletor de janela (MacroFactor) | **Evolução** | Chips 4 sem / 12 sem / tudo com "Δ média 7 d: −1,2 kg" acima do gráfico, mudando com a janela escolhida. |
| 20 | Cascata de progresso da meta (MacroFactor Goal Progress) | **Evolução** | Opcional: barras semanais de Δ da média de peso (cor ok quando a favor da recomposição, neutra quando contra) com rótulo de texto em cada uma. |
| 21 | Tabela de recordes por reps, real vs previsto (Strong Records) | **Evolução** | A lista de PRs por exercício mostra o melhor peso para 1/3/5/8/10/12 reps, com os previstos em cinza e os reais em branco, só até 12 reps. |
| 22 | e1RM por exercício, ler a tendência longa (Fitbod) | **Evolução** | Linha de e1RM por exercício com a legenda "tendência de semanas, não de um treino". Com menos de 3 sessões aparece "coletando dados: faltam N sessões". |
| 23 | Desbloqueio honesto de score (Fitbod Strength Score, Apple 180 d) | **Evolução** / **Hoje** | Blocos compostos (ex.: seta de força da tríade) só aparecem com dados mínimos, e até lá o estado diz exatamente o que falta. |
| 24 | Barras diárias com linha de meta, branca ao bater (MacroFactor) | **Evolução** (nutrição semanal) / **Nutrição** | 7 colunas × kcal/proteína com tick de meta. A barra que bate a meta ganha ✓ e preenchimento cheio, o dia atual tem contorno. |
| 25 | Barra horizontal com % da meta dentro (Cronometer) | **Nutrição** | Proteína, carbo e gordura em barras com "132/170 g · 78%" no rótulo, cada uma na cor da métrica. Separamos claramente progresso (barras) de composição, sem roda de pizza. |
| 26 | Anel único que dá mais de uma volta ao superar (Apple) | **Nutrição** | Anel de kcal em SVG. Se passar da meta, a sobra continua como segundo trecho em tom warn com o texto "+180 kcal acima", sem depender só da cor. |
| 27 | Faixas cinza/verde/vermelho mín–máx (Cronometer) | **Nutrição** | Água e proteína usam "abaixo do mínimo / na faixa / acima" com ícone + texto. Creatina é um check binário de 56 px. |
| 28 | Neutralidade quanto à adesão (MacroFactor) | **Nutrição** / **Agenda** | Sem vermelho punitivo para dia ruim: "Faltei" aparece em neutro com ícone ✕ e texto, e o progresso fala em constância, não em fracasso. |
| 29 | Calendário com dias marcados (Hevy/Apple) | **Agenda** | Semana em colunas com sessões e aulas. Feito ✓, faltei ✕ e exceção (movido/extra) levam ícone + rótulo "movido de ter". Hoje fica destacado com contorno lime. |
| 30 | Coaching junto da seta para baixo (Apple Trends) / recomendações ao longo do dia (Whoop) | **Notas** | Cada nota do assistente que comenta uma tendência leva um chip do indicador ("Peso 7 d ↓") que abre o gráfico correspondente na Evolução. O feed fica em ordem cronológica, com o tipo marcado por ícone. |
| 31 | Paleta estreita, sem cor decorativa (Whoop) | **Todas** | Cor de métrica só nos dados dela (kcal laranja, proteína azul…) e lime só para ação ou destaque. Confirma a regra já em DESIGN.md. |

### O que entrou no redesign v3 (27/10/2026)

Implementado: 1, 2, 3 (setas com janela "4 sem vs 4 anteriores"), 4, 5, 6 (anéis + números), 7, 9 (coluna "anterior" e "sem anterior"), 10, 11 (anel de descanso), 12 (chip "2/4"), 13, 14 (anel de séries + volume no cabeçalho), 16 (melhor série + barra de volume), 18, 19 (Δ 4 sem acima do gráfico), 22, 23, 25, 26, 27 (faixas mín–máx em proteína, gordura e água), 28, 29, 31. A ficha do Treino ganhou a última melhor série e uma sparkline de 1RM por exercício (variação do 8).

Fica para depois (exigiria view nova ou mais dados): 8 em %, 15 (ordinal do treino), 17 (mapa corporal), 20, 21 (recordes por nº de reps), 24 (barras diárias na Nutrição), 30 (chip de indicador nas notas).
