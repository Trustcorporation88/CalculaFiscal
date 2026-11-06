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

## Autenticação (Supabase Auth)

Configuração versionada em `packages/db/supabase/config.toml`, com sobrescritas de staging em `[remotes.staging]`. Aplicar com `supabase config diff` (conferir) e `supabase config push`.

- E-mail e senha (mínimo 10 caracteres), confirmação de e-mail obrigatória e link mágico só para contas existentes.
- MFA TOTP habilitado. Obrigatório para dono e administrador: o app exige e o RLS bloqueia ações administrativas sem sessão AAL2.
- Redirecionamentos permitidos: `/auth/callback` do staging e do localhost.
- Envio de e-mail: o SMTP padrão do Supabase tem limite baixo de envios por hora. Antes de produção, configurar um SMTP próprio (por exemplo, Resend ou SES) com domínio verificado.

## Monitoramento (Sentry)

`web` (servidor e navegador) e `worker` inicializam o Sentry só quando `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` existem. A coleta de dados pessoais está desligada (usuário, cookies, cabeçalhos, corpos e query string). No navegador, os eventos passam por `/monitoramento`, na mesma origem.
