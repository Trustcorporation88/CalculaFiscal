import { tabelaOficial } from '@calculafiscal/regras';
import { respostaProblema } from '@/lib/api/problema';
import { json, rotaV1 } from '@/lib/api/rota';
import { consultarClassificacao, lerConsultaClassificacao } from '@/lib/api/servicos';

export const dynamic = 'force-dynamic';

/** GET /v1/classificacao: sugestão e crítica de CST e cClassTrib por NCM ou NBS (escopo regras:ler). */
export const GET = rotaV1({ escopo: 'regras:ler', nome: 'GET /v1/classificacao' }, async (ctx) => {
  const leitura = lerConsultaClassificacao(
    Object.fromEntries(new URL(ctx.requisicao.url).searchParams),
  );
  if (!leitura.ok) {
    return respostaProblema('corpo-invalido', {
      requestId: ctx.requestId,
      erros: leitura.erros,
    });
  }
  return json(consultarClassificacao(leitura.dados, tabelaOficial(), ctx.requestId));
});
