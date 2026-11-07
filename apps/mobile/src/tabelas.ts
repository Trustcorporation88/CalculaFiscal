import { PACOTE_ASSINADO } from '@calculafiscal/regras/assinado';
import {
  verificarPacote,
  type PacoteAssinado,
  type TabelaPublicada,
} from '@calculafiscal/regras/assinatura';
import { tabelaOficial } from '@calculafiscal/regras/tabela';

/**
 * Tabelas de regras do app: as embutidas no APK ou um pacote mais novo baixado do site.
 * O pacote baixado só é usado depois de conferida a assinatura Ed25519 (a chave pública vem no
 * app) e de as regras passarem no mesmo schema do site. Um pacote mais antigo que o atual é
 * recusado, para ninguém conseguir "voltar" o app para alíquotas velhas.
 */

export const SITE = 'https://imposto.trustcorp.com.br';
export const DIAS_PARA_AVISO = 30;
const TEMPO_LIMITE_MS = 15_000;
const DIA_MS = 86_400_000;

export interface EstadoTabelas {
  readonly tabela: TabelaPublicada;
  readonly origem: 'embutida' | 'baixada';
  /** Última vez em que o app conseguiu conferir a versão no site. Nulo = nunca. */
  readonly verificadoEm: string | null;
}

/** O que fica no celular entre uma abertura e outra. */
export interface Guardado {
  readonly pacote: PacoteAssinado | null;
  readonly verificadoEm: string | null;
}

export function tabelaEmbutida(): TabelaPublicada {
  return { ...tabelaOficial(), publicadoEm: PACOTE_ASSINADO.publicadoEm };
}

const maisNova = (a: TabelaPublicada, b: TabelaPublicada) =>
  Date.parse(a.publicadoEm) > Date.parse(b.publicadoEm);

/** Estado ao abrir o app: o pacote guardado, se ainda conferir e for mais novo que o embutido. */
export function estadoInicial(guardado: Guardado | null): EstadoTabelas {
  const embutida = tabelaEmbutida();
  const verificadoEm = guardado?.verificadoEm ?? null;
  if (guardado?.pacote) {
    const v = verificarPacote(guardado.pacote);
    if (v.ok && maisNova(v.tabela, embutida)) {
      return { tabela: v.tabela, origem: 'baixada', verificadoEm };
    }
  }
  return { tabela: embutida, origem: 'embutida', verificadoEm };
}

export type ResultadoBusca =
  | { readonly tipo: 'em-dia'; readonly verificadoEm: string }
  | {
      readonly tipo: 'atualizada';
      readonly verificadoEm: string;
      readonly tabela: TabelaPublicada;
      readonly pacote: PacoteAssinado;
    }
  | { readonly tipo: 'recusada'; readonly motivo: string }
  | { readonly tipo: 'sem-conexao' };

type Buscar = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

async function buscarJson(buscar: Buscar, url: string): Promise<unknown> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await buscar(url, { signal: controle.signal });
    if (!r.ok) throw new Error(`HTTP em ${url}`);
    return await r.json();
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Pergunta ao site qual é a versão das tabelas e, se for outra, baixa e confere o pacote.
 * Só o pacote é conferido: a resposta de /versao serve apenas para evitar baixar à toa.
 */
export async function procurarAtualizacao(
  atual: TabelaPublicada,
  buscar: Buscar = fetch as unknown as Buscar,
  agora: () => Date = () => new Date(),
  site: string = SITE,
): Promise<ResultadoBusca> {
  let versao: unknown;
  try {
    versao = await buscarJson(buscar, `${site}/v1/regras/versao`);
  } catch {
    return { tipo: 'sem-conexao' };
  }
  const verificadoEm = agora().toISOString();
  if ((versao as { versao?: unknown } | null)?.versao === atual.versao) {
    return { tipo: 'em-dia', verificadoEm };
  }
  let pacote: unknown;
  try {
    pacote = await buscarJson(buscar, `${site}/v1/regras/pacote`);
  } catch {
    return { tipo: 'sem-conexao' };
  }
  const v = verificarPacote(pacote);
  if (!v.ok) return { tipo: 'recusada', motivo: v.motivo };
  if (v.tabela.versao === atual.versao) return { tipo: 'em-dia', verificadoEm };
  if (!maisNova(v.tabela, atual)) {
    return { tipo: 'recusada', motivo: 'O pacote do site é mais antigo que o do celular.' };
  }
  return { tipo: 'atualizada', verificadoEm, tabela: v.tabela, pacote: pacote as PacoteAssinado };
}

/** Dias desde a última conferência (ou, sem nenhuma, desde a publicação da tabela em uso). */
export function diasSemConferir(estado: EstadoTabelas, agora: Date = new Date()): number {
  const desde = Date.parse(estado.verificadoEm ?? estado.tabela.publicadoEm);
  return Math.max(0, Math.floor((agora.getTime() - desde) / DIA_MS));
}

/** "07/11/2026" a partir de uma data ISO, no fuso de Brasília. */
export function dataCurta(iso: string): string {
  const d = new Date(Date.parse(iso) - 3 * 3_600_000);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
