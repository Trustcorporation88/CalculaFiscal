import { tabelaOficial } from '@calculafiscal/regras';
import { json, rotaV1 } from '@/lib/api/rota';
import { listarCenarios } from '@/lib/api/servicos';

export const dynamic = 'force-dynamic';

/** GET /v1/cenarios: cenários e premissas (escopo regras:ler). */
export const GET = rotaV1({ escopo: 'regras:ler', nome: 'GET /v1/cenarios' }, async (ctx) =>
  json(listarCenarios(tabelaOficial(), ctx.requestId)),
);
