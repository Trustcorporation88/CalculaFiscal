import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  apurarCreditos,
  dec,
  linhaDoTempo,
  precificarAno,
  reconstruirCompra,
  statusDoAno,
  type Fornecimento,
  type ParametrosAno,
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

describe('caso Coca-Cola: reconstrução da compra', () => {
  it('2026 fecha a nota em R$ 4,89 (ICMS-ST, IPI e PIS/Cofins monofásico embutidos)', () => {
    const c = reconstruirCompra(COCA_FABRICANTE, ANO_2026, []);
    expect(c.totalNota.toFixed(2)).toBe('4.89');
    expect(c.precoFornecedor.toFixed(2)).toBe('4.41');
    expect(c.pisCofins.toFixed(2)).toBe('0.57');
    expect(c.ipi.toFixed(2)).toBe('0.11');
    expect(c.icmsSt.toFixed(2)).toBe('0.37');
    expect(c.cbs.isZero() && c.ibs.isZero()).toBe(true);
  });

  it('2027: PIS/Cofins e IPI saem, entra IS embutido e CBS/IBS destacados', () => {
    const c = reconstruirCompra(COCA_FABRICANTE, ANO_2027, []);
    expect(c.pisCofins.isZero()).toBe(true);
    expect(c.ipi.isZero()).toBe(true);
    expect(c.is.toFixed(2)).toBe('0.08');
    expect(c.cbs.gt(0)).toBe(true);
  });

  it('2033: ICMS próprio e ST zerados', () => {
    const c = reconstruirCompra(COCA_FABRICANTE, ANO_2033, []);
    expect(c.icmsProprio.isZero()).toBe(true);
    expect(c.icmsSt.isZero()).toBe(true);
  });
});

describe('caso Coca-Cola: preço da distribuidora', () => {
  it('2026 no regime regular: sem imposto na revenda (ST e monofásico), preço R$ 7,09, não R$ 8,02', () => {
    const v = calculado(
      precificarAno({ fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_REAL }, ANO_2026),
    );
    expect(v.custoLiquido).toBe('4.89');
    expect(v.preco).toBe('7.09');
    expect(v.precoComTributo).toBe('7.09');
    expect(Number(v.margemSobrePrecoComTributo)).toBeCloseTo(0.25, 2);
  });

  it('2027 no regime regular: CBS/IBS da compra viram crédito e o IS fica no custo', () => {
    const memoria: never[] = [];
    const c = reconstruirCompra(COCA_FABRICANTE, ANO_2027, memoria);
    const cr = apurarCreditos(c, DISTRIBUIDORA_REAL, ANO_2027, memoria);
    expect(cr.cbs.toString()).toBe(c.cbs.toString());
    expect(cr.total.lt(c.totalNota)).toBe(true);
    const v = calculado(
      precificarAno({ fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_REAL }, ANO_2027),
    );
    expect(Number(v.cbs)).toBeGreaterThan(0);
    expect(v.creditoTransferido).toBe((Number(v.cbs) + Number(v.ibs)).toFixed(2));
    expect(Number(v.margemSobrePrecoComTributo)).toBeCloseTo(0.25, 2);
  });

  it('Simples no DAS: CBS/IBS da compra viram custo e o crédito transferido é PENDENTE', () => {
    const v26 = calculado(
      precificarAno({ fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_SIMPLES }, ANO_2026),
    );
    expect(v26.creditoTransferido).toBe('0.00');
    const v27 = calculado(
      precificarAno({ fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_SIMPLES }, ANO_2027),
    );
    expect(v27.custoLiquido).toBe(v27.totalNotaCompra);
    expect(v27.creditoTransferido).toBeNull();
    expect(v27.cbs).toBe('0.00');
    const comParcela = calculado(
      precificarAno(
        {
          fornecimento: COCA_FABRICANTE,
          perfil: { ...DISTRIBUIDORA_SIMPLES, parcelaCbsIbsNoDas: '0.2' },
        },
        ANO_2027,
      ),
    );
    expect(Number(comParcela.creditoTransferido)).toBeGreaterThan(0);
  });

  it('Simples regular sem a partilha do DAS: não inventa número, devolve DADO_PENDENTE', () => {
    const perfil: PerfilVenda = { ...DISTRIBUIDORA_SIMPLES, regime: 'SIMPLES_REGULAR' };
    const r = precificarAno({ fornecimento: COCA_FABRICANTE, perfil }, ANO_2027);
    expect(r.situacao).toBe('DADO_PENDENTE');
    expect(r.status).toBe('PENDENTE');
    // Em 2026 não há opção efetiva: calcula como DAS.
    expect(precificarAno({ fornecimento: COCA_FABRICANTE, perfil }, ANO_2026).situacao).toBe(
      'CALCULADO',
    );
    const comParcela = calculado(
      precificarAno(
        { fornecimento: COCA_FABRICANTE, perfil: { ...perfil, parcelaCbsIbsNoDas: '0.2' } },
        ANO_2027,
      ),
    );
    expect(Number(comParcela.das)).toBeLessThan(Number(comParcela.preco) * 0.08);
    expect(Number(comParcela.cbs)).toBeGreaterThan(0);
  });
});

describe('outros perfis e validações', () => {
  const semSt: Fornecimento = {
    ...COCA_FABRICANTE,
    substituicaoTributaria: null,
    freteEDespesas: '0.10',
  };
  const varejo: PerfilVenda = {
    ...DISTRIBUIDORA_REAL,
    regime: 'PRESUMIDO',
    aliquotaIcmsSaida: '0.18',
    creditaIcmsEntrada: true,
    aliquotaPisCofinsSaida: '0.0365',
    creditoPisCofinsEntrada: '0.0925',
    baseMargem: 'RECEITA_LIQUIDA',
  };

  it('sem ST credita o ICMS da entrada; margem sobre a receita líquida é atingida', () => {
    const memoria: never[] = [];
    const c = reconstruirCompra(semSt, ANO_2026, memoria);
    expect(c.icmsSt.isZero()).toBe(true);
    expect(apurarCreditos(c, varejo, ANO_2026, memoria).icms.toString()).toBe(
      c.icmsProprio.toString(),
    );
    const v = calculado(precificarAno({ fornecimento: semSt, perfil: varejo }, ANO_2026));
    expect(Number(v.margemSobreReceitaLiquida)).toBeCloseTo(0.25, 2);
    expect(Number(v.icms)).toBeGreaterThan(0);
  });

  it('com ST o ICMS próprio da entrada não credita', () => {
    const c = reconstruirCompra(COCA_FABRICANTE, ANO_2026, []);
    expect(apurarCreditos(c, varejo, ANO_2026, []).icms.isZero()).toBe(true);
  });

  it('ST nunca fica negativa quando o ICMS próprio supera o devido', () => {
    const f: Fornecimento = {
      ...COCA_FABRICANTE,
      substituicaoTributaria: { mva: '0', aliquotaInterna: '0.07' },
    };
    expect(reconstruirCompra(f, ANO_2026, []).icmsSt.isZero()).toBe(true);
  });

  it('rejeita entradas impossíveis', () => {
    expect(() =>
      precificarAno(
        { fornecimento: COCA_FABRICANTE, perfil: { ...DISTRIBUIDORA_SIMPLES, aliquotaDas: null } },
        ANO_2026,
      ),
    ).toThrow(RangeError);
    expect(() =>
      precificarAno(
        { fornecimento: COCA_FABRICANTE, perfil: { ...DISTRIBUIDORA_REAL, margem: '0.95' } },
        ANO_2026,
      ),
    ).toThrow(RangeError);
    expect(() =>
      reconstruirCompra(
        { ...COCA_FABRICANTE, aliquotaIcms: '0.9', aliquotaPisCofins: '0.1' },
        ANO_2026,
        [],
      ),
    ).toThrow(RangeError);
  });

  it('status do ano é o menos firme entre as regras usadas', () => {
    expect(statusDoAno(ANO_2026)).toBe('EM_VIGOR');
    expect(statusDoAno(ANO_2027)).toBe('PENDENTE');
    expect(statusDoAno(ANO_2033)).toBe('ESTIMATIVA');
  });

  it('linha do tempo devolve um resultado por ano, com memória', () => {
    const r = linhaDoTempo({ fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_REAL }, [
      ANO_2026,
      ANO_2027,
      ANO_2033,
    ]);
    expect(r.map((x) => x.ano)).toEqual([2026, 2027, 2033]);
    expect(r.every((x) => x.memoria.length > 0)).toBe(true);
  });
});

describe('propriedades', () => {
  const pct = (max: number) => fc.integer({ min: 0, max }).map((n) => (n / 1000).toString());
  const fornecimento = fc.record({
    precoLiquido: fc.integer({ min: 1, max: 500_000 }).map((n) => (n / 100).toFixed(2)),
    aliquotaIcms: pct(250),
    aliquotaIpi: pct(300),
    aliquotaPisCofins: pct(150),
    substituicaoTributaria: fc.option(fc.record({ mva: pct(1000), aliquotaInterna: pct(250) }), {
      nil: null,
    }),
    freteEDespesas: fc.constant('0'),
  }) as fc.Arbitrary<Fornecimento>;
  const ano = fc
    .record({
      cbs: pct(150),
      ibs: pct(200),
      cbsIbsComEfeito: fc.boolean(),
      fatorIcms: fc.constantFrom('1', '0.9', '0.6', '0'),
      pisCofinsVigente: fc.boolean(),
      ipiVigente: fc.boolean(),
      aliquotaIs: pct(400),
    })
    .map((x): ParametrosAno => ({ ...x, ano: 2030, regras: [] }));
  const perfil = fc
    .record({
      regime: fc.constantFrom('REAL', 'PRESUMIDO', 'SIMPLES_DAS') as fc.Arbitrary<
        PerfilVenda['regime']
      >,
      aliquotaIcmsSaida: pct(200),
      creditaIcmsEntrada: fc.boolean(),
      aliquotaPisCofinsSaida: pct(100),
      creditoPisCofinsEntrada: pct(100),
      despesasVariaveis: pct(100),
      margem: pct(300),
      baseMargem: fc.constantFrom('PRECO_COM_TRIBUTO', 'RECEITA_LIQUIDA') as fc.Arbitrary<
        PerfilVenda['baseMargem']
      >,
    })
    .map((x): PerfilVenda => ({ ...x, aliquotaDas: '0.08', parcelaCbsIbsNoDas: null }));

  it('o crédito nunca supera o tributo destacado e o IS nunca vira crédito', () => {
    fc.assert(
      fc.property(fornecimento, ano, perfil, (f, p, pf) => {
        const c = reconstruirCompra(f, p, []);
        const cr = apurarCreditos(c, pf, p, []);
        expect(cr.cbs.lte(c.cbs) && cr.ibs.lte(c.ibs) && cr.icms.lte(c.icmsProprio)).toBe(true);
        // Tudo que não é IS, ST, IPI ou frete poderia virar crédito; o crédito nunca alcança esses itens.
        expect(
          cr.total.lte(c.totalNota.minus(c.is).minus(c.icmsSt).minus(c.ipi).minus(c.frete)),
        ).toBe(true);
      }),
    );
  });

  it('a margem pedida é atingida e o preço nunca cai quando a CBS sobe', () => {
    fc.assert(
      fc.property(fornecimento, ano, perfil, fc.integer({ min: 1, max: 50 }), (f, p, pf, delta) => {
        const e = { fornecimento: f, perfil: pf };
        let r1: ResultadoAno;
        try {
          r1 = precificarAno(e, p);
        } catch {
          return; // divisor ≤ 0: combinação impossível, rejeitada corretamente
        }
        const v1 = calculado(r1);
        const alvo =
          pf.baseMargem === 'RECEITA_LIQUIDA'
            ? v1.margemSobreReceitaLiquida
            : v1.margemSobrePrecoComTributo;
        if (Number(v1.preco) >= 1)
          expect(Math.abs(Number(alvo) - Number(pf.margem))).toBeLessThan(0.01);
        let r2: ResultadoAno;
        try {
          r2 = precificarAno(e, {
            ...p,
            cbs: dec(p.cbs)
              .plus(delta / 1000)
              .toString(),
          });
        } catch {
          return;
        }
        expect(Number(calculado(r2).precoComTributo)).toBeGreaterThanOrEqual(
          Number(v1.precoComTributo),
        );
      }),
    );
  });
});
