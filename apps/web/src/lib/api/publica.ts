import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { respostaProblema } from './problema';

/**
 * Rotas /v1 públicas (sem token), usadas pelo app para atualizar as tabelas. Limite por IP
 * guardado na memória do processo: basta para conter abuso de um endereço; o conteúdo é público
 * e assinado, então não há o que vazar.
 */

export const LIMITE_PUBLICO_POR_MINUTO = 30;
const JANELA_MS = 60_000;
const MAXIMO_DE_ENDERECOS = 10_000;

export interface Limitador {
  (chave: string): {
    readonly permitido: boolean;
    readonly restantes: number;
    readonly reinicio: number;
  };
}

/** Janela fixa por chave. `reinicio` em segundos até a janela recomeçar. */
export function criarLimitador(
  limite = LIMITE_PUBLICO_POR_MINUTO,
  janelaMs = JANELA_MS,
  agora: () => number = Date.now,
): Limitador {
  const contagens = new Map<string, { inicio: number; usados: number }>();
  return (chave) => {
    const t = agora();
    if (contagens.size > MAXIMO_DE_ENDERECOS) {
      for (const [k, v] of contagens) if (t - v.inicio >= janelaMs) contagens.delete(k);
      if (contagens.size > MAXIMO_DE_ENDERECOS) contagens.clear();
    }
    let c = contagens.get(chave);
    if (!c || t - c.inicio >= janelaMs) {
      c = { inicio: t, usados: 0 };
      contagens.set(chave, c);
    }
    c.usados += 1;
    return {
      permitido: c.usados <= limite,
      restantes: Math.max(0, limite - c.usados),
      reinicio: Math.max(0, Math.ceil((c.inicio + janelaMs - t) / 1000)),
    };
  };
}

/**
 * Endereço de quem chama. O proxy do Railway grava X-Real-IP e acrescenta o IP ao fim do
 * X-Forwarded-For; o começo dessa lista pode ter sido escrito pelo próprio cliente.
 */
export function enderecoDe(requisicao: Request): string {
  const real = requisicao.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const lista = requisicao.headers.get('x-forwarded-for')?.split(',') ?? [];
  return lista.at(-1)?.trim() || 'desconhecido';
}

const limitadorPadrao = criarLimitador();

export function rotaPublica(
  opcoes: { nome: string; limitador?: Limitador },
  tratar: (requisicao: Request) => Response,
) {
  const limitar = opcoes.limitador ?? limitadorPadrao;
  return (requisicao: Request): Response => {
    const inicio = Date.now();
    const requestId = randomUUID();
    const l = limitar(enderecoDe(requisicao));
    let resposta: Response;
    try {
      resposta = l.permitido
        ? tratar(requisicao)
        : respostaProblema('limite-excedido', {
            requestId,
            detail: `Até ${LIMITE_PUBLICO_POR_MINUTO} requisições por minuto por endereço.`,
            headers: { 'Retry-After': String(l.reinicio) },
          });
    } catch (erro) {
      Sentry.captureException(erro, { tags: { request_id: requestId, rota: opcoes.nome } });
      resposta = respostaProblema('erro-interno', { requestId });
    }
    resposta.headers.set('X-Request-Id', requestId);
    resposta.headers.set('RateLimit-Limit', String(LIMITE_PUBLICO_POR_MINUTO));
    resposta.headers.set('RateLimit-Remaining', String(l.restantes));
    resposta.headers.set('RateLimit-Reset', String(l.reinicio));
    console.log(
      JSON.stringify({
        nivel: 'info',
        origem: 'api-v1',
        request_id: requestId,
        rota: opcoes.nome,
        status: resposta.status,
        duracao_ms: Date.now() - inicio,
      }),
    );
    return resposta;
  };
}
