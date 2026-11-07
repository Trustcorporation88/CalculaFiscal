import { FORMATO_PACOTE } from '@calculafiscal/regras/assinatura';
import { PACOTE_ASSINADO } from '@calculafiscal/regras/assinado';

/**
 * Pacote de regras assinado (Ed25519) que o app baixa. O servidor só serve o arquivo: a
 * assinatura é feita fora dele, com a chave privada que nunca sai do computador de quem publica.
 */

const CORPO = JSON.stringify(PACOTE_ASSINADO);
const ETAG = `"${PACOTE_ASSINADO.versao}"`;

export interface VersaoDoPacote {
  readonly versao: string;
  readonly publicadoEm: string;
  readonly formato: number;
  readonly chave: string;
  readonly tamanhoBytes: number;
  readonly pacote: string;
}

export function versaoDoPacote(): VersaoDoPacote {
  return {
    versao: PACOTE_ASSINADO.versao,
    publicadoEm: PACOTE_ASSINADO.publicadoEm,
    formato: FORMATO_PACOTE,
    chave: PACOTE_ASSINADO.chave,
    tamanhoBytes: new TextEncoder().encode(CORPO).byteLength,
    pacote: '/v1/regras/pacote',
  };
}

export function respostaVersao(): Response {
  return new Response(JSON.stringify(versaoDoPacote()), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

/** O pacote inteiro; 304 quando o app já tem esta versão (If-None-Match). */
export function respostaPacote(requisicao: Request): Response {
  const cabecalhos = {
    ETag: ETAG,
    'Cache-Control': 'public, max-age=3600',
  };
  const tem = requisicao.headers.get('if-none-match');
  if (tem?.split(',').some((e) => e.trim().replace(/^W\//, '') === ETAG)) {
    return new Response(null, { status: 304, headers: cabecalhos });
  }
  return new Response(CORPO, {
    headers: { ...cabecalhos, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
