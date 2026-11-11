# Proteína: faixa flexível em vez de meta rígida

Decidido em 11/11/2026, a pedido do Kaluan. A meta rígida anterior ("faltam X g" até um número fixo) virou uma
**faixa com zonas**. Fonte única: a view `v_protein_target` (migração `20261111120000_meta_semanal_proteina.sql`).
O app (`web/src/lib/protein.ts`) e o assistente (`fit day`, `fit meal`, `fit summary`) usam os mesmos números.

## Regra

| Zona | Faixa (g/kg do peso de referência) | Cor no app |
|---|---|---|
| **abaixo do mínimo** | < 1,3 | âmbar, seta para baixo ("até agora" no dia em andamento) |
| **mínimo ok** | 1,3 até < 1,6 | azul da proteína, traço |
| **ideal** | 1,6 a 2,2 | verde, check |
| **acima do teto útil** | > 2,2 | âmbar, seta para cima |

A cor nunca vai sozinha: sempre com ícone e palavra. Não existe mais "faltam X g" para a proteína.

- **Mínimo efetivo, 1,3 g/kg:** meio da faixa de ~1,2–1,4 g/kg. Abaixo disso o ganho de massa magra cai
  rápido (meta-análise em sobrepeso: acima de ~1,3 g/kg a massa muscular tende a subir, abaixo de 1,0 g/kg a cair).
  O ISSN coloca o piso para quem treina em 1,4 g/kg.
- **Ideal, 1,6 g/kg:** platô do ganho de massa livre de gordura com musculação (1,62 g/kg/dia) na meta-análise de
  Morton et al. (2018). Acima dele, o ganho extra médio é zero.
- **Teto útil, 2,2 g/kg:** limite superior do IC 95 % desse platô (1,03–2,20). Comer mais **não faz mal**, só deixa
  de trazer ganho e ocupa kcal que poderiam ser carbo (treino) ou gordura. O ISSN fala em 1,4–2,0 g/kg para a maioria
  e em 2,3–3,1 g/kg para quem treina força **em déficit grande**. Desde 11/11/2026 a meta é um déficit fixo de
  300 kcal/dia (`docs/calorias.md`), moderado (~12 % do gasto): o teto de 2,2 continua. Se o déficit ficar agressivo,
  rever o teto.

## Peso de referência: peso da balança limitado ao IMC 30

`referência = min(última pesagem, peso no IMC 30)`. Sem altura no perfil: a última pesagem. Sem pesagem:
`goals.peso_ref_kg`. Sem peso nenhum: sem faixa (nunca inventa um alvo).

**Por que não o peso cheio:** com sobrepeso, g/kg sobre o peso total superestima a necessidade, porque a
proteína acompanha a massa livre de gordura, que cresce bem menos que o peso. A revisão de Weijs (2025) recomenda
limitar o peso de referência ao IMC 30: a gordura acima desse ponto é ignorada.

**Por que não massa magra nem peso-alvo:**
- Não há medida de composição corporal (bioimpedância ou DEXA), e chutar um % de gordura troca um erro por outro.
- O peso-alvo é uma escolha, não uma medida; ele mudaria a meta toda vez que o objetivo mudasse.
- Se o Kaluan medir % de gordura no mesmo aparelho, dá para migrar para g/kg de massa magra.

**Kaluan em 11/11/2026:** última pesagem 92,5 kg (31/10), 175 cm → IMC 30,2 → referência **91,9 kg** (IMC 30).

| | g/kg | g/dia |
|---|---|---|
| mínimo efetivo | 1,3 | **119 g** |
| ideal (início) | 1,6 | **147 g** |
| teto útil | 2,2 | **202 g** |

Faixa ideal: **147–202 g/dia**; abaixo de 119 g é "abaixo do mínimo". A diferença para o peso cheio hoje é pequena
(92,5 kg daria 120 / 148 / 204 g). O limite pesa mais se o peso subir. A faixa se move sozinha com cada pesagem nova.

Carbo e gordura seguem o mesmo modelo de zonas, pela permissão do dia: `docs/macros.md`.

## Onde mudar

Colunas em `goals` (alterar só com confirmação do Kaluan e registrar `fit note decisao`):
`protein_min_g_per_kg` (1,3), `protein_ideal_g_per_kg` (1,6), `protein_cap_g_per_kg` (2,2), `protein_ref_bmi_max`
(30; `NULL` = sempre o peso da balança). As colunas antigas (`protein_g_per_kg_min/max`, `protein_g_min/max` e
`v_nutrition_targets.protein_min_g/max_g`) continuam no banco, mas o app e os resumos não as leem mais.

Enquanto a migração não estiver aplicada no banco, o app calcula a mesma regra no cliente
(`proteinTargetFrom` em `web/src/lib/protein.ts`, testado contra os mesmos casos de `scripts/verify_local.sh`).

## Fontes

- Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of
  protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults.
  *Br J Sports Med* 2018;52:376–384. <https://doi.org/10.1136/bjsports-2017-097608>
- Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and
  exercise. *J Int Soc Sports Nutr* 2017;14:20. <https://doi.org/10.1186/s12970-017-0177-8>
- Weijs PJM. Protein requirement in obesity. *Curr Opin Clin Nutr Metab Care* 2025;28:27–32.
  <https://doi.org/10.1097/MCO.0000000000001087>
- Kokura Y, Ueshima J, Saino Y, Maeda K. Enhanced protein intake on maintaining muscle mass, strength, and physical
  function in adults with overweight/obesity: a systematic review and meta-analysis. *Clin Nutr ESPEN*
  2024;63:417–426. <https://doi.org/10.1016/j.clnesp.2024.06.030>
