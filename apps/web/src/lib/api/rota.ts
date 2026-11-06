import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import {
  autenticar,
  consultaSupabase,
  LIMITE_POR_MINUTO,
  type ConsultaToken,
  type Credencial,
  type Escopo,
} from './autenticacao';
import { respostaProblema } from './problema';

export interface ContextoV1 {
  readonly requisicao: Request;
  readonly requestId: string;
  readonly credencial: Credencial;
}

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Log de uma linha em JSON, sem dado pessoal nem corpo da requisição. */
function registrar(dados: Record<string, unknown>) {
  console.log(JSON.stringify({ nivel: 'info', origem: 'api-v1', ...dados }));
}

/**
 * Envolve uma rota /v1: request_id, autenticação por token, limite por minuto, escopo,
 * cabeçalhos de limite e erros sempre em problem+json.
 */
export function rotaV1(
  opcoes: { escopo: Escopo; nome: string; consultar?: ConsultaToken },
  tratar: (ctx: ContextoV1) => Promise<Response>,
) {
  return async (requisicao: Request): Promise<Response> => {
    const inicio = Date.now();
    const requestId = randomUUID();
    let resposta: Response;
    let organizacao: string | null = null;
    let limite: Record<string, string> = {};
    try {
      const auth = await autenticar(
        requisicao.headers.get('authorization'),
        opcoes.consultar ?? consultaSupabase,
      );
      if (!auth.ok) {
        resposta = respostaProblema(auth.codigo, {
          requestId,
          headers: { 'WWW-Authenticate': 'Bearer' },
        });
      } else {
        const c = auth.credencial;
        organizacao = c.organizationId;
        const segundos = Math.max(0, Math.ceil((c.reinicio.getTime() - Date.now()) / 1000));
        limite = {
          'RateLimit-Limit': String(LIMITE_POR_MINUTO),
          'RateLimit-Remaining': String(Math.max(0, LIMITE_POR_MINUTO - c.usados)),
          'RateLimit-Reset': String(segundos),
        };
        if (c.usados > LIMITE_POR_MINUTO) {
          resposta = respostaProblema('limite-excedido', {
            requestId,
            detail: `Até ${LIMITE_POR_MINUTO} requisições por minuto por token.`,
            headers: { 'Retry-After': String(segundos) },
          });
        } else if (!c.escopos.includes(opcoes.escopo)) {
          resposta = respostaProblema('escopo-insuficiente', {
            requestId,
            detail: `Esta rota exige o escopo "${opcoes.escopo}".`,
          });
        } else {
          resposta = await tratar({ requisicao, requestId, credencial: c });
        }
      }
    } catch (erro) {
      Sentry.captureException(erro, { tags: { request_id: requestId, rota: opcoes.nome } });
      resposta = respostaProblema('erro-interno', {
        requestId,
        detail: 'O erro foi registrado. Informe o request_id ao suporte.',
      });
    }
    resposta.headers.set('X-Request-Id', requestId);
    for (const [k, v] of Object.entries(limite)) resposta.headers.set(k, v);
    registrar({
      request_id: requestId,
      rota: opcoes.nome,
      status: resposta.status,
      organizacao,
      duracao_ms: Date.now() - inicio,
    });
    return resposta;
  };
}

export const TAMANHO_MAXIMO_CORPO = 256 * 1024;

/**
 * Lê o corpo em stream contando bytes (não caracteres) e cancela assim que passar do teto, para
 * um corpo enorme sem Content-Length não ser carregado inteiro na memória. Nulo = grande demais.
 */
async function lerAteOLimite(requisicao: Request): Promise<string | null> {
  if (!requisicao.body) return '';
  const leitor = requisicao.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > TAMANHO_MAXIMO_CORPO) {
      await leitor.cancel();
      return null;
    }
    partes.push(value);
  }
  const tudo = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    tudo.set(parte, posicao);
    posicao += parte.byteLength;
  }
  return new TextDecoder('utf-8').decode(tudo);
}

/** Lê o corpo JSON com limite de tamanho; devolve a resposta de erro quando não dá. */
export async function lerCorpoJson(
  requisicao: Request,
  requestId: string,
): Promise<{ ok: true; corpo: unknown } | { ok: false; resposta: Response }> {
  const tipo = requisicao.headers.get('content-type') ?? '';
  if (!tipo.toLowerCase().includes('application/json')) {
    return { ok: false, resposta: respostaProblema('tipo-de-conteudo', { requestId }) };
  }
  const declarado = Number(requisicao.headers.get('content-length') ?? '0');
  if (declarado > TAMANHO_MAXIMO_CORPO) {
    return { ok: false, resposta: respostaProblema('corpo-grande', { requestId }) };
  }
  const texto = await lerAteOLimite(requisicao);
  if (texto === null) {
    return { ok: false, resposta: respostaProblema('corpo-grande', { requestId }) };
  }
  try {
    return { ok: true, corpo: JSON.parse(texto) as unknown };
  } catch {
    return {
      ok: false,
      resposta: respostaProblema('corpo-invalido', { requestId, detail: 'JSON malformado.' }),
    };
  }
}
