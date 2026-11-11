# Carboidrato e gordura: faixas por zona, como a proteína

Decidido em 11/11/2026, a pedido do Kaluan. Mesmo espírito da proteína (`docs/proteina.md`): **zonas** (abaixo do
mínimo · mínimo ok · ideal · acima da faixa), sem "faltam X g". A cor nunca vai sozinha: sempre ícone e palavra.

Fonte única: a view `v_day_targets` (migração `20261111200000_saldo_alvo_macros.sql`), uma linha por dia. O app
(`web/src/lib/macros.ts`: Nutrição, Hoje, resumos) e o assistente (`fit day`, `fit meal`, `fit summary`) usam os
mesmos números.

## A base: a permissão do dia

As duas faixas saem da **permissão do dia** (pode consumir = basal + rotina + exercício feito − 300; ver
`docs/calorias.md`), porque as diretrizes de gordura são em **% da energia** e o carboidrato é o macro que **preenche
o resto**. Treinar aumenta a permissão e, com ela, o espaço do carboidrato (o combustível do treino). A proteína não
depende da permissão: é g/kg do peso de referência.

## Regra

### Gordura: % da permissão do dia

| Zona | Faixa | Cor no app |
|---|---|---|
| **abaixo do mínimo** | < 15 % | âmbar, seta para baixo ("até agora" no dia em andamento) |
| **mínimo ok** | 15 % até < 20 % | roxo da gordura, ✓ |
| **ideal** | 20 % a 35 % | verde, ✓✓ |
| **acima da faixa** | > 35 % | âmbar, seta para cima |

- **Ideal 20–35 %:** faixa das diretrizes para atletas (ACSM/AND/DC 2016) e da população geral (AMDR do IOM).
  Iraki et al. (2019) usam os mesmos 20–35 % e dizem que isso dá ~0,5–1,5 g/kg.
- **Mínimo ok 15–20 %:** aceitável num dia ou numa fase curta de corte (Helms et al. 2014 usam 15–30 % na
  preparação de fisiculturistas), mas o ACSM desaconselha ficar **de forma crônica** abaixo de 20 %: dieta pobre em
  gordura tende a faltar vitaminas lipossolúveis e ácidos graxos essenciais (n-3).
- **Abaixo de 15 %:** abaixo até da faixa de corte.
- **Acima de 35 %:** acima da AMDR; dentro da permissão, sobra pouco espaço para carbo e proteína.

### Carboidrato: mínimo fixo + o espaço que sobra na permissão

| Zona | Faixa | Cor no app |
|---|---|---|
| **abaixo do mínimo** | < 130 g | âmbar, seta para baixo |
| **mínimo ok** | 130 g até < início do ideal | verde-limão do carbo, ✓ |
| **ideal** | início a fim do ideal | verde, ✓✓ |
| **acima da faixa** | > fim do ideal | âmbar, seta para cima |

```
início do ideal = (permissão × (1 − 35 %) − 4 × teto útil da proteína) / 4     (nunca abaixo de 130 g)
fim do ideal    = (permissão × (1 − 20 %) − 4 × ideal da proteína) / 4         (nunca abaixo do início)
```

- **Mínimo 130 g/dia:** a RDA de carboidrato do IOM, a glicose que o cérebro usa por dia. Vale para qualquer peso.
- **Ideal = o resto da permissão:** com a proteína e a gordura nas faixas delas, o carbo fica com o que sobra
  (Helms et al. 2014: "o restante das calorias vem do carboidrato"; Iraki et al. 2019: idem, mirando ≥ 3–5 g/kg).
  O início supõe proteína e gordura no alto das faixas (2,2 g/kg e 35 %); o fim, no começo delas (1,6 g/kg e 20 %).
- **Por que não 3–5 g/kg fixos:** é a faixa do ACSM para treino leve, e o Kaluan treina quase todo dia. Só que, com
  −300 kcal/dia e proteína alta, 3 g/kg (276 g) num dia sem treino não cabem junto com proteína e gordura na
  permissão. A faixa pelo espaço chega perto de 3–5 g/kg nos dias de treino forte e cai nos dias de descanso, que é o
  que as diretrizes pedem ("ajustar ao volume de treino").
- **Por que não 45–65 % da energia (AMDR):** com proteína em 1,6–2,2 g/kg (25–40 % da permissão) e gordura ≥ 20 %,
  65 % de carbo é impossível; a AMDR é para a população geral.
- **Acima da faixa:** carbo além do espaço significa passar da permissão ou deixar proteína e gordura abaixo das faixas.

## Peso de referência

O carbo usa a **faixa da proteína** (`v_protein_target`), então o mesmo peso de referência: a última pesagem limitada
ao peso do IMC 30 (**91,9 kg** para o Kaluan, 92,5 kg na balança e 175 cm). As diretrizes em g/kg vêm de atletas
sem obesidade; com sobrepeso, g/kg do peso cheio superestima a necessidade (mesmo argumento de `docs/proteina.md`).

A permissão (kcal) usa o **peso da balança** (92,5 kg) no basal de Mifflin-St Jeor, porque o gasto depende da massa
toda. A gordura, por ser % da permissão, herda esse peso. Resumo: kcal pelo peso real; g/kg pelo peso de referência.

## Kaluan em 11/11/2026

Proteína (todo dia): mínimo **119 g**, ideal **147–202 g**. Carbo e gordura mudam com a permissão do dia:

| Dia | Permissão | Gordura (mín · ideal) | Carbo (mín · ideal) |
|---|---|---|---|
| sem treino (gasto 2.225) | **1.925 kcal** | 32 · **43–75 g** (0,47–0,82 g/kg) | 130 · **130–238 g** (1,4–2,6 g/kg) |
| treino moderado (+450 kcal, como 08/11) | **2.375 kcal** | 40 · **53–92 g** | 130 · **184–328 g** (2,0–3,6 g/kg) |
| treino forte (+782 kcal, como 10/11) | **2.707 kcal** | 45 · **60–105 g** | 130 · **238–394 g** (2,6–4,3 g/kg) |

No dia sem treino a zona "mínimo ok" do carbo fica vazia: o início do ideal encosta nos 130 g.

## Onde mudar

Colunas em `goals` (só com confirmação do Kaluan e `fit note decisao`): `fat_floor_pct` (15), `fat_min_pct` (20),
`fat_max_pct` (35), `carb_floor_g` (130). As colunas antigas (`goals.fat_g_per_kg_min/max`,
`v_nutrition_targets.fat_min_g/max_g/carb_target_g`) ficam no banco, mas o app e os resumos não as leem mais.

Dias com **diário incompleto** (`fit diario incompleto <data>`) não têm zona e ficam fora das médias.

## Fontes

- Thomas DT, Erdman KA, Burke LM. Nutrition and Athletic Performance (posição conjunta ACSM, Academy of Nutrition and
  Dietetics e Dietitians of Canada). *Med Sci Sports Exerc* 2016;48(3):543–568. Carbo 3–5 g/kg (treino leve) e
  5–7 g/kg (~1 h/dia); gordura 20–35 % da energia, desaconselhado < 20 % de forma crônica.
  <https://doi.org/10.1249/MSS.0000000000000852>
- Institute of Medicine. *Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol,
  Protein, and Amino Acids*. National Academies Press, 2005. RDA de carboidrato 130 g/dia; AMDR gordura 20–35 %,
  carboidrato 45–65 %. <https://doi.org/10.17226/10490>
- Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation:
  nutrition and supplementation. *J Int Soc Sports Nutr* 2014;11:20. Gordura 15–30 % das kcal; carboidrato = o resto.
  <https://doi.org/10.1186/1550-2783-11-20>
- Iraki J, Fitschen P, Espinar S, Helms E. Nutrition Recommendations for Bodybuilders in the Off-Season: A Narrative
  Review. *Sports* 2019;7(7):154. Gordura 20–35 % (~0,5–1,5 g/kg); carboidrato = o resto, ≥ 3–5 g/kg.
  <https://doi.org/10.3390/sports7070154>
