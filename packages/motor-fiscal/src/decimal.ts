import Decimal from 'decimal.js';

/** Instância isolada: precisão alta, sem arredondamento implícito relevante. */
export const D = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

/** Arredondamento monetário de tributos atuais e preço: 2 casas, meio para cima. */
export function arredondarMoeda(valor: Dec): Dec {
  return valor.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/**
 * Arredondamento intermediário da Calculadora de Tributos da Receita Federal (ArredondamentoUtils):
 * 8 casas decimais, HALF_EVEN (arredondamento bancário; LC 214/2025, art. 349, § 14).
 */
export function arredondarInternoRtc(valor: Dec): Dec {
  return valor.toDecimalPlaces(8, D.ROUND_HALF_EVEN);
}

/**
 * Arredondamento monetário de apresentação da Calculadora da Receita Federal:
 * 2 casas decimais, HALF_EVEN (LC 214/2025, art. 349, § 14).
 */
export function arredondarMoedaRtc(valor: Dec): Dec {
  return valor.toDecimalPlaces(2, D.ROUND_HALF_EVEN);
}

/** Converte string decimal no formato da API (ponto como separador), com validação. */
export function dec(valor: string): Dec {
  if (!/^-?\d+(\.\d+)?$/.test(valor)) {
    throw new RangeError(`Valor decimal inválido: "${valor}"`);
  }
  return new D(valor);
}
