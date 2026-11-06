import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  aliquotasCbsIbs,
  avaliarPreco,
  precificarAno,
  reconstruirCompra,
  type ParametrosAno,
  type ResultadoAno,
  type Valores,
} from '../src/index.js';
import {
  ANO_2027,
  ANO_2033,
  COCA_FABRICANTE,
  DISTRIBUIDORA_REAL,
  DISTRIBUIDORA_SIMPLES,
} from './fixtures.js';

function calculado(r: ResultadoAno): Valores {
  if (r.situacao !== 'CALCULADO') throw new Error(`esperava cálculo, veio ${r.situacao}`);
  return r.valores;
}

const com = (p: ParametrosAno, reducaoCbsIbs: string): ParametrosAno => ({ ...p, reducaoCbsIbs });
const real = { fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_REAL };

describe('redução da CBS e do IBS pelo tratamento do produto', () => {
  it('60%: a compra e a venda destacam 40% da CBS e do IBS', () => {
    const cheia = reconstruirCompra(COCA_FABRICANTE, ANO_2033, []);
    const memoria: never[] = [];
    const reduzida = reconstruirCompra(COCA_FABRICANTE, com(ANO_2033, '0.6'), memoria);
    expect(Number(reduzida.cbs)).toBeCloseTo(Number(cheia.cbs) * 0.4, 2);
    expect(Number(reduzida.ibs)).toBeCloseTo(Number(cheia.ibs) * 0.4, 2);

    const v = calculado(precificarAno(real, com(ANO_2033, '0.6')));
    const ef = aliquotasCbsIbs(com(ANO_2033, '0.6'));
    expect(ef.cbs.toString()).toBe('0.0452');
    expect(Number(v.cbs)).toBeGreaterThan(0);
    expect(Number(v.margemSobrePrecoComTributo)).toBeCloseTo(0.25, 2);
  });

  it('alíquota zero: nada de CBS e IBS na compra nem na venda, e nenhum crédito ao cliente', () => {
    const c = reconstruirCompra(COCA_FABRICANTE, com(ANO_2027, '1'), []);
    expect(c.cbs.isZero() && c.ibs.isZero()).toBe(true);
    const v = calculado(precificarAno(real, com(ANO_2027, '1')));
    expect(v.cbs).toBe('0.00');
    expect(v.ibs).toBe('0.00');
    expect(v.precoComTributo).toBe(v.preco);
    expect(v.creditoTransferido).toBe('0.00');
    // Sem CBS/IBS por fora, o preço escolhido é o próprio preço.
    expect(calculado(avaliarPreco(real, com(ANO_2027, '1'), '7.49')).preco).toBe('7.49');
  });

  it('sem o campo, a tributação é integral (mesmo resultado de antes)', () => {
    expect(precificarAno(real, com(ANO_2033, '0'))).toEqual(precificarAno(real, ANO_2033));
  });

  it('com redução maior, o cliente nunca paga mais (regime regular e Simples)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 1, max: 100 }),
        fc.boolean(),
        (a, delta, simples) => {
          const r1 = (a / 100).toString();
          const r2 = (Math.min(100, a + delta) / 100).toString();
          const perfil = simples ? DISTRIBUIDORA_SIMPLES : DISTRIBUIDORA_REAL;
          const e = { fornecimento: COCA_FABRICANTE, perfil };
          const p1 = calculado(precificarAno(e, com(ANO_2033, r1))).precoComTributo;
          const p2 = calculado(precificarAno(e, com(ANO_2033, r2))).precoComTributo;
          return Number(p2) <= Number(p1);
        },
      ),
    );
  });

  it('rejeita redução fora de 0 a 1', () => {
    expect(() => precificarAno(real, com(ANO_2033, '1.5'))).toThrow(RangeError);
    expect(() => reconstruirCompra(COCA_FABRICANTE, com(ANO_2033, '-0.1'), [])).toThrow(RangeError);
  });
});
