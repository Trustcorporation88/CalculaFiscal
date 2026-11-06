import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';
import { tabelaOficial } from '@calculafiscal/regras';

/** Erros da API no formato RFC 9457 (application/problem+json), com códigos estáveis. */

export const PROBLEMAS = {
  'token-ausente': { status: 401, title: 'Token ausente' },
  'token-invalido': { status: 401, title: 'Token inválido, expirado ou revogado' },
  'escopo-insuficiente': { status: 403, title: 'O token não tem o escopo necessário' },
  'nao-encontrado': { status: 404, title: 'Recurso não encontrado' },
  'corpo-grande': { status: 413, title: 'Corpo da requisição grande demais' },
  'tipo-de-conteudo': { status: 415, title: 'Envie o corpo como application/json' },
  'corpo-invalido': { status: 400, title: 'Requisição inválida' },
  'entrada-impossivel': { status: 422, title: 'Combinação de valores impossível' },
  'limite-excedido': { status: 429, title: 'Limite de requisições por minuto excedido' },
  'erro-interno': { status: 500, title: 'Erro interno' },
} as const;

export type CodigoProblema = keyof typeof PROBLEMAS;

export interface CorpoProblema {
  type: string;
  title: string;
  status: number;
  codigo: CodigoProblema;
  versao_motor: string;
  versao_regras: string;
  detail?: string;
  request_id?: string;
  erros?: { campo: string; mensagem: string }[];
}

export function corpoProblema(
  codigo: CodigoProblema,
  extras: {
    detail?: string;
    requestId?: string;
    erros?: { campo: string; mensagem: string }[];
  } = {},
): CorpoProblema {
  const { status, title } = PROBLEMAS[codigo];
  return {
    type: `urn:calculafiscal:problema:${codigo}`,
    title,
    status,
    codigo,
    // Como toda resposta da API: as versões que produziram (ou recusaram) o resultado.
    versao_motor: VERSAO_MOTOR,
    versao_regras: tabelaOficial().versao,
    ...(extras.detail ? { detail: extras.detail } : {}),
    ...(extras.requestId ? { request_id: extras.requestId } : {}),
    ...(extras.erros ? { erros: extras.erros } : {}),
  };
}

export function respostaProblema(
  codigo: CodigoProblema,
  extras: Parameters<typeof corpoProblema>[1] & { headers?: Record<string, string> } = {},
): Response {
  const corpo = corpoProblema(codigo, extras);
  return new Response(JSON.stringify(corpo), {
    status: corpo.status,
    headers: {
      'Content-Type': 'application/problem+json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extras.headers,
    },
  });
}

/** Erros do Zod como lista campo/mensagem, para o integrador saber o que corrigir. */
export function errosDoZod(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): { campo: string; mensagem: string }[] {
  return issues.map((i) => ({
    campo: i.path.map(String).join('.') || '(corpo)',
    mensagem: i.message,
  }));
}
