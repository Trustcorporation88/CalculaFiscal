import { tabelaOficial } from '@calculafiscal/regras';
import { SimulacaoV1 } from '@/lib/api/contrato';
import { errosDoZod, respostaProblema } from '@/lib/api/problema';
import { json, lerCorpoJson, rotaV1 } from '@/lib/api/rota';
import { simular } from '@/lib/api/servicos';

export const dynamic = 'force-dynamic';

/** POST /v1/simulacoes: simulação síncrona de até 20 itens (escopo simular). */
export const POST = rotaV1({ escopo: 'simular', nome: 'POST /v1/simulacoes' }, async (ctx) => {
  const lido = await lerCorpoJson(ctx.requisicao, ctx.requestId);
  if (!lido.ok) return lido.resposta;
  const pedido = SimulacaoV1.safeParse(lido.corpo);
  if (!pedido.success) {
    return respostaProblema('corpo-invalido', {
      requestId: ctx.requestId,
      erros: errosDoZod(pedido.error.issues),
    });
  }
  return json(simular(pedido.data, tabelaOficial(), ctx.requestId));
});
