import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arredondarMoeda, D, dec, precoSimplificado, VERSAO_MOTOR } from '../src/index.js';

describe('caso de aceite: Coca-Cola 600 ml no cálculo simplificado', () => {
  it('reproduz R$ 8,02 (hoje, imposto de 8%)', () => {
    const r = precoSimplificado({
      custo: '4.89',
      despesasVariaveis: '0.06',
      imposto: '0.08',
      margem: '0.25',
    });
    expect(r.preco).toBe('8.02');
    expect(r.memoria).toHaveLength(2);
    expect(VERSAO_MOTOR).toBe('0.1.0');
  });

  it('reproduz R$ 11,51 (concorrente com 26,5% de IBS+CBS)', () => {
    const r = precoSimplificado({
      custo: '4.89',
      despesasVariaveis: '0.06',
      imposto: '0.265',
      margem: '0.25',
    });
    expect(r.preco).toBe('11.51');
  });
});

describe('validações', () => {
  it('rejeita soma de percentuais igual ou acima de 100%', () => {
    expect(() =>
      precoSimplificado({ custo: '1', despesasVariaveis: '0.5', imposto: '0.25', margem: '0.25' }),
    ).toThrow(RangeError);
  });
  it('rejeita custo negativo', () => {
    expect(() =>
      precoSimplificado({ custo: '-1', despesasVariaveis: '0', imposto: '0', margem: '0' }),
    ).toThrow(RangeError);
  });
  it('rejeita string decimal com vírgula', () => {
    expect(() => dec('8,02')).toThrow(RangeError);
  });
  it('arredonda meio para cima', () => {
    expect(arredondarMoeda(new D('0.005')).toFixed(2)).toBe('0.01');
  });
});

describe('propriedades', () => {
  const pct = fc.integer({ min: 0, max: 300 }).map((n) => (n / 1000).toString());
  const custo = fc.integer({ min: 0, max: 10_000_000 }).map((n) => (n / 100).toFixed(2));

  it('o preço nunca cai quando o imposto sobe', () => {
    fc.assert(
      fc.property(custo, pct, pct, pct, fc.integer({ min: 1, max: 50 }), (c, d, i, m, delta) => {
        const base = { custo: c, despesasVariaveis: d, margem: m };
        const iMaior = dec(i)
          .plus(delta / 1000)
          .toString();
        const p1 = dec(precoSimplificado({ ...base, imposto: i }).precoSemArredondar);
        const p2 = dec(precoSimplificado({ ...base, imposto: iMaior }).precoSemArredondar);
        expect(p2.gte(p1)).toBe(true);
      }),
    );
  });

  it('a soma dos componentes fecha com o preço', () => {
    fc.assert(
      fc.property(custo, pct, pct, pct, (c, d, i, m) => {
        const r = precoSimplificado({ custo: c, despesasVariaveis: d, imposto: i, margem: m });
        const p = dec(r.precoSemArredondar);
        const soma = dec(c).plus(p.times(dec(d).plus(dec(i)).plus(dec(m))));
        expect(soma.minus(p).abs().lt('1e-20')).toBe(true);
      }),
    );
  });
});
