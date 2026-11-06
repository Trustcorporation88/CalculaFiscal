# Infraestrutura

Identificadores públicos dos ambientes. Segredos (senhas, chaves service role, tokens) nunca entram no repositório: ficam nas variáveis do Railway e no GitHub Secrets.

## Supabase (organização trustcorp88, plano Pro, região sa-east-1)

| Ambiente | Projeto               | Ref                    | Painel                                                      |
| -------- | --------------------- | ---------------------- | ----------------------------------------------------------- |
| Staging  | calculafiscal-staging | `ebfawpisbfkstpcstswl` | https://supabase.com/dashboard/project/ebfawpisbfkstpcstswl |
| Produção | calculafiscal-prod    | `qgwqnxkcyhgmlwuirlnc` | https://supabase.com/dashboard/project/qgwqnxkcyhgmlwuirlnc |

Migrations aplicadas em staging em 06/11/2026: `20261106000000`, `20261106010000`, `20261106020000`. Produção: nenhuma (aguarda aceite).

Aplicar migrations em staging:

```bash
cd packages/db
supabase link --project-ref ebfawpisbfkstpcstswl
supabase db push --remote
```

## Railway (workspace TRUSTCORP Dev's Projects)

| Projeto       | Id                                     | Ambientes                                       |
| ------------- | -------------------------------------- | ----------------------------------------------- |
| calculafiscal | `35ceaa0f-2447-4634-875b-811f73147379` | production, staging, ambiente temporário por PR |

### Serviços

| Serviço | Build                                                    | Start                                                     | Health check  |
| ------- | -------------------------------------------------------- | --------------------------------------------------------- | ------------- |
| web     | `pnpm turbo run build --filter=@calculafiscal/web...`    | `pnpm --filter @calculafiscal/web start` (Next lê `PORT`) | `/api/health` |
| worker  | `pnpm turbo run build --filter=@calculafiscal/worker...` | `pnpm --filter @calculafiscal/worker start`               | `/health`     |

Staging: https://web-staging-50d4.up.railway.app

Fluxo: o ambiente `staging` segue a branch `main` e cada PR ganha um ambiente temporário. O ambiente `production` não tem fonte conectada até a aprovação do primeiro release.
