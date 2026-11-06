# Infraestrutura

Identificadores públicos dos ambientes. Segredos (senhas, chaves service role, tokens) nunca entram no repositório: ficam nas variáveis do Railway e no GitHub Secrets.

## Supabase (organização trustcorp88, plano Pro, região sa-east-1)

| Ambiente | Projeto               | Ref                    | Painel                                                      |
| -------- | --------------------- | ---------------------- | ----------------------------------------------------------- |
| Staging  | calculafiscal-staging | `ebfawpisbfkstpcstswl` | https://supabase.com/dashboard/project/ebfawpisbfkstpcstswl |
| Produção | calculafiscal-prod    | `qgwqnxkcyhgmlwuirlnc` | https://supabase.com/dashboard/project/qgwqnxkcyhgmlwuirlnc |

Migrations aplicadas em 06/11/2026: todas as de `supabase/migrations` (até `20261106050000_api_tokens`) em staging e em produção. A produção foi montada com o aceite do dono em 06/11/2026.

Aplicar migrations (a senha do banco fica fora do repositório e entra por `SUPABASE_DB_PASSWORD`):

```bash
cd packages/db
supabase link --project-ref ebfawpisbfkstpcstswl   # staging (vínculo padrão)
supabase db push --remote --dry-run                # conferir
supabase db push --remote
```

Na produção, o mesmo fluxo com `--project-ref qgwqnxkcyhgmlwuirlnc` e um novo aceite. Depois, volte o vínculo para o staging.

## Railway (workspace TRUSTCORP Dev's Projects)

| Projeto       | Id                                     | Ambientes                                       |
| ------------- | -------------------------------------- | ----------------------------------------------- |
| calculafiscal | `35ceaa0f-2447-4634-875b-811f73147379` | production, staging, ambiente temporário por PR |

### Serviços

| Serviço | Build                                                    | Start                                                     | Health check  |
| ------- | -------------------------------------------------------- | --------------------------------------------------------- | ------------- |
| web     | `pnpm turbo run build --filter=@calculafiscal/web...`    | `pnpm --filter @calculafiscal/web start` (Next lê `PORT`) | `/api/health` |
| worker  | `pnpm turbo run build --filter=@calculafiscal/worker...` | `pnpm --filter @calculafiscal/worker start`               | `/health`     |

| Ambiente | Endereço                                | Origem do deploy                     |
| -------- | --------------------------------------- | ------------------------------------ |
| Staging  | https://web-staging-50d4.up.railway.app | segue a `main` (deploy a cada merge) |
| Produção | https://imposto.trustcorp.com.br        | **fixada num commit** (ver abaixo)   |

Cada PR também ganha um ambiente temporário.

### Promover uma versão para a produção

A produção não segue a `main` sozinha: os serviços `web` e `worker` ficam fixados num commit (hoje `5c33996`, a API /v1). Para promover:

1. Confira a versão no staging.
2. Fixe os dois serviços no commit novo (Railway: origem do serviço com `commitSha`, preparado no ambiente `production`).
3. Aplique as mudanças preparadas. Se houver migration nova, aplique-a no Supabase de produção antes.

### Variáveis do `web` em produção

`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (projeto de produção), `APP_ENV` e `NEXT_PUBLIC_APP_ENV` = `production`, `SITE_URL` = `https://imposto.trustcorp.com.br`, `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`. No `worker`: `APP_ENV` e `SENTRY_DSN`.

### Domínio

`imposto.trustcorp.com.br` aponta para o `web` de produção por CNAME (`vj8kyttw.up.railway.app`), com o TXT `_railway-verify.imposto` para a verificação de posse. O certificado HTTPS é emitido pelo Railway depois da verificação.

## Autenticação (Supabase Auth)

Configuração versionada em `packages/db/supabase/config.toml`, com sobrescritas em `[remotes.staging]` e `[remotes.production]`. Aplicar com `supabase config diff --project-ref <ref>` (conferir) e `supabase config push --project-ref <ref>`. O `config push` não apaga propriedades que não estão no arquivo, como o SMTP salvo no painel.

- E-mail e senha (mínimo 10 caracteres), confirmação de e-mail obrigatória e link mágico só para contas existentes.
- MFA TOTP habilitado. Obrigatório para dono e administrador: o app exige e o RLS bloqueia ações administrativas sem sessão AAL2.
- Redirecionamentos permitidos: `/auth/callback` de cada ambiente (produção: `https://imposto.trustcorp.com.br/auth/callback`).
- Envio de e-mail: SMTP próprio pelo Resend (domínio `trustcorp.com.br`), configurado no painel de cada projeto pelo dono da chave: host `smtp.resend.com`, porta 465, usuário `resend`. Configurado no staging em 06/11/2026; falta na produção.

## Monitoramento (Sentry)

Projeto `nextjs-project` (equipe GAVEA NEGOCIOS), com o DSN configurado no staging e na produção. `web` (servidor e navegador) e `worker` inicializam o Sentry só quando `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` existem. A coleta de dados pessoais está desligada (usuário, cookies, cabeçalhos, corpos e query string). No navegador, os eventos passam por `/monitoramento`, na mesma origem.
