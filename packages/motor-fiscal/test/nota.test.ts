import { describe, expect, it } from 'vitest';
import { precoLiquidoPelaNota, reconstruirCompra } from '../src/index.js';
import { ANO_2026, COCA_FABRICANTE } from './fixtures.js';

const { precoLiquido: _, ...semPreco } = COCA_FABRICANTE;

describe('preço líquido a partir do total da nota', () => {
  it('Coca-Cola: a nota de R$ 4,89 de 2026 remonta exatamente', () => {
    const r = precoLiquidoPelaNota(semPreco, '4.89', ANO_2026);
    expect(r.totalRemontado).toBe('4.89');
    expect(r.precoLiquido).toBe('3.050');
    expect(
      reconstruirCompra(
        { ...semPreco, precoLiquido: r.precoLiquido },
        ANO_2026,
        [],
      ).totalNota.toFixed(2),
    ).toBe('4.89');
    expect(r.memoria.resultado).toBe(r.precoLiquido);
    // A faixa inclui o 3,040 do caso documentado e o valor escolhido.
    expect(Number(r.faixa.de)).toBeLessThanOrEqual(3.04);
    expect(Number(r.faixa.ate)).toBeGreaterThanOrEqual(3.05);
    for (const l of [r.faixa.de, r.faixa.ate]) {
      expect(
        reconstruirCompra({ ...semPreco, precoLiquido: l }, ANO_2026, []).totalNota.toFixed(2),
      ).toBe('4.89');
    }
  });

  it('sem tributo nenhum, o preço líquido é a própria nota', () => {
    const r = precoLiquidoPelaNota(
      {
        aliquotaIcms: '0',
        aliquotaIpi: '0',
        aliquotaPisCofins: '0',
        substituicaoTributaria: null,
        freteEDespesas: '0',
      },
      '10.00',
      ANO_2026,
    );
    expect(r.precoLiquido).toBe('10.000');
    expect(r.totalRemontado).toBe('10.00');
  });

  it('quando nenhum preço fecha a nota no centavo, devolve o mais próximo', () => {
    // Frete maior que a nota: nem com preço líquido zero o total cai até ela.
    const r = precoLiquidoPelaNota({ ...semPreco, freteEDespesas: '1.00' }, '0.50', ANO_2026);
    expect(r.precoLiquido).toBe('0.000');
    expect(Number(r.totalRemontado)).toBeGreaterThan(0.5);
    expect(r.faixa).toEqual({ de: '0.000', ate: '0.000' });
  });

  it('acha o mais próximo quando o arredondamento pula o centavo pedido', () => {
    const f = { ...semPreco, aliquotaIpi: '0.9', substituicaoTributaria: null };
    let pulado: string | undefined;
    for (let c = 100; c < 400 && !pulado; c++) {
      const alvo = (c / 100).toFixed(2);
      if (precoLiquidoPelaNota(f, alvo, ANO_2026).totalRemontado !== alvo) pulado = alvo;
    }
    expect(pulado).toBeDefined();
    const r = precoLiquidoPelaNota(f, pulado as string, ANO_2026);
    expect(Math.abs(Number(r.totalRemontado) - Number(pulado))).toBeLessThanOrEqual(0.0100001);
  });

  it('com faixa estreita, sem centavo inteiro, usa o milésimo do meio', () => {
    const f = { ...semPreco, aliquotaIpi: '0.9', substituicaoTributaria: null };
    const quebrados = ['1.00', '1.37', '2.11', '3.53', '4.89'].map(
      (alvo) => precoLiquidoPelaNota(f, alvo, ANO_2026).precoLiquido,
    );
    expect(quebrados.some((l) => !l.endsWith('0'))).toBe(true);
  });

  it('rejeita nota zerada ou negativa', () => {
    expect(() => precoLiquidoPelaNota(semPreco, '0', ANO_2026)).toThrow(RangeError);
  });
});
