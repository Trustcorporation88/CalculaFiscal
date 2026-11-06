### Serviços

| Serviço | Build                                                    | Start                                                     | Health check  |
| ------- | -------------------------------------------------------- | --------------------------------------------------------- | ------------- |
| web     | `pnpm turbo run build --filter=@calculafiscal/web...`    | `pnpm --filter @calculafiscal/web start` (Next lê `PORT`) | `/api/health` |
| worker  | `pnpm turbo run build --filter=@calculafiscal/worker...` | `pnpm --filter @calculafiscal/worker start`               | `/health`     |

Fluxo: o ambiente `staging` segue a branch `main` e cada PR ganha um ambiente temporário. O ambiente `production` não tem fonte conectada até a aprovação do primeiro release.
