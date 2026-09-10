# Arquitetura da API — Feira Frei 2026

> API HTTP standalone em **Node.js + Express (ESM)** que substitui as rotas internas
> `src/server/apiFeira.ts` do projeto `web`, adicionando autenticação por **JWT**,
> **rate limiting** e separação em camadas **controller → service → repository**,
> sobre **MySQL**. Consumida pelo hotsite (`/`, endpoints públicos) e pelas áreas
> restritas `/admin` e `/credenciamento` (endpoints autenticados).

## 1. Visão geral

O projeto `web` hoje resolve tudo (SSR + API + autenticação Basic) em um único worker
(`src/server.ts` + `src/server/apiFeira.ts`). Esta API extrai a persistência e as regras
de negócio para um serviço próprio, permitindo:

- Escalar/deployar a API separadamente do front-end.
- Trocar autenticação Basic (credencial única compartilhada) por **login com usuário e
  senha por pessoa/papel**, emitindo **JWT**.
- Aplicar **rate limiting** diferenciado por tipo de rota (pública vs. autenticada,
  login vs. leitura).
- Persistir corretamente o campo `participaComoColaborador`, hoje presente no formulário
  e no dashboard do front-end (`Formulario.jsx`, `Credenciamento.jsx`, `Dashboard.jsx`)
  mas **nunca gravado no banco** pela API atual (`src/server/apiFeira.ts` não o inclui em
  `CAMPOS_EDITAVEIS` nem `validarVisitante`, e a tabela `visitantes` do
  `database/001_feira2026.sql` não tem essa coluna) — gap identificado ao ler o projeto
  `web` para esta modelagem.

O front-end `web` passa a consumir esta API via HTTP (substituindo `src/services/apiFeira.js`
por chamadas a esta API, e `sessionStorage` de Basic Auth por armazenamento do JWT).

## 2. Stack tecnológica

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 20+, módulos **ESM** nativos (`"type": "module"`) |
| Framework HTTP | Express 4/5 |
| Banco de dados | MySQL 8, via `mysql2/promise` (pool de conexões) |
| Autenticação | JWT (`jsonwebtoken`) — access token + refresh token |
| Hash de senha | `bcrypt` (ou `argon2`) |
| Validação de entrada | `zod` (schemas por rota, reaproveitáveis entre controller e service) |
| Rate limiting | `express-rate-limit` (+ `rate-limit-redis` opcional em produção com múltiplas instâncias) |
| Segurança HTTP | `helmet`, `cors` (allowlist do domínio do hotsite), `express-mongo-sanitize`-like sanitização manual de entrada |
| Logs | `pino` + `pino-http` (logs estruturados, correlação por request id) |
| Variáveis de ambiente | `dotenv` (apenas em desenvolvimento) |
| Testes | `vitest` ou `node:test` + `supertest` |
| Lint/format | ESLint + Prettier (mesmo padrão do projeto `web`) |
| Migrations | `node-pg-migrate`-like custom runner **ou** arquivos SQL numerados em `db/migrations` aplicados via script próprio (segue o padrão já usado em `database/001_feira2026.sql`) |

## 3. Estrutura de pastas

```text
api/
├── src/
│   ├── app.js                  Monta o Express app (middlewares globais + rotas), sem dar listen
│   ├── server.js                Ponto de entrada: cria o app e chama app.listen()
│   ├── config/
│   │   ├── env.js                Leitura e validação (zod) das variáveis de ambiente
│   │   └── database.js           Pool mysql2/promise, configuração de conexão
│   ├── routes/
│   │   ├── index.js              Agrega e monta todas as sub-rotas em /api
│   │   ├── auth.routes.js        POST /login, /refresh, /logout
│   │   ├── visitantes.routes.js  Rotas públicas e autenticadas de visitantes
│   │   ├── presencas.routes.js   Rotas de presença (leitor QR)
│   │   ├── dashboard.routes.js   Rotas agregadas para o painel admin
│   │   └── setores.routes.js     Lista pública de setores/atrações
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── visitantes.controller.js
│   │   ├── presencas.controller.js
│   │   ├── dashboard.controller.js
│   │   └── setores.controller.js
│   ├── services/
│   │   ├── auth.service.js       Login, emissão/rotação de tokens, hashing
│   │   ├── visitantes.service.js Regras de negócio: validação de CPF, geração de código QR, etc.
│   │   ├── presencas.service.js  Regra "uma presença por setor", tradução de status
│   │   └── dashboard.service.js  Agregações (contagens, rankings) sobre repositories
│   ├── repositories/
│   │   ├── administradores.repository.js
│   │   ├── refreshTokens.repository.js
│   │   ├── visitantes.repository.js
│   │   ├── presencas.repository.js
│   │   └── setores.repository.js
│   ├── middlewares/
│   │   ├── authenticate.js       Verifica e decodifica o JWT (Authorization: Bearer)
│   │   ├── authorize.js          Checa papel (admin | credenciamento | leitor) exigido pela rota
│   │   ├── rateLimiters.js       Instâncias de rate limit por tipo de rota
│   │   ├── validate.js           Middleware genérico: valida body/params/query com um schema zod
│   │   ├── errorHandler.js       Handler central de erros (formata resposta JSON de erro)
│   │   └── requestLogger.js      pino-http
│   ├── schemas/                  Schemas zod reaproveitados por validate() e pelos services
│   │   ├── auth.schema.js
│   │   ├── visitante.schema.js
│   │   └── presenca.schema.js
│   ├── errors/
│   │   └── AppError.js           Classe de erro de domínio (statusCode, código, mensagem)
│   └── utils/
│       ├── asyncHandler.js       Evita try/catch repetido nos controllers
│       ├── cpf.js                Validação de dígito verificador (portado de apiFeira.ts)
│       └── qrCode.js             Geração de código único + SVG (biblioteca `qrcode`)
├── db/
│   ├── migrations/               Arquivos SQL numerados (001_..., 002_...)
│   └── seeds/                    Seed de setores e do primeiro administrador
├── test/
│   ├── unit/                     Testes de service/repository com mocks
│   └── integration/              Testes de rota com supertest + banco de teste
├── .env.example
├── package.json                  "type": "module"
└── README.md
```

## 4. Fluxo de uma requisição (padrão em camadas)

```text
Cliente (web)
   │  HTTP + Authorization: Bearer <access_token>
   ▼
routes/*.routes.js        define o caminho e encadeia os middlewares
   │
   ▼
middlewares (nessa ordem):
  requestLogger → rateLimiter → authenticate → authorize → validate(schema)
   │
   ▼
controllers/*.controller.js
   - lê req.body/params/query já validados
   - chama exatamente 1 método do service
   - traduz o retorno do service em status HTTP + JSON
   - nunca acessa o banco nem contém regra de negócio
   │
   ▼
services/*.service.js
   - regra de negócio (validação de CPF, geração de código QR, checagem de duplicidade,
     tradução de status "registrado"/"repetido"/"desconhecido")
   - orquestra 1+ repositories
   - lança AppError para erros de negócio (ex.: "CPF já cadastrado")
   │
   ▼
repositories/*.repository.js
   - única camada que escreve SQL
   - recebe/devolve dados já no formato "de banco" (snake_case)
   - não conhece HTTP, não lança AppError (erros de driver sobem para o service tratar)
   │
   ▼
config/database.js → pool mysql2 → MySQL
```

Controllers nunca chamam repositories diretamente, e services nunca leem `req`/`res` —
isso mantém a lógica de negócio testável sem subir um servidor HTTP.

## 5. Segurança

### 5.1 Autenticação (JWT)

- Substitui o Basic Auth de credencial única do projeto `web` por uma tabela de
  **administradores** (ver seção 6), permitindo múltiplas contas e papéis.
- `POST /api/auth/login` recebe `email` + `senha`, valida contra o hash (`bcrypt.compare`)
  e devolve:
  - **access token** (JWT, 15 min de validade) — enviado em `Authorization: Bearer` em
    toda chamada autenticada; payload contém `sub` (id do administrador), `papel`
    (`admin` | `credenciamento`) e `jti`.
  - **refresh token** (JWT opaco/aleatório, 7 dias) — guardado **hasheado** em
    `refresh_tokens` (nunca em texto puro no banco), devolvido ao cliente para uso em
    `POST /api/auth/refresh`.
- `POST /api/auth/refresh` valida o refresh token contra o hash salvo, emite um novo par
  de tokens e **revoga o anterior** (rotação), mitigando reuso de token roubado.
- `POST /api/auth/logout` revoga o refresh token atual (marca `revogado_em`).
- Middleware `authenticate`: extrai o Bearer token, verifica assinatura/expiração
  (`jsonwebtoken.verify`) e popula `req.usuario = { id, papel }`.
- Middleware `authorize(...papeis)`: retorna 403 se `req.usuario.papel` não estiver na
  lista de papéis permitidos pela rota.
- Segredos (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) apenas em variáveis de ambiente,
  nunca no código — mesma prática já usada pelo projeto `web` para as credenciais.

### 5.2 Rate limiting

Limites diferenciados por sensibilidade da rota (`middlewares/rateLimiters.js`):

| Limitador | Aplicado em | Regra sugerida |
| --- | --- | --- |
| `loginLimiter` | `POST /api/auth/login` | 5 tentativas / 15 min por IP (evita força bruta) |
| `publicWriteLimiter` | `POST /api/visitantes` (inscrição pública) | 10 requisições / 10 min por IP (evita spam de inscrições) |
| `publicReadLimiter` | `GET /api/setores` e demais rotas públicas de leitura | 60 requisições / min por IP |
| `authenticatedLimiter` | Todas as rotas sob `authenticate` | 300 requisições / min por usuário autenticado (folga alta: leitor de QR faz polling durante o evento) |

Em produção com mais de uma instância, o `store` do `express-rate-limit` deve apontar
para Redis (`rate-limit-redis`) em vez do padrão em memória, para os limites valerem
entre instâncias.

### 5.3 Outras camadas de defesa

- **Validação de entrada** com `zod` em todo body/params/query antes de chegar ao
  controller — reaproveita as mesmas regras hoje embutidas em `apiFeira.ts`
  (nome 3–100 caracteres, e-mail via regex, CPF com dígito verificador, telefone
  10–11 dígitos, código QR 1–120 caracteres).
- **Prepared statements** (`mysql2` com `?` bind) em 100% das queries — nunca
  concatenar valor de usuário em SQL.
- **Helmet** para cabeçalhos HTTP seguros e **CORS** restrito ao(s) domínio(s) do
  hotsite (`ALLOWED_ORIGINS`), sem `*` em produção.
- **bcrypt** (custo ≥ 12) para senha de administrador; nunca logar senha nem token.
- Erros de banco/infra nunca vazam detalhe interno ao cliente (mensagem genérica +
  log completo no servidor) — mesmo princípio de `mensagemErroBanco` em `apiFeira.ts`.
- `POST /api/visitantes` (pública) **nunca** aceita `id` nem `codigoQr` do cliente — a
  API sempre gera ambos no servidor, como já faz `apiFeira.ts`.

## 6. Modelagem do banco de dados

Evolui as duas tabelas existentes (`database/001_feira2026.sql`) e adiciona as tabelas
necessárias para login com JWT e para não regredir o campo `participaComoColaborador`
já usado pelo front-end.

```mermaid
erDiagram
    ADMINISTRADORES ||--o{ REFRESH_TOKENS : possui
    SETORES ||--o{ PRESENCAS : recebe
    VISITANTES ||--o{ PRESENCAS : registra

    ADMINISTRADORES {
        char36 id PK
        varchar120 nome
        varchar190 email UK
        varchar100 senha_hash
        enum papel "admin | credenciamento | leitor"
        boolean ativo
        datetime criado_em
        datetime atualizado_em
    }

    REFRESH_TOKENS {
        char36 id PK
        char36 administrador_id FK
        varchar255 token_hash
        datetime expira_em
        datetime revogado_em "nulo enquanto válido"
        datetime criado_em
    }

    SETORES {
        varchar40 id PK "slug: informatica, mecanica..."
        varchar80 nome
        varchar40 andar
        varchar10 cor
        int ordem
    }

    VISITANTES {
        char36 id PK
        varchar100 nome
        varchar255 email
        varchar14 cpf UK
        varchar20 telefone
        enum vinculo "Aluno atual | Ex-aluno | Nunca estudei"
        varchar100 como_soube
        enum genero "Masculino | Feminino | Outro"
        varchar150 curso_interesse
        boolean participa_como_colaborador
        varchar120 codigo_qr UK
        text qr_code_svg "nulo"
        datetime criado_em
        datetime atualizado_em
    }

    PRESENCAS {
        char36 id PK
        char36 visitante_id FK
        varchar40 setor_id FK
        varchar120 codigo_qr
        datetime registrado_em
    }
```

### 6.1 `administradores`

Substitui a credencial única `RESTRICTED_AREA_USERNAME`/`RESTRICTED_AREA_PASSWORD` do
projeto `web`. Três papéis, cada um restrito à sua própria fatia de funcionalidade —
só `admin` acumula acesso total:

- **`admin`** — acesso total: dashboard, tudo de `credenciamento` e tudo de `leitor`.
- **`credenciamento`** — lista, cadastra, edita, exclui (não — exclusão é só `admin`) e
  faz check-in de visitantes. Sem acesso a `/presencas` (POST) nem a `/dashboard/*`.
- **`leitor`** — só registra presença via QR Code (`POST /presencas`) e lê a lista de
  presenças para mostrar contadores. Sem acesso à lista de visitantes nem ao dashboard.

```sql
CREATE TABLE IF NOT EXISTS administradores (
  id CHAR(36) PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  senha_hash VARCHAR(100) NOT NULL,
  papel ENUM('admin', 'credenciamento', 'leitor') NOT NULL DEFAULT 'credenciamento',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL
);
```

### 6.2 `refresh_tokens`

Permite revogar sessões individualmente (logout, rotação, comprometimento de token) sem
depender apenas da expiração natural do JWT.

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  administrador_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expira_em DATETIME NOT NULL,
  revogado_em DATETIME NULL,
  criado_em DATETIME NOT NULL,
  FOREIGN KEY (administrador_id) REFERENCES administradores(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_admin ON refresh_tokens(administrador_id);
```

### 6.3 `setores`

Normaliza a lista hoje fixa em `web/src/data/setores.js` (5 turmas/atrações), dando
integridade referencial a `presencas.setor_id` (a tabela original usava texto livre).
Seed inicial replica os dados atuais:

```sql
CREATE TABLE IF NOT EXISTS setores (
  id VARCHAR(40) PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  andar VARCHAR(40) NOT NULL,
  cor VARCHAR(10) NOT NULL,
  ordem INT NOT NULL DEFAULT 0
);

INSERT INTO setores (id, nome, andar, cor, ordem) VALUES
  ('informatica',   'Informática',        '1º Andar', '#17356f', 1),
  ('comunicacao',   'Comunicação Visual', '3º Andar', '#2a4d94', 2),
  ('ingles',        'Inglês',             '2º Andar', '#0f2550', 3),
  ('administracao', 'Administração',      '2º Andar', '#f5c435', 4),
  ('mecanica',      'Mecânica',           'Pátio',    '#e0ad19', 5)
ON DUPLICATE KEY UPDATE nome = VALUES(nome);
```

### 6.4 `visitantes`

Mesma base da tabela original, com `participa_como_colaborador` adicionado (gap
encontrado no front-end) e `vinculo`/`genero` convertidos para `ENUM` (o restante segue
texto livre por serem catálogos maiores/abertos: curso de interesse e canal de
divulgação).

```sql
CREATE TABLE IF NOT EXISTS visitantes (
  id CHAR(36) PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  telefone VARCHAR(20) NOT NULL,
  vinculo ENUM('Aluno atual', 'Ex-aluno', 'Nunca estudei') NOT NULL,
  como_soube VARCHAR(100) NOT NULL,
  genero ENUM('Masculino', 'Feminino', 'Outro') NOT NULL,
  curso_interesse VARCHAR(150) NOT NULL,
  participa_como_colaborador BOOLEAN NOT NULL DEFAULT FALSE,
  codigo_qr VARCHAR(120) NOT NULL UNIQUE,
  qr_code_svg TEXT NULL,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL
);

CREATE INDEX idx_visitantes_codigo_qr ON visitantes(codigo_qr);
```

> Nota: `cpf`/`telefone` continuam guardados só com dígitos (como a API atual já faz em
> `normalizarCpf`/`normalizarTelefone`) — a máscara é responsabilidade do front-end.

### 6.5 `presencas`

Mesma regra da tabela original (uma presença por visitante por setor), agora com FK para
`setores` em vez de texto livre:

```sql
CREATE TABLE IF NOT EXISTS presencas (
  id CHAR(36) PRIMARY KEY,
  visitante_id CHAR(36) NOT NULL,
  setor_id VARCHAR(40) NOT NULL,
  codigo_qr VARCHAR(120) NOT NULL,
  registrado_em DATETIME NOT NULL,
  FOREIGN KEY (visitante_id) REFERENCES visitantes(id) ON DELETE CASCADE,
  FOREIGN KEY (setor_id) REFERENCES setores(id),
  UNIQUE (visitante_id, setor_id)
);

CREATE INDEX idx_presencas_visitante ON presencas(visitante_id);
CREATE INDEX idx_presencas_setor ON presencas(setor_id);
```

## 7. Endpoints

Prefixo base: `/api`. Coluna **Auth** indica o papel mínimo exigido
(`—` = público, com rate limit de leitura/escrita pública).

| Método | Rota | Auth | Rate limit | Descrição |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | — | `loginLimiter` | Login de administrador/equipe; devolve access + refresh token |
| POST | `/auth/refresh` | — (refresh token no corpo) | `loginLimiter` | Rotaciona o par de tokens |
| POST | `/auth/logout` | admin, credenciamento, leitor | `authenticatedLimiter` | Revoga o refresh token atual |
| GET | `/setores` | — | `publicReadLimiter` | Lista setores/atrações (preenche formulário e filtros) |
| POST | `/visitantes` | — | `publicWriteLimiter` | Inscrição pública (hotsite) ou credenciamento no local — a única escrita que o visitante faz sozinho, por isso fica fora do JWT |
| GET | `/visitantes` | admin, credenciamento | `authenticatedLimiter` | Lista visitantes (paginação + busca por nome/e-mail/CPF/telefone/curso/código QR) |
| GET | `/visitantes/:id` | admin, credenciamento | `authenticatedLimiter` | Detalhe de um visitante |
| PATCH | `/visitantes/:id` | admin, credenciamento | `authenticatedLimiter` | Edita campos cadastrais |
| DELETE | `/visitantes/:id` | admin | `authenticatedLimiter` | Remove visitante (cascata remove presenças) |
| PATCH | `/visitantes/:id/checkin` | admin, credenciamento | `authenticatedLimiter` | Vincula o código do QR Code (originado fora do sistema) ao visitante e grava `data_chegada` |
| POST | `/presencas` | admin, leitor | `authenticatedLimiter` | Registra presença a partir do código QR lido + setor |
| GET | `/presencas` | admin, credenciamento, leitor | `authenticatedLimiter` | Lista presenças (alimenta os contadores do hub, credenciamento e leitor) |
| GET | `/dashboard/resumo` | admin | `authenticatedLimiter` | KPIs agregados (inscritos, presenças, comparecimento, colaboradores) |
| GET | `/dashboard/setores` | admin | `authenticatedLimiter` | Presença por setor, com breakdown por gênero/vínculo |
| GET | `/dashboard/rankings` | admin | `authenticatedLimiter` | Cursos mais procurados e canais de divulgação mais eficazes |

Cada papel só recebe autorização nas rotas que sua própria página usa — reflexo direto
de `web/src/pages/admin/*`:

- `GET /visitantes` fica restrito a `admin`/`credenciamento` porque só a página
  `admin/Credenciamento.jsx` lista/busca/edita visitantes; `leitor` nunca precisa da
  lista completa (só lê um QR Code por vez) e por isso não tem essa permissão.
- `POST /presencas` fica restrito a `admin`/`leitor` porque é a função central da
  página `admin/Leitor.jsx`; `credenciamento` não acessa mais essa página (cada papel
  não-admin vê só o cartão da própria função no hub `/admin`), então perdeu essa rota.
- `GET /presencas` aceita os três papéis porque cada página (hub, credenciamento,
  leitor) mostra um contador de presenças registradas.
- `/dashboard/*` fica restrito a `admin` porque só `admin/Dashboard.jsx` existe para
  esse papel — nem `credenciamento` nem `leitor` têm o cartão Dashboard no hub.

## 8. Formato de resposta e erros

Sucesso:

```json
{ "dados": { "...": "..." } }
```

Listagens paginadas:

```json
{ "dados": [ "..." ], "paginacao": { "pagina": 1, "porPagina": 20, "total": 134 } }
```

Erro (formato único, produzido por `errorHandler` a partir de `AppError` ou de exceção
não tratada):

```json
{ "erro": { "codigo": "CPF_INVALIDO", "mensagem": "CPF inválido." } }
```

- `AppError` carrega `statusCode`, `codigo` (string estável para o front tratar por
  código, não por texto) e `mensagem` (exibível ao usuário).
- Exceções não previstas (erro de driver MySQL, bug) caem no handler genérico: log
  completo no servidor (`pino`, nível `error`, com `request-id`) e resposta `500` com
  mensagem genérica — nunca stack trace ou SQL para o cliente.

## 9. Variáveis de ambiente

```env
# Servidor
PORT=5050
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,https://feira.acaonsfatima.org.br

# MySQL
DATABASE_URL=mysql://usuario:senha@localhost:3306/feira_frei_2026

# JWT
JWT_ACCESS_SECRET=troque-por-um-segredo-forte
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=outro-segredo-forte-diferente
JWT_REFRESH_EXPIRES_IN=7d

# Rate limit (opcional, produção multi-instância)
REDIS_URL=redis://localhost:6379
```

`config/env.js` valida essas variáveis com `zod` na subida do processo — falha rápido
(`process.exit(1)`) com mensagem clara se algo obrigatório estiver ausente, em vez de
falhar silenciosamente na primeira requisição.

## 10. Scripts (`package.json`)

| Script | Descrição |
| --- | --- |
| `dev` | `node --watch src/server.js` |
| `start` | `node src/server.js` |
| `migrate` | Aplica migrations pendentes em `db/migrations` |
| `seed` | Popula `setores` e cria o primeiro `administrador` (a partir de env) |
| `test` | Testes unitários (services/repositories com mock) |
| `test:integration` | Sobe um banco de teste e roda supertest contra as rotas |
| `lint` / `format` | ESLint / Prettier, mesmo padrão do projeto `web` |

## 11. Relação com o projeto `web`

- Esta API é a substituta direta de `web/src/server/apiFeira.ts` +
  `web/src/server/mysql.ts`: mesma tabela `visitantes`/`presencas` (agora completas),
  mesmas regras de validação, mesmo contrato de status de presença
  (`registrado` | `repetido` | `desconhecido`).
- No `web`, `src/services/apiFeira.js` passa a apontar para esta API (`VITE_API_URL` ou
  equivalente) em vez de `/api/feira`, e `sessionStorage["feira2026-autorizacao"]`
  (Base64 de usuário:senha) é substituído pelo par de tokens JWT.
- `AreaRestrita`/`Acesso.jsx` (tela de login de `/admin` e `/credenciamento`) passa a
  chamar `POST /auth/login` desta API em vez de validar Basic Auth contra `server.ts`.
- O leitor de QR (`web/src/components/LeitorQr/LeitorQr.jsx`) e a impressão de crachás
  continuam 100% client-side (decodificação própria em `web/src/lib/qrcode`); a API só
  recebe o texto já decodificado em `POST /presencas`.
