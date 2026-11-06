import { arredondarMoeda, D, dec } from './decimal.js';
import type { PassoMemoria } from './memoria.js';

/**
 * "Cálculo simplificado": markup divisor com o imposto por dentro, como o mercado faz hoje.
 * Existe para reproduzir e explicar o erro, nunca como recomendação de preço.
 * Percentuais em fração decimal: "0.06" = 6%.
 */
export interface EntradaSimplificada {
  readonly custo: string;
  readonly despesasVariaveis: string;
  readonly imposto: string;
  readonly margem: string;
}

export interface ResultadoSimplificado {
  readonly preco: string;
  readonly precoSemArredondar: string;
  readonly memoria: readonly PassoMemoria[];
}

export function precoSimplificado(e: EntradaSimplificada): ResultadoSimplificado {
  const custo = dec(e.custo);
  if (custo.isNegative()) {
    throw new RangeError('O custo não pode ser negativo.');
  }
  const soma = dec(e.despesasVariaveis).plus(dec(e.imposto)).plus(dec(e.margem));
  const divisor = new D(1).minus(soma);
  if (divisor.lte(0)) {
    throw new RangeError('A soma de despesas, imposto e margem precisa ser menor que 100%.');
  }
  const bruto = custo.div(divisor);
  const preco = arredondarMoeda(bruto);
  return {
    preco: preco.toFixed(2),
    precoSemArredondar: bruto.toString(),
    memoria: [
      {
        id: 'simplificado.divisor',
        descricao: 'Divisor do markup por dentro',
        formula: '1 - (despesas + imposto + margem)',
        entradas: { despesas: e.despesasVariaveis, imposto: e.imposto, margem: e.margem },
        resultado: divisor.toString(),
        regras: [],
      },
      {
        id: 'simplificado.preco',
        descricao: 'Preço pelo cálculo simplificado',
        formula: 'custo / divisor',
        entradas: { custo: e.custo, divisor: divisor.toString() },
        resultado: preco.toFixed(2),
        regras: [],
      },
    ],
  };
}
