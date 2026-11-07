import { ed25519 } from '@noble/curves/ed25519.js';
import { CHAVE_PUBLICA_REGRAS } from './chave-publica.js';
import { resolverPeriodo } from './resolver.js';
import { montarRegras, type TabelaDeRegras } from './tabela.js';

/**
 * Pacote de regras assinado com Ed25519, que o app baixa do site para atualizar as tabelas sem
 * reinstalar. A assinatura cobre os bytes UTF-8 de `conteudo` (um JSON); a chave privada fica
 * fora do repositório e do servidor (scripts/assinar-pacote.mjs). Sem Node: roda no celular.
 */

/** Versão do formato do conteúdo. O app recusa um formato que não conhece. */
export const FORMATO_PACOTE = 1;

export interface PacoteAssinado {
  /** Cópias de consulta rápida; valem as de dentro do conteúdo assinado. */
  readonly versao: string;
  readonly publicadoEm: string;
  readonly chave: string;
  /** Assinatura Ed25519 de `conteudo`, em base64. */
  readonly assinatura: string;
  /** JSON com { formato, versao, publicadoEm, arquivos }. */
  readonly conteudo: string;
}

export interface TabelaPublicada extends TabelaDeRegras {
  readonly publicadoEm: string;
}

export type Verificacao =
  | { readonly ok: true; readonly tabela: TabelaPublicada }
  | { readonly ok: false; readonly motivo: string };

export interface ChavePublica {
  readonly id: string;
  readonly base64: string;
}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 para bytes, sem depender de atob/Buffer (Hermes, navegador e Node). */
export function deBase64(texto: string): Uint8Array | null {
  const limpo = texto.replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(limpo) || limpo.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((limpo.length * 3) / 4));
  let acumulado = 0;
  let bits = 0;
  let i = 0;
  for (const c of limpo) {
    acumulado = (acumulado << 6) | ALFABETO.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[i++] = (acumulado >> bits) & 0xff;
    }
  }
  return bytes;
}

const texto = (v: unknown): v is string => typeof v === 'string';

/**
 * Confere a assinatura e só então lê e valida as regras (mesmo schema das tabelas embutidas).
 * Também resolve os anos de 2026 a 2033 uma vez: um pacote que o motor não consegue usar é
 * recusado aqui, e o app continua com a tabela que já tinha.
 */
export function verificarPacote(
  pacote: unknown,
  chave: ChavePublica = CHAVE_PUBLICA_REGRAS,
): Verificacao {
  const p = pacote as Partial<PacoteAssinado> | null;
  if (!p || !texto(p.conteudo) || !texto(p.assinatura) || !texto(p.chave)) {
    return { ok: false, motivo: 'Pacote incompleto.' };
  }
  if (p.chave !== chave.id) return { ok: false, motivo: `Chave desconhecida (${p.chave}).` };
  const assinatura = deBase64(p.assinatura);
  const publica = deBase64(chave.base64);
  if (assinatura?.length !== 64 || publica?.length !== 32) {
    return { ok: false, motivo: 'Assinatura malformada.' };
  }
  let valida = false;
  try {
    valida = ed25519.verify(assinatura, new TextEncoder().encode(p.conteudo), publica);
  } catch {
    valida = false;
  }
  if (!valida) return { ok: false, motivo: 'Assinatura não confere.' };

  let c: { formato?: unknown; versao?: unknown; publicadoEm?: unknown; arquivos?: unknown };
  try {
    c = JSON.parse(p.conteudo) as typeof c;
  } catch {
    return { ok: false, motivo: 'Conteúdo ilegível.' };
  }
  if (c.formato !== FORMATO_PACOTE) {
    return { ok: false, motivo: 'Formato novo: atualize o app para usar estas tabelas.' };
  }
  if (!texto(c.versao) || !/^[0-9a-f]{12}$/.test(c.versao)) {
    return { ok: false, motivo: 'Versão inválida.' };
  }
  if (!texto(c.publicadoEm) || Number.isNaN(Date.parse(c.publicadoEm))) {
    return { ok: false, motivo: 'Data de publicação inválida.' };
  }
  if (!Array.isArray(c.arquivos)) return { ok: false, motivo: 'Sem arquivos de regras.' };
  try {
    const regras = montarRegras(c.arquivos as { nome: string; conteudo: unknown }[]);
    resolverPeriodo(regras, {});
    return { ok: true, tabela: { regras, versao: c.versao, publicadoEm: c.publicadoEm } };
  } catch {
    return { ok: false, motivo: 'As regras do pacote não passaram na validação.' };
  }
}

export { CHAVE_PUBLICA_REGRAS } from './chave-publica.js';
