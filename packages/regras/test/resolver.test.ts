import { fileURLToPath } from 'node:url';
import {
  linhaDoTempo,
  type Fornecimento,
  type PerfilVenda,
  type ResultadoAno,
} from '@calculafiscal/motor-fiscal';
import { describe, expect, it } from 'vitest';
import { carregarRegras, resolverAno, resolverPeriodo, type Regra } from '../src/index.js';

const DADOS = fileURLToPath(new URL('../dados', import.meta.url));
const regras = carregarRegras(DADOS);
const COCA = '2202.10.00';

describe('resolverAno', () => {
  it('2026: ano de teste, PIS/Cofins e IPI vigentes, sem IS', () => {
    const p = resolverAno(regras, { ano: 2026, ncm: COCA });
    expect(p).toMatchObject({
      cbs: '0.009',
      ibs: '0.001',
      cbsIbsComEfeito: false,
      pisCofinsVigente: true,
      ipiVigente: true,
      fatorIcms: '1',
      aliquotaIs: '0',
    });
  });

  it('2027: CBS do TCU menos 0,1 p.p. (PENDENTE), IBS 0,1% somando UF e município, IS 2,6%', () => {
    const p = resolverAno(regras, { ano: 2027, ncm: COCA });
    expect(p.cbs).toBe('0.112');
    expect(p.ibs).toBe('0.001');
    expect(p.aliquotaIs).toBe('0.026');
    expect(p.pisCofinsVigente || p.ipiVigente).toBe(false);
    expect(p.regras.find((r) => r.id === 'cbs.2027')?.status).toBe('PENDENTE');
  });

  it('IS só a partir de 02/02/2027 (janeiro sem IS)', () => {
    expect(resolverAno(regras, { ano: 2027, ncm: COCA, data: '2027-01-15' }).aliquotaIs).toBe('0');
    expect(resolverAno(regras, { ano: 2027, ncm: COCA, data: '2027-02-02' }).aliquotaIs).toBe(
      '0.026',
    );
  });

  it('2028 em diante: IS repete 2027 como ESTIMATIVA; MP caducada zera o IS', () => {
    const p = resolverAno(regras, { ano: 2030, ncm: COCA });
    expect(p.aliquotaIs).toBe('0.026');
    expect(p.regras.find((r) => r.id === 'is.bebidas-acucaradas')?.status).toBe('ESTIMATIVA');
    expect(resolverAno(regras, { ano: 2030, ncm: COCA, cenario: 'mp-caducada' }).aliquotaIs).toBe(
      '0',
    );
  });

  it('NCM sem IS e pedido sem NCM não têm IS', () => {
    expect(resolverAno(regras, { ano: 2030, ncm: '8471.30.12' }).aliquotaIs).toBe('0');
    expect(resolverAno(regras, { ano: 2030 }).aliquotaIs).toBe('0');
  });

  it('IS pelo prefixo de NCM mais longo (cerveja na posição 22.03)', () => {
    expect(resolverAno(regras, { ano: 2027, ncm: '2203.00.00' }).aliquotaIs).toBe('0.042');
  });

  it('regra de IS de outro cenário não esconde a regra base de prefixo mais curto', () => {
    const cerveja = regras.find(
      (r) => r.tributo === 'IS' && r.abrangencia.ncm.some((n) => n.startsWith('22.03')),
    ) as Regra;
    const soNoAlto: Regra = {
      ...cerveja,
      id: 'is.cerveja-especifica',
      abrangencia: { ...cerveja.abrangencia, ncm: ['2203.00.00'] },
      cenarios: ['ibs-alto'],
      valor: { ...cerveja.valor, aliquota: '0.05' },
    };
    const comExtra = [...regras, soNoAlto];
    expect(resolverAno(comExtra, { ano: 2027, ncm: '2203.00.00' }).aliquotaIs).toBe(
      cerveja.valor.aliquota,
    );
    expect(
      resolverAno(comExtra, { ano: 2027, ncm: '2203.00.00', cenario: 'ibs-alto' }).aliquotaIs,
    ).toBe('0.05');
  });

  it('rejeita data fora do ano pedido', () => {
    expect(() => resolverAno(regras, { ano: 2026, data: '2033-07-01' })).toThrow(/fora do ano/);
  });

  it('transição do ICMS: 90% em 2029 até zero em 2033', () => {
    const fatores = resolverPeriodo(regras, { ncm: COCA }).map((p) => p.fatorIcms);
    expect(fatores).toEqual(['1', '1', '1', '0.9', '0.8', '0.7', '0.6', '0']);
  });

  it('cenários de IBS escolhem a regra do cenário', () => {
    expect(resolverAno(regras, { ano: 2033 }).ibs).toBe('0.167');
    expect(resolverAno(regras, { ano: 2033, cenario: 'ibs-baixo' }).ibs).toBe('0.152');
    expect(resolverAno(regras, { ano: 2033, cenario: 'ibs-alto' }).ibs).toBe('0.182');
  });

  it('falha alto quando falta regra ou há ambiguidade', () => {
    expect(() => resolverAno([], { ano: 2027 })).toThrow(/Nenhuma regra vigente/);
    const cbs = regras.find((r) => r.id === 'cbs.2027') as Regra;
    expect(() => resolverAno([...regras, { ...cbs, id: 'cbs.duplicada' }], { ano: 2027 })).toThrow(
      /ambíguas/,
    );
  });
});

describe('integração: linha do tempo da Coca-Cola com as tabelas reais', () => {
  const fornecimento: Fornecimento = {
    precoLiquido: '3.040',
    aliquotaIcms: '0.18',
    aliquotaIpi: '0.026',
    aliquotaPisCofins: '0.13',
    substituicaoTributaria: { mva: '0.42', aliquotaInterna: '0.18' },
    freteEDespesas: '0',
  };
  const perfil: PerfilVenda = {
    regime: 'REAL',
    aliquotaIcmsSaida: '0',
    creditaIcmsEntrada: false,
    aliquotaPisCofinsSaida: '0',
    creditoPisCofinsEntrada: '0',
    aliquotaDas: null,
    parcelaCbsIbsNoDas: null,
    despesasVariaveis: '0.06',
    margem: '0.25',
    baseMargem: 'PRECO_COM_TRIBUTO',
  };
  const anos = linhaDoTempo({ fornecimento, perfil }, resolverPeriodo(regras, { ncm: COCA }));
  const valores = (r: ResultadoAno) => {
    if (r.situacao !== 'CALCULADO') throw new Error('esperava cálculo');
    return r.valores;
  };

  it('calcula todos os anos e marca o status de cada um', () => {
    expect(anos).toHaveLength(8);
    expect(anos[0]?.status).toBe('EM_VIGOR');
    expect(anos[7]?.status).toBe('ESTIMATIVA');
  });

  it('a margem de 25% sobre o preço com tributo é mantida em todos os anos', () => {
    for (const r of anos) {
      expect(Number(valores(r).margemSobrePrecoComTributo)).toBeCloseTo(0.25, 2);
    }
  });

  it('nenhum ano chega perto dos R$ 11,51 do cálculo simplificado', () => {
    for (const r of anos) expect(Number(valores(r).precoComTributo)).toBeLessThan(11.51);
  });
});
