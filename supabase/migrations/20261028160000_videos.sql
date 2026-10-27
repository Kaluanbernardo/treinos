-- Vídeos de execução (pt-BR) por exercício: 1 link do YouTube cada, conferido pelo oEmbed
-- (https://www.youtube.com/oembed?url=...&format=json → HTTP 200) em 27/10/2026.
-- Curadoria do assistente; o Kaluan pode pedir troca pelo chat. Checagem mensal de links quebrados (docs/assistente.md).
update public.exercises e set video_url = v.url, source = 'bot'
from (values
  -- Miqueias Alves Personal: SUPINO RETO COM BARRA - APRENDA COMO FAZR CORRETAMENTE
  ('supino_reto', 'https://www.youtube.com/watch?v=vIGvt-vgrvY'),
  -- Guilherme Stellbrink I FisioPrev: COMO FAZER PUXADA ALTA OU FRENTE (pulley frente) - Fisioprev
  ('puxada_frontal', 'https://www.youtube.com/watch?v=7cCiQUdIXWw'),
  -- Laércio Refundini - Aulas: Como fazer o Desenvolvimento com Halteres (Aprenda em 1 Minuto)
  ('desenvolvimento_halteres', 'https://www.youtube.com/watch?v=eufDL9MmF8A'),
  -- Miqueias Alves Personal: REMADA CURVADA COM BARRA - APRENDA COMO FAZER CORRETAMENTE
  ('remada_curvada', 'https://www.youtube.com/watch?v=s4jeKLRghTM'),
  -- Thiago Gallina | Treinador: Como fazer a elevação lateral com halteres
  ('elevacao_lateral', 'https://www.youtube.com/watch?v=gURBTU9VSJg'),
  -- Treino Mestre: Tríceps na polia alta com corda: Execução e postura correta
  ('triceps_corda', 'https://www.youtube.com/watch?v=7le1JRUUagM'),
  -- Cesão BigC | Tudo sobre TAF: Como fazer A BARRA FIXA PERFEITA em 4 passos!
  ('barra_fixa', 'https://www.youtube.com/watch?v=JSZ14mZY5Mo'),
  -- Treino Mestre: Supino inclinado com halteres: Execução correta e músculos solicitados
  ('supino_inclinado_halteres', 'https://www.youtube.com/watch?v=G-i3jMIbDmo'),
  -- Miqueias Alves Personal: REMADA UNILATERAL COM HALTERES - APRENDA COMO FAZER CORRETAMENTE
  ('remada_unilateral', 'https://www.youtube.com/watch?v=gDT81YBrh3k'),
  -- Matheus Choque: Face Pull Corda na Polia
  ('face_pull', 'https://www.youtube.com/watch?v=YxQivR_kljk'),
  -- Miqueias Alves Personal: ROSCA DIRETA COM BARRA - COMO FAZER CORRETAMENTE
  ('rosca_direta', 'https://www.youtube.com/watch?v=Et1wgGMGW8w'),
  -- Fábrica de Monstros: PENDURAR NA BARRA FUNCIONA? Veja os benefícios e como fazer do jeito CERTO! | Mu
  ('pendurar_barra', 'https://www.youtube.com/watch?v=RNZEGcwmxdo'),
  -- Treino Mestre: Agachamento livre com barra - Como fazer corretamente
  ('agachamento_livre', 'https://www.youtube.com/watch?v=rM6SDUdl9fs'),
  -- Laércio Refundini - Aulas: Como Fazer o Leg Press 45º
  ('leg_press_45', 'https://www.youtube.com/watch?v=FeZ8D00iK5E'),
  -- Treino Mestre: Agachamento Búlgaro: Como fazer,  Dicas e Cuidados
  ('afundo_bulgaro', 'https://www.youtube.com/watch?v=a3-bQbTdA_0'),
  -- Dan Champions: Cadeira Extensora - Série Execução Perfeita
  ('cadeira_extensora', 'https://www.youtube.com/watch?v=--p0Ff7R-Io'),
  -- Treino Mestre: Mesa Flexora - Como fazer corretamente e otimizar os resultados!
  ('mesa_flexora', 'https://www.youtube.com/watch?v=8Nat6GRiEoc'),
  -- FISIculturismo.com.br: Panturrilha em pé na máquina
  ('panturrilha_em_pe', 'https://www.youtube.com/watch?v=qWHH0We_9r0'),
  -- Miqueias Alves Personal: LEVANTAMENTO TERRA ROMENO - COMO FAZER?
  ('terra_romeno', 'https://www.youtube.com/watch?v=jSomWOwLiGE'),
  -- SAÚDE É TREINO com Renato Reche: Como fazer Elevação Pélvica no Banco com a Barra
  ('hip_thrust', 'https://www.youtube.com/watch?v=vvIc6wdDyTc'),
  -- FISIculturismo.com.br: Cadeira Flexora
  ('flexora', 'https://www.youtube.com/watch?v=zX5saGYPgzw'),
  -- Guilherme Stellbrink I FisioPrev: COMO FAZER AGACHAMENTO GOBLET (Agachamento frontal) - Fisioprev
  ('goblet_ou_hack', 'https://www.youtube.com/watch?v=ge1vdJRP0UA'),
  -- Roberto Virgili Personal: Panturrilha Sentado Máquina
  ('panturrilha_sentado', 'https://www.youtube.com/watch?v=UqsUaoE3SSs'),
  -- CT Powerfit: Exercício Farmer Walk, como fazer e qual benefício?
  ('farmers_walk', 'https://www.youtube.com/watch?v=VZ-E-YYbYEg'),
  -- KSILVABJJ: Engrosse o pescoço com estes 5 exercícios!
  ('pescoco_anilha', 'https://www.youtube.com/watch?v=cBrlW_oji5k')
) as v(slug, url)
where e.slug = v.slug;
