import { describe, expect, it } from 'vitest';
import {
  calcular,
  CONFIG_INICIAL,
  numero,
  pendenciasConfig,
  type ConfigEmpresa,
  type ResultadoAnoApp,
} from '../src/calculo';

const SIMPLES: ConfigEmpresa = { ...CONFIG_INICIAL, aliquotaDas: '8', despesas: '6' };
const REAL: ConfigEmpresa = {
  ...CONFIG_INICIAL,
  regime: 'REAL',
  icmsVenda: '0',
  pisCofinsVenda: '0',
  despesas: '6',
};

function ano(r: ReturnType<typeof calcular>, a: number) {
  if (!r.ok) throw new Error(r.erro);
  const x = r.anos.find((y) => y.ano === a) as ResultadoAnoApp;
  if (x.situacao !== 'calculado') throw new Error('pendente');
  return x;
}

describe('cálculo do app (mesmo motor do site)', () => {
  it('lê números no formato brasileiro', () => {
    expect(numero('4,89')).toBe('4.89');
    expect(numero('R$ 1.234,50')).toBe('1234.50');
    expect(numero('25%')).toBe('25');
    expect(numero('abc')).toBeNull();
  });

  it('pede a configuração antes de calcular', () => {
    expect(pendenciasConfig(CONFIG_INICIAL)).toEqual(['despesas variáveis', 'alíquota do DAS']);
    expect(calcular(CONFIG_INICIAL, '4,89', '25')).toMatchObject({ ok: false });
  });

  it('Simples (DAS 8%): custo 4,89 e margem 25% dão R$ 8,02 em 2026, como no site', () => {
    const r = calcular(SIMPLES, '4,89', '25');
    const a2026 = ano(r, 2026);
    expect(a2026.clientePaga).toBe('8.02');
    expect(a2026.impostos).toEqual([{ sigla: 'DAS', valor: '0.64' }]);
    expect(a2026.sugerido).toBe('8.49');
    // O custo informado é o custo líquido em todos os anos (CBS/IBS da compra embutidos nele).
    for (const a of [2027, 2030, 2033]) expect(Number(ano(r, a).custo)).toBeCloseTo(4.89, 2);
  });

  it('Lucro Real: CBS e IBS destacados de 2027 em diante e custo líquido mantido', () => {
    const r = calcular(REAL, '4,89', '25');
    expect(ano(r, 2026).clientePaga).toBe('7.09');
    const a2033 = ano(r, 2033);
    expect(a2033.custo).toBe('4.89');
    expect(a2033.impostos.map((i) => i.sigla)).toEqual(['CBS', 'IBS']);
    expect(Number(a2033.margemSobrePreco)).toBeCloseTo(0.25, 2);
    expect(Number(a2033.pesoImpostos)).toBeGreaterThan(0.2);
  });

  it('cesta básica (alíquota zero): sem CBS e IBS no Lucro Real', () => {
    const r = calcular({ ...REAL, tratamento: '200003' }, '22,50', '25');
    expect(ano(r, 2033).impostos).toEqual([]);
  });

  it('recusa custo vazio e margem de 100% ou mais', () => {
    expect(calcular(SIMPLES, '', '25')).toMatchObject({ ok: false });
    expect(calcular(SIMPLES, '4,89', '100')).toMatchObject({ ok: false });
  });
});
