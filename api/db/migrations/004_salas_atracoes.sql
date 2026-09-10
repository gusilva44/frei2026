-- Substitui os setores (turmas de curso) pelas salas/atrações reais do evento,
-- extraídas do hotsite de produção (seção "Local de Atrações"):
-- Área Externa (2), Pátio (20), 1º Andar (4), 2º Andar (4) e 3º Andar (4).
-- O Leitor QR passa a selecionar a sala em que o visitante foi registrado e o
-- dashboard agrega pessoas por sala e por andar.

ALTER TABLE setores
  MODIFY COLUMN nome VARCHAR(150) NOT NULL;

ALTER TABLE setores
  ADD COLUMN local VARCHAR(60) NULL AFTER nome;

-- Remove presenças e setores antigos (turmas de curso). Em desenvolvimento o banco
-- ainda não tem dados do evento; se houver presenças referenciando, elas são apagadas.
DELETE FROM presencas
WHERE setor_id IN ('informatica', 'comunicacao', 'ingles', 'administracao', 'mecanica');

DELETE FROM setores
WHERE id IN ('informatica', 'comunicacao', 'ingles', 'administracao', 'mecanica');

INSERT INTO setores (id, nome, local, andar, cor, ordem) VALUES
  -- Área Externa (2)
  ('areaexterna-horta-facil',        'Horta Fácil (SMDET)',                       'Lanchonete', 'Área Externa', '#4a7c59', 1),
  ('areaexterna-rga',                'Registro Geral de Animais (RGA)',           'Saída',      'Área Externa', '#4a7c59', 2),

  -- Pátio (20)
  ('patio-sebo-troca-livros',        'SEBO e Troca de livros',                    'Stand',      'Pátio', '#17356f', 3),
  ('patio-livros-frei-xavier',       'Exposição e venda dos livros do Frei Xavier', 'Stand',    'Pátio', '#17356f', 4),
  ('patio-alimentacao',              'Alimentação: Delícias da Padaria do Frei e bebidas', 'Stand', 'Pátio', '#17356f', 5),
  ('patio-mesa-cursos',              'Mesa de cursos: informações e inscrições 2027', 'Stand',   'Pátio', '#17356f', 6),
  ('patio-oficina-mecanica',         'Oficina de Mecânica de Autos',              'Stand',      'Pátio', '#17356f', 7),
  ('patio-oficina-auto-eletrica',    'Oficina de Auto Elétrica de Autos',         'Stand',      'Pátio', '#17356f', 8),
  ('patio-oficina-automacao',        'Oficina de Automação Residencial e Robótica', 'Stand',   'Pátio', '#17356f', 9),
  ('patio-aps-solucoes',             'APS Soluções – Energia que nos move',       'Stand',      'Pátio', '#17356f', 10),
  ('patio-fios-berenice',            'Casa da Mulher Paulistana – Fios de Berenice', 'Stand',   'Pátio', '#17356f', 11),
  ('patio-conexao-bem-maior',        'Conexão Bem Maior – patrocinadores e parceiras', 'Stand', 'Pátio', '#17356f', 12),
  ('patio-stb-intercambio',          'STB Intercâmbio – programas de intercâmbio', 'Stand',   'Pátio', '#17356f', 13),
  ('patio-sao-paulo-open-centre',    'São Paulo Open Centre – cursos e provas Cambridge', 'Stand', 'Pátio', '#17356f', 14),
  ('patio-trancas',                  'Tranças – alunos e voluntários',            'Stand',      'Pátio', '#17356f', 15),
  ('patio-caricatura',               'Caricatura – alunos de Comunicação Visual', 'Stand',      'Pátio', '#17356f', 16),
  ('patio-g3-kids-pintura',          'G3 Kids – Pintura facial artística',        'Stand',      'Pátio', '#17356f', 17),
  ('patio-mary-kay',                 'Mary Kay – dicas e cuidados de beleza',     'Stand',      'Pátio', '#17356f', 18),
  ('patio-oficina-linkedin',         'Oficina de LinkedIn – vitrine profissional', 'Laboratório', 'Pátio', '#17356f', 19),
  ('patio-oticas-carol',             'Óticas Carol Veleiros – exame de vista gratuito', 'Sala 4', 'Pátio', '#17356f', 20),
  ('patio-caixa',                    'Caixa',                                      'Sala 5',     'Pátio', '#17356f', 21),
  ('patio-geat-escoteiros',          '46º GEAT – Grupo Escoteiro Almirante Tamandaré', 'Sala 6', 'Pátio', '#17356f', 22),

  -- 1º Andar (4)
  ('andar1-sala17-ubs',              'UBS – vacinação, pressão e glicemia',        'Sala 17', '1º Andar', '#2a4d94', 23),
  ('andar1-sala18-adm-empreendedorismo', 'Administração – empreendedorismo e logística', 'Sala 18', '1º Andar', '#2a4d94', 24),
  ('andar1-sala19-adm-rh-contabilidade', 'Administração – RH e contabilidade',    'Sala 19', '1º Andar', '#2a4d94', 25),
  ('andar1-sala20-ingles',           'Inglês – etapas dos cursos e conversação',   'Sala 20', '1º Andar', '#2a4d94', 26),

  -- 2º Andar (4)
  ('andar2-sala24-comunicacao-visual', 'Comunicação Visual – CorelDRAW, Photoshop e Fotografia', 'Sala 24', '2º Andar', '#0f2550', 27),
  ('andar2-sala25-info-hardware',    'Informática – hardware, redes e cibersegurança', 'Sala 25', '2º Andar', '#0f2550', 28),
  ('andar2-sala26-info-programacao', 'Informática – programação',                  'Sala 26', '2º Andar', '#0f2550', 29),
  ('andar2-sala27-curriculos-mapfre', 'Elaboração de currículos – voluntários MAPFRE', 'Sala 27', '2º Andar', '#0f2550', 30),

  -- 3º Andar (4)
  ('andar3-auditorio-entrevista',    'Simulação de entrevista de emprego – MAPFRE e BISCOITÊ', 'Auditório', '3º Andar', '#c39a1e', 31),
  ('andar3-auditorio-cate',          'CATE – carteira de trabalho e vagas de emprego', 'Auditório', '3º Andar', '#c39a1e', 32),
  ('andar3-auditorio-ade-sampa',     'ADE SAMPA – micro e pequenos empresários',  'Auditório', '3º Andar', '#c39a1e', 33),
  ('andar3-auditorio-ademicon',      'ADEMICON – educação financeira',             'Auditório', '3º Andar', '#c39a1e', 34)
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  local = VALUES(local),
  andar = VALUES(andar),
  cor = VALUES(cor),
  ordem = VALUES(ordem);