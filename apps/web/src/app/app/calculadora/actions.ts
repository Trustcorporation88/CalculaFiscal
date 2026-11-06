'use server';

import * as Sentry from '@sentry/nextjs';
import { tabelaOficial } from '@calculafiscal/regras';
import { calcularLinhaDoTempo, type ResultadoCalculadora } from '@/lib/calculadora/calcular';
import { lerEntrada, type ValoresFormulario } from '@/lib/calculadora/entrada';
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

  const valores: ValoresFormulario = Object.fromEntries(
    [...dados.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']),
  );
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
