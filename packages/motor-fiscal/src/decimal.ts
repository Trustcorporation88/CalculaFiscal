import Decimal from 'decimal.js';

/** Instância isolada: precisão alta, sem arredondamento implícito relevante. */
export const D = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

/** Arredondamento monetário explícito: 2 casas, meio para cima. Regra a confirmar contra as NTs da RTC. */
export function arredondarMoeda(valor: Dec): Dec {
  return valor.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** Converte string decimal no formato da API (ponto como separador), com validação. */
export function dec(valor: string): Dec {
  if (!/^-?\d+(\.\d+)?$/.test(valor)) {
    throw new RangeError(`Valor decimal inválido: "${valor}"`);
  }
  return new D(valor);
}
