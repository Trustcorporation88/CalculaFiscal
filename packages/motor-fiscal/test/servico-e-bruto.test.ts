import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  avaliarPrecoServico,
  calcularBaseUnificadaNfe,
  calcularTributosRtcItem,
  dec,
  linhaDoTempoServico,
  precificarAno,
  precificarServicoAno,
  precoPsicologico,
  reconstruirCompra,
  type EntradaServico,
  type ParametrosAno,
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

describe('premissa do fornecedor: preço bruto x preço líquido', () => {
  it('em 2026 fecha a mesma nota; de 2027 em diante o preço bruto fica acima do preço líquido quando havia PIS/Cofins ou IPI', () => {
    const bruto = { ...COCA_FABRICANTE, modoFornecedor: 'PRECO_BRUTO' as const };
    expect(reconstruirCompra(bruto, ANO_2026, []).totalNota.toFixed(2)).toBe('4.89');

    const mem27: never[] = [];
    const cLiquido27 = reconstruirCompra(COCA_FABRICANTE, ANO_2027, []);
    const cBruto27 = reconstruirCompra(bruto, ANO_2027, mem27);
    expect(cBruto27.totalNota.gt(cLiquido27.totalNota)).toBe(true);
    expect(mem27.some((m: { id: string }) => m.id === 'compra.fornecedor-bruto')).toBe(true);

    // Só IPI extinto: o antigo IPI (0,11) entra no valor da operação (4,41 -> 4,52).
    const comPecIpi: ParametrosAno = { ...ANO_2027, ipiVigente: true };
    const soIpiExtinto: ParametrosAno = { ...ANO_2026, ipiVigente: false };
    expect(reconstruirCompra(bruto, comPecIpi, []).totalNota.gt(cLiquido27.totalNota)).toBe(true);
    expect(reconstruirCompra(bruto, soIpiExtinto, []).precoFornecedor.toFixed(2)).toBe('4.52');

    const vLiquido = calculado(
      precificarAno({ fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_SIMPLES }, ANO_2027),
    );
    const vBruto = calculado(
      precificarAno({ fornecimento: bruto, perfil: DISTRIBUIDORA_SIMPLES }, ANO_2027),
    );
    expect(Number(vBruto.precoComTributo)).toBeGreaterThan(Number(vLiquido.precoComTributo));
    // Mesmo sem repasse algum do fabricante, o preço no Simples continua abaixo dos R$ 11,51 do cálculo errado.
    expect(Number(vBruto.precoComTributo)).toBeLessThan(11.51);
  });
});

describe('precificação de serviços (transição do ISS 2026-2033 e reduções de 30% e 60%)', () => {
  const CONTABILIDADE_PRESUMIDO: EntradaServico = {
    custos: {
      custoDireto: '500.00',
      parcelaInsumosTributados: '0.20',
      aliquotaPisCofinsInsumos: '0.0925',
    },
    perfil: {
      regime: 'PRESUMIDO',
      aliquotaIssSaida: '0.05',
      aliquotaPisCofinsSaida: '0.0365',
      creditoPisCofinsEntrada: '0',
      aliquotaDas: null,
      parcelaCbsIbsNoDas: null,
      despesasVariaveis: '0.08',
      margem: '0.25',
      baseMargem: 'PRECO_COM_TRIBUTO',
    },
  };

  it('escritório contábil no Presumido com redução de 30% (art. 127, cClassTrib 200052): ISS cai até zerar em 2033 e insumos creditam CBS/IBS integral', () => {
    const p2027: ParametrosAno = { ...ANO_2027, aliquotaIs: '0', reducaoCbsIbs: '0.3' };
    const p2030: ParametrosAno = {
      ...ANO_2027,
      ano: 2030,
      fatorIcms: '0.8',
      ibs: '0.0334',
      aliquotaIs: '0',
      reducaoCbsIbs: '0.3',
    };
    const p2033: ParametrosAno = { ...ANO_2033, aliquotaIs: '0', reducaoCbsIbs: '0.3' };

    const linha = linhaDoTempoServico(CONTABILIDADE_PRESUMIDO, [ANO_2026, p2027, p2030, p2033]);
    const [v26, v27, v30, v33] = linha.map(calculado);

    // 2026: ISS 5% + PIS/Cofins 3,65% por dentro, sem CBS/IBS
    expect(Number(v26!.iss)).toBeGreaterThan(0);
    expect(Number(v26!.pisCofins)).toBeGreaterThan(0);
    expect(v26!.cbs).toBe('0.00');
    expect(v26!.icms).toBe('0.00');

    // 2027: PIS/Cofins sai, ISS continua integral (5%), entra CBS/IBS reduzido em 30% por fora e crédito integral nos 20% de insumos
    expect(v27!.pisCofins).toBe('0.00');
    expect(Number(v27!.iss)).toBeGreaterThan(0);
    expect(Number(v27!.cbs)).toBeGreaterThan(0);
    expect(v27!.creditoTransferido).toBe(dec(v27!.cbs).plus(v27!.ibs).toFixed(2));
    expect(Number(v27!.custoLiquido)).toBeLessThan(500);

    // 2030: ISS a 80% (4%); 2033: ISS extinto (0,00)
    expect(Number(v30!.iss)).toBeLessThan(Number(v27!.iss));
    expect(v33!.iss).toBe('0.00');

    // Confronto com o oráculo oficial da Receita Federal em 2030 (natureza servico, deduzindo vISSQN)
    const baseRfb = calcularBaseUnificadaNfe({
      anoFatoGerador: 2030,
      tipoDocumento: 55,
      natureza: 'servico',
      vProd: v30!.preco,
      vISSQN: v30!.iss,
    });
    const oraculo = calcularTributosRtcItem({
      baseSemIs: baseRfb.baseRGMoeda,
      aliquotaCbs: p2030.cbs,
      aliquotaIbsUf: '0.0167',
      aliquotaIbsMun: '0.0167',
      reducao: '0.3',
    });
    expect(dec(v30!.cbs).minus(oraculo.vCBS).abs().lte('0.01')).toBe(true);
    expect(dec(v30!.ibs).minus(oraculo.vIBS).abs().lte('0.01')).toBe(true);
  });

  it('Lucro Real com crédito de PIS/Cofins em 2026, base RECEITA_LIQUIDA e fornecedor mantendo preço bruto', () => {
    const realBruto: EntradaServico = {
      custos: {
        ...CONTABILIDADE_PRESUMIDO.custos,
        modoFornecedor: 'PRECO_BRUTO',
      },
      perfil: {
        ...CONTABILIDADE_PRESUMIDO.perfil,
        regime: 'REAL',
        aliquotaPisCofinsSaida: '0.0925',
        creditoPisCofinsEntrada: '0.0925',
        baseMargem: 'RECEITA_LIQUIDA',
      },
    };
    const v26 = calculado(precificarServicoAno(realBruto, ANO_2026));
    expect(Number(v26.custoLiquido)).toBeLessThan(500);
    expect(Number(v26.margemSobreReceitaLiquida)).toBeCloseTo(0.25, 2);

    const v27 = calculado(precificarServicoAno(realBruto, { ...ANO_2027, aliquotaIs: '0' }));
    // Com PRECO_BRUTO nos insumos e crédito integral de CBS/IBS no Lucro Real, o custo líquido fica em 500,00.
    expect(v27.custoLiquido).toBe('500.00');
  });

  it('Simples Nacional em serviços: DAS incorpora CBS/IBS dos insumos no custo, e Simples regular exige partilha', () => {
    const simplesDas: EntradaServico = {
      custos: CONTABILIDADE_PRESUMIDO.custos,
      perfil: {
        ...CONTABILIDADE_PRESUMIDO.perfil,
        regime: 'SIMPLES_DAS',
        aliquotaDas: '0.10',
        parcelaCbsIbsNoDas: null,
      },
    };
    const v26 = calculado(precificarServicoAno(simplesDas, ANO_2026));
    expect(v26.creditoTransferido).toBe('0.00');
    expect(v26.cbs).toBe('0.00');

    const v27SemParcela = calculado(
      precificarServicoAno(simplesDas, { ...ANO_2027, aliquotaIs: '0' }),
    );
    expect(v27SemParcela.creditoTransferido).toBeNull();
    // No Simples (DAS), CBS/IBS dos insumos não creditam e entram no custo líquido.
    expect(v27SemParcela.custoLiquido).toBe(v27SemParcela.totalNotaCompra);

    const v27ComParcela = calculado(
      precificarServicoAno(
        {
          ...simplesDas,
          perfil: { ...simplesDas.perfil, parcelaCbsIbsNoDas: '0.25' },
        },
        { ...ANO_2027, aliquotaIs: '0' },
      ),
    );
    expect(Number(v27ComParcela.creditoTransferido)).toBeGreaterThan(0);

    // Simples regular sem partilha -> DADO_PENDENTE em 2027, CALCULADO em 2026; com partilha -> CALCULADO
    const simplesRegular: EntradaServico = {
      ...simplesDas,
      perfil: { ...simplesDas.perfil, regime: 'SIMPLES_REGULAR' },
    };
    expect(precificarServicoAno(simplesRegular, ANO_2026).situacao).toBe('CALCULADO');
    expect(precificarServicoAno(simplesRegular, { ...ANO_2027, aliquotaIs: '0' }).situacao).toBe(
      'DADO_PENDENTE',
    );
    expect(
      avaliarPrecoServico(simplesRegular, { ...ANO_2027, aliquotaIs: '0' }, '900').situacao,
    ).toBe('DADO_PENDENTE');
    const regComParcela = calculado(
      precificarServicoAno(
        {
          ...simplesRegular,
          perfil: { ...simplesRegular.perfil, parcelaCbsIbsNoDas: '0.25' },
        },
        { ...ANO_2027, aliquotaIs: '0' },
      ),
    );
    expect(Number(regComParcela.cbs)).toBeGreaterThan(0);
  });

  it('avaliarPrecoServico devolve os mesmos valores no preço calculado e maior margem no preço psicológico', () => {
    const p2027: ParametrosAno = { ...ANO_2027, aliquotaIs: '0', reducaoCbsIbs: '0.3' };
    const v = calculado(precificarServicoAno(CONTABILIDADE_PRESUMIDO, p2027));
    expect(
      calculado(avaliarPrecoServico(CONTABILIDADE_PRESUMIDO, p2027, v.precoComTributo)),
    ).toEqual(v);
    const sugerido = precoPsicologico(v.precoComTributo);
    const vs = calculado(avaliarPrecoServico(CONTABILIDADE_PRESUMIDO, p2027, sugerido));
    expect(dec(vs.precoComTributo).lte(sugerido)).toBe(true);
    expect(dec(vs.precoComTributo).gte(dec(sugerido).minus('0.02'))).toBe(true);
    expect(Number(vs.margemSobrePrecoComTributo)).toBeGreaterThan(
      Number(v.margemSobrePrecoComTributo),
    );

    // Também no Simples (porFora = 0)
    const simples: EntradaServico = {
      ...CONTABILIDADE_PRESUMIDO,
      perfil: { ...CONTABILIDADE_PRESUMIDO.perfil, regime: 'SIMPLES_DAS', aliquotaDas: '0.06' },
    };
    expect(calculado(avaliarPrecoServico(simples, p2027, '799.90')).precoComTributo).toBe('799.90');
  });

  it('rejeita entradas inválidas de serviço', () => {
    const base = CONTABILIDADE_PRESUMIDO;
    expect(() =>
      precificarServicoAno({ ...base, custos: { ...base.custos, custoDireto: '0' } }, ANO_2026),
    ).toThrow(/custo direto/);
    expect(() =>
      precificarServicoAno(
        { ...base, custos: { ...base.custos, parcelaInsumosTributados: '1.2' } },
        ANO_2026,
      ),
    ).toThrow(/parcela de insumos/);
    expect(() =>
      precificarServicoAno(
        { ...base, custos: { ...base.custos, aliquotaPisCofinsInsumos: '1' } },
        ANO_2026,
      ),
    ).toThrow(/PIS\/Cofins dos insumos/);
    expect(() =>
      precificarServicoAno(
        { ...base, perfil: { ...base.perfil, regime: 'SIMPLES_DAS', aliquotaDas: null } },
        ANO_2026,
      ),
    ).toThrow(/alíquota efetiva do DAS/);
    expect(() =>
      precificarServicoAno(
        {
          ...base,
          perfil: {
            ...base.perfil,
            regime: 'SIMPLES_DAS',
            aliquotaDas: '0.08',
            parcelaCbsIbsNoDas: '1.5',
          },
        },
        ANO_2027,
      ),
    ).toThrow(/entre 0 e 1/);
    expect(() =>
      precificarServicoAno({ ...base, perfil: { ...base.perfil, margem: '0.95' } }, ANO_2026),
    ).toThrow(/divisor/);
    expect(() => avaliarPrecoServico(base, ANO_2026, '0')).toThrow(/maior que zero/);
  });

  it('propriedade: em serviços o preço nunca cai quando o ISS ou a CBS sobem', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 200_000 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 20, max: 50 }),
        fc.integer({ min: 1, max: 40 }),
        (centavos, insPct, issMil, deltaMil) => {
          const e: EntradaServico = {
            custos: {
              custoDireto: (centavos / 100).toFixed(2),
              parcelaInsumosTributados: (insPct / 100).toFixed(2),
              aliquotaPisCofinsInsumos: '0.0925',
            },
            perfil: {
              ...CONTABILIDADE_PRESUMIDO.perfil,
              aliquotaIssSaida: (issMil / 1000).toString(),
            },
          };
          const p1: ParametrosAno = { ...ANO_2027, aliquotaIs: '0', reducaoCbsIbs: '0.3' };
          const p2: ParametrosAno = {
            ...p1,
            cbs: dec(p1.cbs)
              .plus(deltaMil / 1000)
              .toString(),
          };
          const v1 = calculado(precificarServicoAno(e, p1));
          const v2 = calculado(precificarServicoAno(e, p2));
          expect(dec(v2.precoComTributo).gte(v1.precoComTributo)).toBe(true);
        },
      ),
    );
  });
});
