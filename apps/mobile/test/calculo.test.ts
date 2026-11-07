import { describe, expect, it } from 'vitest';
import {
  calcular,
  CONFIG_INICIAL,
  ncmValido,
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

  it('lê o NCM com ou sem pontos e recusa tamanho errado', () => {
    expect(ncmValido('22021000')).toBe('2202.10.00');
    expect(ncmValido(' 2203.00.00 ')).toBe('2203.00.00');
    expect(ncmValido('')).toBe('');
    expect(ncmValido('2202')).toBeNull();
    expect(calcular(REAL, '4,89', '25', { ncm: '2202' })).toMatchObject({ ok: false });
  });

  it('Imposto Seletivo: refrigerante (2202.10.00, 2,6%) a partir de 2027, embutido no custo', () => {
    const r = calcular(REAL, '4,89', '25', { ncm: '2202.10.00' });
    if (!r.ok) throw new Error(r.erro);
    expect(r.seletivo).toBe('incide');
    expect(ano(r, 2026).impostos.find((i) => i.sigla === 'IS')).toBeUndefined();
    const a2027 = ano(r, 2027);
    // 4,89 × 2,6% = 0,127 → R$ 0,13, cobrado do fabricante e repassado no preço da compra.
    expect(a2027.impostos[0]).toEqual({ sigla: 'IS', valor: '0.13' });
    expect(a2027.custo).toBe('4.89');
    // O preço sobe em relação ao mesmo produto sem IS.
    const sem = ano(calcular(REAL, '4,89', '25'), 2027);
    expect(Number(a2027.clientePaga)).toBeGreaterThan(Number(sem.clientePaga));
    // 2028 em diante ainda não tem lei: repete 2027 como estimativa.
    expect(ano(r, 2030).status).toBe('ESTIMATIVA');
    expect(ano(r, 2030).impostos[0]).toEqual({ sigla: 'IS', valor: '0.13' });
  });

  it('Imposto Seletivo: cerveja (2203.00.00, 4,2%) também no Simples', () => {
    const r = calcular(SIMPLES, '4,89', '25', { ncm: '22030000' });
    const a2027 = ano(r, 2027);
    // No Simples não há crédito: o preço líquido do fornecedor é o custo sem a CBS/IBS da nota
    // (cerca de R$ 4,30), e o IS de 4,2% incide sobre ele: R$ 0,18.
    expect(a2027.impostos[0]).toEqual({ sigla: 'IS', valor: '0.18' });
    expect(Number(a2027.custo)).toBeGreaterThanOrEqual(4.89);
  });

  it('NCM sem Imposto Seletivo e cenário sem IS não cobram nada', () => {
    const arroz = calcular(REAL, '22,50', '25', { ncm: '1006.30.21' });
    if (!arroz.ok) throw new Error(arroz.erro);
    expect(arroz.seletivo).toBe('nao-incide');
    const semIs = calcular({ ...REAL, cenario: 'mp-caducada' }, '4,89', '25', {
      ncm: '2202.10.00',
    });
    if (!semIs.ok) throw new Error(semIs.erro);
    expect(semIs.seletivo).toBe('nao-incide');
    expect(ano(semIs, 2027).impostos.map((i) => i.sigla)).not.toContain('IS');
  });
});
