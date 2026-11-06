'use server';

import * as Sentry from '@sentry/nextjs';
import { tabelaOficial } from '@calculafiscal/regras';
import { z } from 'zod';
import type { Cenario } from '@calculafiscal/regras/cenarios';
import {
  calcularLinhaDoTempo,
  calcularLote,
  type LinhaLote,
  type ResultadoCalculadora,
} from '@/lib/calculadora/calcular';
import { lerEntrada, type ValoresFormulario } from '@/lib/calculadora/entrada';
import { COLUNAS_LOTE, LIMITE_LOTE } from '@/lib/calculadora/lote';
import { ROTULO_CAMPO } from '@/lib/calculadora/rotulos';
import { exigirSessao } from '@/lib/sessao';

export type EstadoCalculadora =
  | { readonly situacao: 'vazio' }
  | {
      readonly situacao: 'erro';
      readonly mensagem: string;
      readonly campos: Readonly<Record<string, string>>;
    }
  | { readonly situacao: 'ok'; readonly resultado: ResultadoCalculadora };

/** Calcula no servidor, com as regras versionadas. Nada do cálculo existe só na tela. */
export async function calcular(
  _anterior: EstadoCalculadora,
  dados: FormData,
): Promise<EstadoCalculadora> {
  // Server Action é um endpoint público: confere a sessão como as páginas.
  await exigirSessao();

  const valores = valoresDoFormulario(dados);
  const leitura = lerEntrada(valores);
  if (!leitura.ok) {
    return {
      situacao: 'erro',
      mensagem: 'Confira os campos destacados.',
      campos: leitura.erros,
    };
  }
  try {
    return { situacao: 'ok', resultado: calcularLinhaDoTempo(leitura.entrada, tabelaOficial()) };
  } catch (e) {
    // RangeError = combinação de entradas impossível (o motor recusa em vez de inventar número).
    if (e instanceof RangeError) {
      return { situacao: 'erro', mensagem: e.message, campos: {} };
    }
    Sentry.captureException(e);
    return {
      situacao: 'erro',
      mensagem: 'Não foi possível calcular agora. O erro foi registrado.',
      campos: {},
    };
  }
}

function valoresDoFormulario(dados: FormData): ValoresFormulario {
  return Object.fromEntries(
    [...dados.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']),
  );
}

export type EstadoLote =
  | { readonly situacao: 'vazio' }
  | {
      readonly situacao: 'erro';
      readonly mensagem: string;
      readonly campos: Readonly<Record<string, string>>;
    }
  | {
      readonly situacao: 'ok';
      readonly linhas: readonly LinhaLote[];
      readonly cenario: Cenario;
      readonly versaoRegras: string;
    };

const LinhasDoLote = z
  .array(z.record(z.string(), z.string().max(200)))
  .min(1, 'Nenhum produto na planilha.')
  .max(LIMITE_LOTE, `O lote aceita até ${LIMITE_LOTE} produtos.`);

/** Valores neutros de produto, só para validar os campos de venda antes de rodar o lote. */
const PRODUTO_NEUTRO: ValoresFormulario = {
  notaCompra: '1',
  aliquotaIcms: '0',
  aliquotaIpi: '0',
  aliquotaPisCofins: '0',
  impostoSimplificado: '0',
};

/**
 * Simulação em lote: as linhas chegam já lidas da planilha no navegador (só texto); o cálculo
 * é o mesmo da calculadora unitária, no servidor, com o perfil de venda do formulário.
 */
export async function calcularLoteAcao(
  _anterior: EstadoLote,
  dados: FormData,
): Promise<EstadoLote> {
  await exigirSessao();

  const valores = valoresDoFormulario(dados);
  const { linhas: linhasJson, ...venda } = valores;
  for (const c of COLUNAS_LOTE) delete (venda as Record<string, string>)[c];

  const validacao = lerEntrada({ ...venda, ...PRODUTO_NEUTRO });
  if (!validacao.ok) {
    const nomes = Object.keys(validacao.erros).map((c) => ROTULO_CAMPO[c] ?? c);
    return {
      situacao: 'erro',
      mensagem: `Confira: ${nomes.join(', ')}.`,
      campos: validacao.erros,
    };
  }
  let linhas: z.infer<typeof LinhasDoLote>;
  try {
    const lidas = LinhasDoLote.safeParse(JSON.parse(linhasJson ?? '[]'));
    if (!lidas.success) {
      return {
        situacao: 'erro',
        mensagem: lidas.error.issues[0]?.message ?? 'Planilha inválida.',
        campos: {},
      };
    }
    linhas = lidas.data;
  } catch {
    return { situacao: 'erro', mensagem: 'Carregue a planilha antes de calcular.', campos: {} };
  }
  try {
    const tabela = tabelaOficial();
    return {
      situacao: 'ok',
      linhas: calcularLote(linhas, venda, tabela),
      cenario: validacao.entrada.cenario,
      versaoRegras: tabela.versao,
    };
  } catch (e) {
    if (e instanceof RangeError) return { situacao: 'erro', mensagem: e.message, campos: {} };
    Sentry.captureException(e);
    return {
      situacao: 'erro',
      mensagem: 'Não foi possível calcular agora. O erro foi registrado.',
      campos: {},
    };
  }
}
