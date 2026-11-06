import { tabelaOficial } from '@calculafiscal/regras';
import { ConsultaRegrasV1 } from '@/lib/api/contrato';
import { errosDoZod, respostaProblema } from '@/lib/api/problema';
import { json, rotaV1 } from '@/lib/api/rota';
import { consultarRegras } from '@/lib/api/servicos';

export const dynamic = 'force-dynamic';

/** GET /v1/regras: regras vigentes numa data, com fonte e status (escopo regras:ler). */
export const GET = rotaV1({ escopo: 'regras:ler', nome: 'GET /v1/regras' }, async (ctx) => {
  const consulta = ConsultaRegrasV1.safeParse(
    Object.fromEntries(new URL(ctx.requisicao.url).searchParams),
  );
  if (!consulta.success) {
    return respostaProblema('corpo-invalido', {
      requestId: ctx.requestId,
      erros: errosDoZod(consulta.error.issues),
    });
  }
  return json(consultarRegras(consulta.data, tabelaOficial(), ctx.requestId));
});
