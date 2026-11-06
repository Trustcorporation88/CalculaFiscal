# CalculaFiscal

Custo, preço e margem por produto e serviço na transição da Reforma Tributária (2026 a 2033): CBS, IBS, Imposto Seletivo e os tributos que continuam ou acabam, sempre com a memória de cálculo.

## Estrutura

| Pasta                   | O que é                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `apps/web`              | Next.js: site público, aplicação e API `/v1`                |
| `apps/worker`           | Jobs assíncronos (lotes, XML, oráculo da Receita, webhooks) |
| `packages/motor-fiscal` | Motor puro, decimal, 100% testado                           |
| `packages/regras`       | Tabelas versionadas de alíquotas (YAML + Zod)               |
| `packages/db`           | Migrations do Supabase                                      |
| `docs/`                 | Fase 0, ADRs, runbooks                                      |

## Setup local

Pré-requisitos: Node 22 ou superior, pnpm 10 e, para o banco local, Docker e a Supabase CLI.

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @calculafiscal/web dev
```

Copie `.env.example` para `apps/web/.env.local` e preencha com os dados do projeto Supabase de staging. Nunca faça commit de segredos.

## Regras de contribuição

- `main` protegida: merge só por PR com CI verde e Conventional Commits.
- Alíquotas só mudam por PR em `packages/regras/dados/`, com norma, artigo, vigência e status.
- Migrations vão primeiro para staging. Produção só com aceite.
