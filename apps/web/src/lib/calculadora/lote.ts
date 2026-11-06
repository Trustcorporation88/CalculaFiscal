import type { ValoresFormulario } from './entrada';

/** Definições do lote sem dependência de Node: usadas no navegador (leitura) e no servidor. */

export const LIMITE_LOTE = 500;

/** Campos de produto que vêm da planilha; os de venda e o cenário vêm do formulário. */
export const COLUNAS_LOTE = [
  'descricao',
  'ncm',
  'notaCompra',
  'aliquotaIcms',
  'aliquotaIpi',
  'aliquotaPisCofins',
  'mva',
  'aliquotaInterna',
  'freteEDespesas',
] as const;
export type ColunaLote = (typeof COLUNAS_LOTE)[number];

export const CABECALHO_LOTE: Readonly<Record<ColunaLote, string>> = {
  descricao: 'Descrição',
  ncm: 'NCM',
  notaCompra: 'Total da nota (R$)',
  aliquotaIcms: 'ICMS do fornecedor (%)',
  aliquotaIpi: 'IPI (%)',
  aliquotaPisCofins: 'PIS e Cofins do fornecedor (%)',
  mva: 'MVA (%), vazio se não houver ST',
  aliquotaInterna: 'Alíquota interna ICMS-ST (%)',
  freteEDespesas: 'Frete e despesas (R$)',
};

/** Começos de cabeçalho aceitos para cada coluna (sem acento, minúsculas). */
const APELIDOS: Readonly<Record<ColunaLote, readonly string[]>> = {
  descricao: ['descricao', 'produto'],
  ncm: ['ncm'],
  notaCompra: ['total da nota', 'nota', 'custo'],
  aliquotaIcms: ['icms do fornecedor', 'icms'],
  aliquotaIpi: ['ipi'],
  aliquotaPisCofins: ['pis'],
  mva: ['mva'],
  aliquotaInterna: ['aliquota interna'],
  freteEDespesas: ['frete'],
};

const OBRIGATORIAS: readonly ColunaLote[] = [
  'notaCompra',
  'aliquotaIcms',
  'aliquotaIpi',
  'aliquotaPisCofins',
];

const PERCENTUAIS: readonly ColunaLote[] = [
  'aliquotaIcms',
  'aliquotaIpi',
  'aliquotaPisCofins',
  'mva',
  'aliquotaInterna',
];

/** Campo extra da linha com avisos da leitura (ex.: percentual formatado como % no Excel). */
export const CAMPO_AVISOS = '_avisos';

export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function colunaDoCabecalho(cabecalho: string): ColunaLote | null {
  const h = normalizar(cabecalho);
  if (h === '') return null;
  let melhor: { coluna: ColunaLote; tamanho: number } | null = null;
  for (const coluna of COLUNAS_LOTE) {
    for (const apelido of APELIDOS[coluna]) {
      if (h.startsWith(apelido) && (!melhor || apelido.length > melhor.tamanho)) {
        melhor = { coluna, tamanho: apelido.length };
      }
    }
  }
  return melhor?.coluna ?? null;
}

export type Celula = string | number | boolean | Date | null | undefined;

export type LeituraTabela =
  | { readonly ok: true; readonly linhas: ValoresFormulario[] }
  | { readonly ok: false; readonly erro: string };

/**
 * Converte a tabela lida (primeira linha = cabeçalho) em linhas do lote. Linhas vazias são
 * ignoradas. Número entre 0 e 1 numa coluna de percentual vira aviso da linha: costuma ser
 * célula formatada como % no Excel (0,18 em vez de 18), e o site não adivinha.
 */
export function linhasDaTabela(tabela: readonly (readonly Celula[])[]): LeituraTabela {
  const [cabecalho, ...corpo] = tabela;
  if (!cabecalho) return { ok: false, erro: 'A planilha está vazia.' };
  const indices = new Map<ColunaLote, number>();
  cabecalho.forEach((c, i) => {
    const coluna = colunaDoCabecalho(String(c ?? ''));
    if (coluna && !indices.has(coluna)) indices.set(coluna, i);
  });
  const faltando = OBRIGATORIAS.filter((c) => !indices.has(c));
  if (faltando.length > 0) {
    return {
      ok: false,
      erro: `Faltam colunas: ${faltando.map((c) => CABECALHO_LOTE[c]).join(', ')}. Use o modelo.`,
    };
  }

  const linhas: ValoresFormulario[] = [];
  for (const bruta of corpo) {
    const valores: Record<string, string> = {};
    const avisos: string[] = [];
    for (const [coluna, i] of indices) {
      const celula = bruta[i];
      if (typeof celula === 'number' && PERCENTUAIS.includes(coluna) && celula > 0 && celula < 1) {
        avisos.push(
          `${CABECALHO_LOTE[coluna]} veio como ${String(celula).replace('.', ',')}: se for ${String(Math.round(celula * 10000) / 100).replace('.', ',')}%, digite o número sem formatar a célula como %`,
        );
      }
      valores[coluna] =
        celula === null || celula === undefined
          ? ''
          : celula instanceof Date
            ? ''
            : String(celula).trim();
    }
    if (Object.values(valores).every((v) => v === '')) continue;
    if (avisos.length > 0) valores[CAMPO_AVISOS] = avisos.join(' | ');
    linhas.push(valores);
  }
  if (linhas.length === 0) return { ok: false, erro: 'Nenhum produto na planilha.' };
  if (linhas.length > LIMITE_LOTE) {
    return {
      ok: false,
      erro: `A planilha tem ${linhas.length} produtos; o limite é ${LIMITE_LOTE}.`,
    };
  }
  return { ok: true, linhas };
}

/** CSV simples (RFC 4180), com ponto e vírgula ou vírgula como separador. */
export function lerCsv(texto: string): string[][] {
  const semBom = texto.replace(/^﻿/, '');
  const primeira = semBom.split(/\r?\n/, 1)[0] ?? '';
  const separador = primeira.includes(';') ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < semBom.length; i++) {
    const c = semBom[i] as string;
    if (aspas) {
      if (c === '"' && semBom[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === separador) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && semBom[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}
