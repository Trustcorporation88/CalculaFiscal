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

Serviços `web` e `worker` ainda não criados: entram quando o deploy for configurado.
