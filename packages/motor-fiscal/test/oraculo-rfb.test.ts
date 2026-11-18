import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  arredondarInternoRtc,
  arredondarMoedaRtc,
  calcularBaseUnificadaNfe,
  calcularItemSimplesNt2026005,
  calcularTributosRtcItem,
  D,
  dec,
  formatarAliquotaRtc,
  precificarAno,
  reconstruirCompra,
  type CodigoTpRbsn,
  type EntradaSimplesNt2026005,
  type Fornecimento,
  type ParametrosAno,
  type PerfilVenda,
} from '../src/index.js';
import { ANO_2027, ANO_2033, COCA_FABRICANTE, DISTRIBUIDORA_REAL } from './fixtures.js';

describe('arredondamento e formatação oficial da Receita Federal (ArredondamentoUtils)', () => {
  it('usa HALF_EVEN em 8 casas internas e 2 casas monetárias (LC 214/2025, art. 349, § 14)', () => {
    expect(arredondarMoedaRtc(dec('2.005')).toFixed(2)).toBe('2.00');
    expect(arredondarMoedaRtc(dec('2.015')).toFixed(2)).toBe('2.02');
    expect(arredondarInternoRtc(dec('1').div(3)).toFixed(8)).toBe('0.33333333');
    expect(formatarAliquotaRtc(dec('0.2080'))).toBe('0.208');
    expect(formatarAliquotaRtc(dec('0.2000'))).toBe('0.20');
    expect(formatarAliquotaRtc(dec('60'))).toBe('60.00');
  });
});

describe('base de cálculo unificada NF-e/NFC-e (BaseCalculoUnificadaService)', () => {
  it('reproduz o exemplo oficial de 2027 da Receita Federal (docs/exemplos.md)', () => {
    const r = calcularBaseUnificadaNfe({
      anoFatoGerador: 2027,
      tipoDocumento: 55,
      natureza: 'bem',
      vProd: '1000.00',
      vFrete: '50.00',
      vSeg: '20.00',
      vOutro: '10.00',
      vDesc: '50.00',
      vIS: '30.00',
      vPIS: '9.25',
      vCOFINS: '46.25',
      vICMS: '180.00',
      vFCP: '10.00',
    });
    expect(r.baseRG).toBe('870.00000000');
    expect(r.baseIS).toBe('840.00000000');
    expect(r.baseSN).toBe('1060.00000000');
    expect(r.avisos).toEqual([
      'Campo vPIS não compõe as bases para o ano 2027 (vigência 2026-2026) e foi ignorado no cálculo',
      'Campo vCOFINS não compõe as bases para o ano 2027 (vigência 2026-2026) e foi ignorado no cálculo',
    ]);
  });

  it('respeita vigência por ano (2026 e 2033), natureza (bem x servico) e modelo (55 x 65)', () => {
    // Em 2026 PIS/Cofins deduzem e vIS ainda não compõe a base.
    const em2026 = calcularBaseUnificadaNfe({
      anoFatoGerador: 2026,
      tipoDocumento: 55,
      natureza: 'bem',
      vProd: '100.00',
      vPIS: '1.65',
      vCOFINS: '7.60',
      vICMS: '18.00',
      vII: '5.00',
      vIS: '10.00',
    });
    expect(em2026.baseRGMoeda).toBe('77.75');
    expect(em2026.avisos).toHaveLength(1);
    expect(em2026.avisos[0]).toMatch(/vIS.*2027-2033/);

    // Em 2033 ICMS e ISSQN deixam de deduzir.
    const em2033 = calcularBaseUnificadaNfe({
      anoFatoGerador: 2033,
      tipoDocumento: 65,
      natureza: 'servico',
      vProd: '200.00',
      vICMS: '20.00',
      vISSQN: '10.00',
    });
    expect(em2033.baseRGMoeda).toBe('200.00');
    expect(em2033.avisos).toHaveLength(2);

    // Natureza incompatível (vISSQN num bem em 2027) e modelo incompatível (vII em NFC-e 65).
    const avisosContexto = calcularBaseUnificadaNfe({
      anoFatoGerador: 2027,
      tipoDocumento: 65,
      natureza: 'bem',
      vProd: '100.00',
      vISSQN: '5.00',
      vII: '10.00',
    });
    expect(avisosContexto.baseRGMoeda).toBe('100.00');
    expect(avisosContexto.avisos[0]).toMatch(/vII.*modelo 65/);
    expect(avisosContexto.avisos[1]).toMatch(/vISSQN.*SERVICO/);

    // Sem natureza informada, campos restritos a BEM ou SERVICO são ignorados com aviso (como no Java).
    const semNatureza = calcularBaseUnificadaNfe({
      anoFatoGerador: 2027,
      tipoDocumento: 55,
      vProd: '100.00',
      vDesc: '5.00',
      vISSQN: '5.00',
    });
    expect(semNatureza.baseRGMoeda).toBe('95.00');
    expect(semNatureza.avisos).toHaveLength(1);

    expect(() =>
      calcularBaseUnificadaNfe({
        anoFatoGerador: 2027,
        tipoDocumento: 57 as 55,
        vProd: '100.00',
      }),
    ).toThrow(/55.*65/);
  });
});

describe('regime geral por item (exemplos oficiais da Receita Federal)', () => {
  it('reproduz os itens de docs/exemplos.md (cesta básica, cerveja com IS e redução de 60%)', () => {
    // Item 1: arroz na cesta básica (200003, redução de 100%)
    const arroz = calcularTributosRtcItem({
      baseSemIs: '100.00',
      aliquotaCbs: '0.088',
      aliquotaIbsUf: '0.0005',
      aliquotaIbsMun: '0.0005',
      reducao: '1',
    });
    expect(arroz.vCBS).toBe('0.00');
    expect(arroz.vIBS).toBe('0.00');

    // Item 2: cerveja com IS de 10% sobre 150,00 -> IS = 15,00; BC CBS/IBS = 165,00
    const cerveja = calcularTributosRtcItem({
      baseSemIs: '150.00',
      aliquotaIs: '0.10',
      aliquotaCbs: '0.088',
      aliquotaIbsUf: '0.0005',
      aliquotaIbsMun: '0.0005',
    });
    expect(cerveja.vIS).toBe('15.00');
    expect(cerveja.vBCIBSCBS).toBe('165.00');
    expect(cerveja.vCBS).toBe('14.52');
    expect(cerveja.vIBS).toBe('0.16');

    // Item 3: educação com redução de 60% sobre 1200,00 -> vCBS = 42,24, vIBS = 0,48
    const educacao = calcularTributosRtcItem({
      baseSemIs: '1200.00',
      aliquotaCbs: '0.088',
      aliquotaIbsUf: '0.0005',
      aliquotaIbsMun: '0.0005',
      reducao: '0.6',
    });
    expect(educacao).toMatchObject({
      pAliqEfetCBS: '3.52',
      vCBS: '42.24',
      pAliqEfetIBSUF: '0.02',
      vIBSUF: '0.24',
      pAliqEfetIBSMun: '0.02',
      vIBSMun: '0.24',
      vIBS: '0.48',
    });

    // Total da operação oficial (itens 1 + 2 + 3): vIS = 15,00; vBCIBSCBS = 1465,00; vCBS = 56,76; vIBS = 0,64
    expect(new D(arroz.vCBS).plus(cerveja.vCBS).plus(educacao.vCBS).toFixed(2)).toBe('56.76');
    expect(new D(arroz.vIBS).plus(cerveja.vIBS).plus(educacao.vIBS).toFixed(2)).toBe('0.64');
  });

  it('calcula parcela específica (ad rem) do IS e rejeita redução fora de [0, 1]', () => {
    const cigarro = calcularTributosRtcItem({
      baseSemIs: '10.00',
      aliquotaIs: '0.667',
      adRemIs: '3.50',
      quantidade: '2',
      aliquotaCbs: '0.112',
      aliquotaIbsUf: '0.0005',
      aliquotaIbsMun: '0.0005',
    });
    // IS = 10 * 0,667 (6,67) + 2 * 3,50 (7,00) = 13,67; BC CBS/IBS = 23,67
    expect(cigarro.vIS).toBe('13.67');
    expect(cigarro.vBCIBSCBS).toBe('23.67');
    expect(() =>
      calcularTributosRtcItem({
        baseSemIs: '100',
        aliquotaCbs: '0.1',
        aliquotaIbsUf: '0',
        aliquotaIbsMun: '0',
        reducao: '1.5',
      }),
    ).toThrow(/entre 0 e 1/);
  });
});

describe('Simples Nacional: casos dourados da NT 2026.005 v1.00 (Teste_SimplesNacionalCalculoService)', () => {
  const padrao = (
    regime: EntradaSimplesNt2026005['regime'],
    tpRBSN: CodigoTpRbsn,
    extra: Partial<EntradaSimplesNt2026005> = {},
  ) =>
    calcularItemSimplesNt2026005({
      regime,
      tpRBSN,
      baseCalculo: '1000.00',
      valorImpostoSeletivo: '0.00',
      pIBSSN: '1.25',
      pCBSSN: '2.75',
      ...extra,
    });

  it('casos 01 a 08: CRT=1 e todos os tipos de receita bruta (tpRBSN)', () => {
    // Caso 01: tpRBSN=1
    expect(padrao('CRT_1', 1)).toMatchObject({
      estadoItem: 'CALCULADO',
      vRBSNitem: '1000.00',
      vBC: '1000.00',
      vIBSSN: '12.50',
      vIBSPendSusp: '0.00',
      vCBSSN: '27.50',
      vCBSPendSusp: '0.00',
      totalItem: '40.00',
    });

    // Caso 02: vIS fora de vRBSNitem na carga vigente (950 -> 11,875 -> 11,88 HALF_EVEN; 26,125 -> 26,12 HALF_EVEN; total 88,00)
    expect(
      padrao('CRT_1', 1, { baseCalculo: '950.00', valorImpostoSeletivo: '50.00' }),
    ).toMatchObject({
      vRBSNitem: '950.00',
      vIBSSN: '11.88',
      vCBSSN: '26.12',
      vIS: '50.00',
      totalItem: '88.00',
    });

    // Caso 02b: alavanca parametrizável com vIS na receita bruta
    expect(
      padrao('CRT_1', 1, {
        baseCalculo: '950.00',
        valorImpostoSeletivo: '50.00',
        impostoSeletivoCompoeReceita: true,
      }),
    ).toMatchObject({
      vRBSNitem: '1000.00',
      vIBSSN: '12.50',
      vCBSSN: '27.50',
      totalItem: '90.00',
    });

    // Caso 03: tpRBSN=5 (metade da receita)
    expect(padrao('CRT_1', 5)).toMatchObject({
      vBC: '500.00',
      vIBSSN: '6.25',
      vCBSSN: '13.75',
    });

    // Caso 04: tpRBSN=4 (exportação indireta suspende e fica fora do totalItem)
    expect(padrao('CRT_1', 4)).toMatchObject({
      vIBSSN: '0.00',
      vIBSPendSusp: '12.50',
      vCBSSN: '0.00',
      vCBSPendSusp: '27.50',
      totalItem: '0.00',
    });

    // Casos 05 a 07: tpRBSN 2, 3 e 9 zeram vBC e tributos
    for (const tp of [2, 3, 9] as const) {
      expect(padrao('CRT_1', tp)).toMatchObject({
        vRBSNitem: '1000.00',
        vBC: '0.00',
        vIBSSN: '0.00',
        vCBSSN: '0.00',
      });
    }

    // Caso 08: tpRBSN=0 zera a própria receita bruta
    expect(padrao('CRT_1', 0, { valorImpostoSeletivo: '50.00' })).toMatchObject({
      vRBSNitem: '0.00',
      vBC: '0.00',
      vIBSSN: '0.00',
      vCBSSN: '0.00',
    });
  });

  it('casos 09 a 13: CRT=2 (excesso de sublimite) e CRT=3 + tpRegimeIBSCBS=2', () => {
    expect(padrao('CRT_2', 1)).toMatchObject({
      pIBSSN: null,
      vIBSSN: null,
      vIBSPendSusp: null,
      vCBSSN: '27.50',
      totalItem: '27.50',
    });
    expect(padrao('CRT_2', 4)).toMatchObject({
      vIBSSN: null,
      vCBSSN: '0.00',
      vCBSPendSusp: '27.50',
    });
    expect(padrao('CRT_3_TPREGIME_2', 1)).toMatchObject({
      vIBSSN: '0.00',
      vIBSPendSusp: '12.50',
      vCBSSN: '0.00',
      vCBSPendSusp: '27.50',
    });
    expect(padrao('CRT_3_TPREGIME_2', 5)).toMatchObject({
      vIBSPendSusp: '6.25',
      vCBSPendSusp: '13.75',
    });
    // Caso 13: literal das fórmulas P32/P33 da NT 2026.005
    expect(padrao('CRT_3_TPREGIME_2', 4)).toMatchObject({
      vIBSSN: '0.00',
      vIBSPendSusp: '0.00',
      vCBSSN: '0.00',
      vCBSPendSusp: '0.00',
    });
  });

  it('casos 14 a 18: compras governamentais (arts. 372 e 473 da LC 214), atividade ausente e alíquotas dispensadas', () => {
    // Caso 14: União desloca IBS -> CBS
    expect(padrao('CRT_1', 1, { tpEnteGov: 1 })).toMatchObject({
      pIBSSN: '0.00',
      vIBSSN: '0.00',
      pCBSSN: '4.00',
      vCBSSN: '40.00',
    });
    // Caso 15: Estado com fator 0,10 (2029)
    expect(padrao('CRT_1', 1, { tpEnteGov: 2, fatorTransicaoCompraGov: '0.10' })).toMatchObject({
      pIBSSN: '1.525',
      vIBSSN: '15.25',
      pCBSSN: '2.475',
      vCBSSN: '24.75',
    });
    // Caso 16: DF com fator 1,00 (2033)
    expect(padrao('CRT_1', 1, { tpEnteGov: 3, fatorTransicaoCompraGov: '1.00' })).toMatchObject({
      pIBSSN: '4.00',
      vIBSSN: '40.00',
      pCBSSN: '0.00',
      vCBSSN: '0.00',
    });
    // Caso 17: Município com fator 0,00 (2027-2028)
    expect(padrao('CRT_1', 1, { tpEnteGov: 4, fatorTransicaoCompraGov: '0.00' })).toMatchObject({
      pIBSSN: '1.25',
      vIBSSN: '12.50',
      pCBSSN: '2.75',
      vCBSSN: '27.50',
    });
    // CRT=2 + União usa pIBSSN só como insumo e suprime IBS na saída; sem pIBSSN trata como zero
    expect(padrao('CRT_2', 1, { tpEnteGov: 1 })).toMatchObject({
      pIBSSN: null,
      pCBSSN: '4.00',
      vCBSSN: '40.00',
    });
    expect(padrao('CRT_2', 1, { tpEnteGov: 1, pIBSSN: null })).toMatchObject({
      pIBSSN: null,
      pCBSSN: '2.75',
      vCBSSN: '27.50',
    });
    expect(padrao('CRT_1', 1, { tpEnteGov: 1, pCBSSN: null })).toMatchObject({
      pIBSSN: '0.00',
      pCBSSN: '1.25',
      vCBSSN: '12.50',
    });
    // Sem alíquotas em tpRBSN=2 (dispensadas)
    expect(
      calcularItemSimplesNt2026005({
        regime: 'CRT_1',
        tpRBSN: 2,
        baseCalculo: '1000.00',
      }),
    ).toMatchObject({
      pIBSSN: null,
      pCBSSN: null,
      vIBSSN: '0.00',
      vCBSSN: '0.00',
      totalItem: '0.00',
    });
    // Caso 18: cAtivSN ausente/inválido -> NAO_CALCULADO
    expect(padrao('CRT_1', 1, { cAtivSNValido: false })).toEqual({
      estadoItem: 'NAO_CALCULADO',
      vRBSNitem: '1000.00',
      tpRBSN: 1,
      tpRBSNDescricao: 'Receita bruta - interna',
    });
    // Falta fator em tpEnteGov 2..4
    expect(() => padrao('CRT_1', 1, { tpEnteGov: 2 })).toThrow(/Fator de transição/);
  });
});

describe('critério 12.1: oráculo oficial x motor fiscal (diferença máxima de R$ 0,01 por item)', () => {
  it('compra e venda da Coca-Cola em 2027 e 2033 batem dentro de R$ 0,01 com o oráculo da RFB', () => {
    for (const ano of [ANO_2027, ANO_2033]) {
      const compra = reconstruirCompra(COCA_FABRICANTE, ano, []);
      const baseUnificada = calcularBaseUnificadaNfe({
        anoFatoGerador: ano.ano,
        tipoDocumento: 55,
        natureza: 'bem',
        vProd: compra.precoFornecedor.minus(compra.is).toFixed(2),
        vIS: compra.is.toFixed(2),
        vICMS: compra.icmsProprio.toFixed(2),
      });
      const metadeIbs = dec(ano.ibs).div(2).toString();
      const oraculoCompra = calcularTributosRtcItem({
        baseSemIs: COCA_FABRICANTE.precoLiquido,
        aliquotaIs: ano.aliquotaIs,
        aliquotaCbs: ano.cbs,
        aliquotaIbsUf: metadeIbs,
        aliquotaIbsMun: metadeIbs,
      });

      expect(
        Math.abs(Number(baseUnificada.baseRGMoeda) - Number(oraculoCompra.vBCIBSCBS)),
      ).toBeLessThanOrEqual(0.01);
      expect(Math.abs(compra.is.toNumber() - Number(oraculoCompra.vIS))).toBeLessThanOrEqual(0.01);
      expect(Math.abs(compra.cbs.toNumber() - Number(oraculoCompra.vCBS))).toBeLessThanOrEqual(
        0.01,
      );
      expect(Math.abs(compra.ibs.toNumber() - Number(oraculoCompra.vIBS))).toBeLessThanOrEqual(
        0.01,
      );

      const venda = precificarAno(
        { fornecimento: COCA_FABRICANTE, perfil: DISTRIBUIDORA_REAL },
        ano,
      );
      if (venda.situacao !== 'CALCULADO') throw new Error('esperava cálculo');
      const baseVenda = calcularBaseUnificadaNfe({
        anoFatoGerador: ano.ano,
        tipoDocumento: 55,
        natureza: 'bem',
        vProd: venda.valores.preco,
        vICMS: venda.valores.icms,
      });
      const oraculoVenda = calcularTributosRtcItem({
        baseSemIs: baseVenda.baseRGMoeda,
        aliquotaCbs: ano.cbs,
        aliquotaIbsUf: metadeIbs,
        aliquotaIbsMun: metadeIbs,
      });
      expect(Math.abs(Number(venda.valores.cbs) - Number(oraculoVenda.vCBS))).toBeLessThanOrEqual(
        0.01,
      );
      expect(Math.abs(Number(venda.valores.ibs) - Number(oraculoVenda.vIBS))).toBeLessThanOrEqual(
        0.01,
      );
    }
  });

  it('propriedade: em qualquer operação regular (2027-2033, integral, 60% ou zero), CBS, IBS e IS ficam a <= R$ 0,01 do oráculo RFB', () => {
    const pct = (max: number) => fc.integer({ min: 0, max }).map((n) => (n / 1000).toString());
    const arbFornecimento = fc.record({
      precoLiquido: fc.integer({ min: 50, max: 100_000 }).map((n) => (n / 100).toFixed(2)),
      aliquotaIcms: pct(220),
      aliquotaIpi: fc.constant('0'),
      aliquotaPisCofins: fc.constant('0'),
      substituicaoTributaria: fc.constant(null),
      freteEDespesas: fc.constant('0'),
    }) as fc.Arbitrary<Fornecimento>;
    const arbAno = fc
      .record({
        ano: fc.integer({ min: 2027, max: 2033 }),
        cbs: pct(130),
        ibsMetade: pct(100),
        fatorIcms: fc.constantFrom('1', '0.9', '0.8', '0.7', '0.6', '0'),
        aliquotaIs: pct(250),
        reducaoCbsIbs: fc.constantFrom('0', '0.6', '1'),
      })
      .map((x): ParametrosAno => ({
        ano: x.ano,
        cbs: x.cbs,
        ibs: dec(x.ibsMetade).times(2).toString(),
        cbsIbsComEfeito: true,
        fatorIcms: x.ano === 2033 ? '0' : x.fatorIcms,
        pisCofinsVigente: false,
        ipiVigente: false,
        aliquotaIs: x.aliquotaIs,
        reducaoCbsIbs: x.reducaoCbsIbs,
        regras: [],
      }));

    fc.assert(
      fc.property(arbFornecimento, arbAno, pct(180), (f, p, icmsSaida) => {
        const compra = reconstruirCompra(f, p, []);
        const metadeIbs = dec(p.ibs).div(2).toString();
        const baseCompra = compra.precoFornecedor.minus(compra.icmsProprio);
        // Base de CBS/IBS da compra já contém o IS embutido em precoFornecedor − icmsProprio
        const oraculoSobreBaseReal = calcularTributosRtcItem({
          baseSemIs: baseCompra.toFixed(2),
          aliquotaCbs: p.cbs,
          aliquotaIbsUf: metadeIbs,
          aliquotaIbsMun: metadeIbs,
          reducao: p.reducaoCbsIbs ?? '0',
        });
        expect(
          Math.abs(compra.cbs.toNumber() - Number(oraculoSobreBaseReal.vCBS)),
        ).toBeLessThanOrEqual(0.01);
        expect(
          Math.abs(compra.ibs.toNumber() - Number(oraculoSobreBaseReal.vIBS)),
        ).toBeLessThanOrEqual(0.01);

        const isOraculo = arredondarMoedaRtc(
          arredondarInternoRtc(dec(f.precoLiquido).times(dec(p.aliquotaIs))),
        );
        expect(Math.abs(compra.is.toNumber() - isOraculo.toNumber())).toBeLessThanOrEqual(0.01);

        const perfil: PerfilVenda = {
          ...DISTRIBUIDORA_REAL,
          aliquotaIcmsSaida: icmsSaida,
          creditaIcmsEntrada: true,
        };
        const venda = precificarAno({ fornecimento: f, perfil }, p);
        if (venda.situacao !== 'CALCULADO') return;
        const baseVenda = dec(venda.valores.preco).minus(dec(venda.valores.icms));
        const oraculoVenda = calcularTributosRtcItem({
          baseSemIs: baseVenda.toFixed(2),
          aliquotaCbs: p.cbs,
          aliquotaIbsUf: metadeIbs,
          aliquotaIbsMun: metadeIbs,
          reducao: p.reducaoCbsIbs ?? '0',
        });
        expect(Math.abs(Number(venda.valores.cbs) - Number(oraculoVenda.vCBS))).toBeLessThanOrEqual(
          0.01,
        );
        expect(Math.abs(Number(venda.valores.ibs) - Number(oraculoVenda.vIBS))).toBeLessThanOrEqual(
          0.01,
        );
      }),
    );
  });
});
