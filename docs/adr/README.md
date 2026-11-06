# Decisões de arquitetura (ADRs): propostas da Fase 0

Todas estão com status **PROPOSTA** e aguardam aprovação. Formato: contexto, decisão, consequências.

---

## ADR-001: Monorepo com pnpm workspaces e Turborepo

**Contexto:** o site, o worker, a API, o app Android e o ProContador precisam da mesma verdade fiscal.
**Decisão:** monorepo com `apps/web`, `apps/worker`, `apps/mobile` (a partir da fase 5), `packages/motor-fiscal`, `packages/regras`, `packages/db`, `packages/ui` e `packages/sdk` (gerado). TypeScript strict com `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, sem `any`.
**Consequências:** um só PR altera a regra e todos os consumidores, e o cache do Turborepo mantém o CI rápido. A contrapartida é que o Expo exige configuração do Metro para os workspaces.

## ADR-002: Motor fiscal puro com aritmética decimal

**Decisão:** `motor-fiscal` sem I/O, usando `decimal.js` com precisão de 34 dígitos. O arredondamento é explícito e feito por item e por tributo (2 casas, ROUND_HALF_UP, a confirmar contra as Notas Técnicas da NF-e/RTC). A entrada é `{ operacao, dataFatoGerador, cenario, regras }`, e as regras chegam injetadas e já resolvidas para a data. A saída é `{ valores, memoria[] }`, em que cada passo da memória tem o id, a fórmula, as entradas, o resultado e a referência à regra (id, versão, fonte).
**Consequências:** o mesmo resultado sai em qualquer ambiente, inclusive offline no app. A meta de 100% de cobertura vale para este pacote, com testes de propriedade (fast-check) para os invariantes da seção 12.3.

## ADR-003: Regras como dados versionados no repositório

**Decisão:** as regras ficam em arquivos YAML em `packages/regras/dados/`, validados por Zod. Cada regra tem `id`, `tributo`, `vigencia{inicio,fim}`, `abrangencia{ncm,nbs,uf,regime,elo}`, `valor`, `fonte{norma,artigo,url}`, `status` e `conferencia`. O build gera um pacote versionado (semver mais hash do conteúdo), carregado no Postgres por migration de dados e assinado com Ed25519 para o app. Nada é editado direto no banco.
**Consequências:** toda mudança passa por PR com revisão e roda novamente a suíte. Cenários são conjuntos de sobrescritas nomeadas sobre a base, por exemplo `cbs-senado`, `mp-caducada` e `pec-ipi`.

## ADR-004: Supabase (Postgres, Auth, Storage) com multi-tenant por RLS

**Decisão:** `organization_id` em toda tabela de cliente, RLS com função `auth_org_ids()` e papel checado no servidor e no banco. Dois projetos (staging e produção) e migrations pela Supabase CLI. Testes de isolamento rodam em Postgres real no CI.
**Consequências:** o RLS funciona como segunda barreira. A API usa o service role apenas no servidor e sempre filtra por organização do token.

## ADR-005: Next.js no `apps/web` servindo site e API

**Decisão:** App Router, com páginas públicas em SSR/SSG e a API `/v1` em route handlers do próprio web. O contrato é escrito em Zod e vira OpenAPI 3.1 com `zod-openapi`. A tela consome a mesma API (ou a mesma camada de serviço) que o integrador.
**Alternativa descartada:** um serviço de API separado (Fastify), que traria mais um deploy sem ganho na Onda 1. A troca continua possível se a carga exigir.

## ADR-006: Fila com pg-boss e worker separado

**Decisão:** pg-boss sobre o mesmo Postgres. Jobs de lote, importação de XML, oráculo da Receita, webhooks e o verificador de fontes. A chave de singleton por organização evita execução duplicada.
**Consequências:** sem Redis. Se a fila crescer muito, migramos para um serviço dedicado.

## ADR-007: API pública, idempotência e webhooks

**Decisão:** tokens de serviço opacos (prefixo `pf_live_` / `pf_test_`), guardados como hash argon2id, com escopos e rotação por sobreposição. Tabela `idempotency_keys` (organização, chave, hash do corpo, resposta) com retenção de 24 h. Erros em `application/problem+json`. Rate limit por token em Postgres (janela deslizante) na Onda 1, com troca para Redis se for preciso. Webhooks assinados com HMAC-SHA256 sobre `timestamp.corpo`, retentativa exponencial e tabela de entregas.

**Revisão (06/11/2026, primeira entrega da API):**

- **Prefixo:** `cf_test_` e `cf_live_` (CalculaFiscal), seguido de 64 caracteres hexadecimais (256 bits gerados no banco).
- **Hash:** SHA-256 em vez de argon2id. O segredo tem alta entropia, então o hash rápido é seguro, e o hash determinístico permite achar o token direto pelo índice. Argon2 protege senhas fracas, que não é o caso; é a prática do GitHub nos tokens dele.
- **Leitura:** a coluna do hash não é legível por nenhum papel de usuário. A autenticação passa pela função `api_autenticar(hash)`, chamada pelo servidor com a chave pública. Sem o segredo, ninguém chega ao hash.
- **Limite:** janela fixa de 1 minuto em Postgres (`api_uso`), 60 requisições por token, contada na mesma chamada da autenticação. A janela deslizante fica para quando houver Redis.
- **Ainda não feitos:** idempotência persistida, webhooks e lote assíncrono. Entram com o worker (pg-boss).

## ADR-008: Deploy no Railway e observabilidade

**Decisão:** serviços `web` e `worker`, ambientes de staging, produção e um por PR. Health check em `/api/health`. Sentry, logs JSON com `request_id` (pino) e monitor externo de disponibilidade.

## ADR-009: App Android com Expo, sem lógica própria

**Decisão:** Expo com EAS Build e EAS Update, importando `motor-fiscal` e `regras`. O pacote de regras embutido é verificado por Ed25519 com a chave pública fixada no app.

## ADR-010: Oráculo oficial

**Decisão:** um job no worker chama a calculadora da Receita (piloto-cbs.tributos.gov.br) para cada caso de referência e grava a diferença. Uma diferença acima de R$ 0,01 reprova. O CI usa respostas gravadas (fixtures), e a chamada real roda diariamente em staging.
**Pendência:** confirmar que a API pública existe, os termos de uso e o rate limit.
