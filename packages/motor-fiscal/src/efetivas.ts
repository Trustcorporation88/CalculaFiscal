import { D, dec, type Dec } from './decimal.js';
import type { ParametrosAno } from './tipos.js';

/** CBS e IBS do ano já com a redução do tratamento do produto (cClassTrib). */
export function aliquotasCbsIbs(p: ParametrosAno): { cbs: Dec; ibs: Dec; reducao: Dec } {
  const reducao = dec(p.reducaoCbsIbs ?? '0');
  if (reducao.isNegative() || reducao.gt(1)) {
    throw new RangeError('A redução da CBS e do IBS é uma fração entre 0 e 1.');
  }
  const fator = new D(1).minus(reducao);
  return { cbs: dec(p.cbs).times(fator), ibs: dec(p.ibs).times(fator), reducao };
}
