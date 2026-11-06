import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  avaliarPreco,
  dec,
  precificarAno,
  precoPsicologico,
  type PerfilVenda,
  type ResultadoAno,
  type Valores,
} from '../src/index.js';
import {
  ANO_2026,
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

describe('preço psicológico', () => {
  it('arredonda para cima até o próximo final comercial', () => {
    expect(precoPsicologico('7.09')).toBe('7.49');
    expect(precoPsicologico('7.49')).toBe('7.49');
    expect(precoPsicologico('7.50')).toBe('7.90');
    expect(precoPsicologico('7.95')).toBe('7.99');
    expect(precoPsicologico('9.995')).toBe('10.90');
    expect(precoPsicologico('12.34')).toBe('12.90');
    expect(precoPsicologico('12.95')).toBe('12.99');
    expect(precoPsicologico('99.991')).toBe('109.90');
    expect(precoPsicologico('123.45')).toBe('129.90');
    expect(precoPsicologico('129.95')).toBe('139.90');
    expect(precoPsicologico('1234.56')).toBe('1239.90');
  });

  it('nunca fica abaixo do preço e sobe no máximo pouco mais de R$ 10', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (centavos) => {
        const v = (centavos / 100).toFixed(2);
        const s = Number(precoPsicologico(v));
        return s >= Number(v) && s - Number(v) < 10.01;
      }),
    );
  });

  it('rejeita preço zerado', () => {
    expect(() => precoPsicologico('0')).toThrow(RangeError);
  });
});

describe('margem num preço escolhido', () => {
  const real = { fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_REAL };

  it('avaliar o preço calculado devolve os mesmos valores', () => {
    for (const ano of [ANO_2026, ANO_2027, ANO_2033]) {
      const v = calculado(precificarAno(real, ano));
      const a = calculado(avaliarPreco(real, ano, v.precoComTributo));
      expect(a).toEqual(v);
    }
  });

  it('preço psicológico acima do calculado aumenta a margem', () => {
    const v = calculado(precificarAno(real, ANO_2027));
    const sugerido = precoPsicologico(v.precoComTributo);
    const a = calculado(avaliarPreco(real, ANO_2027, sugerido));
    expect(a.precoComTributo).toBe(sugerido);
    expect(Number(a.margemSobrePrecoComTributo)).toBeGreaterThan(
      Number(v.margemSobrePrecoComTributo),
    );
    const r = avaliarPreco(real, ANO_2027, sugerido);
    expect(r.memoria.some((m) => m.id === 'venda.preco-informado')).toBe(true);
  });

  it('o cliente nunca paga mais que o preço escolhido, nem 1 centavo a menos sem motivo', () => {
    const perfil: PerfilVenda = {
      ...DISTRIBUIDORA_REAL,
      aliquotaIcmsSaida: '0.18',
      aliquotaPisCofinsSaida: '0.0925',
    };
    fc.assert(
      fc.property(fc.integer({ min: 600, max: 5_000 }), (centavos) => {
        const alvo = (centavos / 100).toFixed(2);
        const v = calculado(
          avaliarPreco({ fornecimento: COCA_FABRICANTE, perfil }, ANO_2033, alvo),
        );
        const pago = dec(v.precoComTributo);
        return pago.lte(alvo) && pago.gte(dec(alvo).minus('0.02'));
      }),
    );
  });

  it('Simples no DAS: sem CBS/IBS por fora, o preço é o próprio valor escolhido', () => {
    const a = calculado(
      avaliarPreco(
        { fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_SIMPLES },
        ANO_2027,
        '8.49',
      ),
    );
    expect(a.preco).toBe('8.49');
    expect(a.precoComTributo).toBe('8.49');
  });

  it('dado pendente continua pendente e preço zerado é recusado', () => {
    const regular = {
      fornecimento: COCA_FABRICANTE,
      perfil: { ...DISTRIBUIDORA_SIMPLES, regime: 'SIMPLES_REGULAR' as const },
    };
    expect(avaliarPreco(regular, ANO_2027, '8.49').situacao).toBe('DADO_PENDENTE');
    expect(() => avaliarPreco(real, ANO_2027, '0')).toThrow(RangeError);
  });
});
