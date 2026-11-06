import { apurarCreditos, reconstruirCompra } from './compra.js';
import { arredondarMoeda, D, dec, type Dec } from './decimal.js';
import type { PassoMemoria } from './memoria.js';
import {
  ORDEM_STATUS,
  type Fornecimento,
  type ParametrosAno,
  type PerfilVenda,
  type Status,
} from './tipos.js';

export interface EntradaPrecificacao {
  readonly fornecimento: Fornecimento;
  readonly perfil: PerfilVenda;
}

export interface Valores {
  /** Preço de venda sem CBS/IBS por fora (base do ICMS). */
  readonly preco: string;
  /** O que o cliente paga: preço + CBS + IBS destacados. */
  readonly precoComTributo: string;
  readonly custoLiquido: string;
  readonly totalNotaCompra: string;
  readonly icms: string;
  readonly pisCofins: string;
  readonly das: string;
  readonly cbs: string;
  readonly ibs: string;
  /** Crédito de CBS/IBS que o comprador recebe. Nulo quando depende de dado PENDENTE. */
  readonly creditoTransferido: string | null;
  readonly despesas: string;
  readonly lucro: string;
  readonly margemSobrePrecoComTributo: string;
  readonly margemSobreReceitaLiquida: string;
}

export type ResultadoAno =
  | {
      readonly ano: number;
      readonly situacao: 'CALCULADO';
      readonly status: Status;
      readonly valores: Valores;
      readonly memoria: readonly PassoMemoria[];
    }
  | {
      readonly ano: number;
      readonly situacao: 'DADO_PENDENTE';
      readonly status: Status;
      readonly motivo: string;
      readonly memoria: readonly PassoMemoria[];
    };

const ZERO = new D(0);
const UM = new D(1);

/** O status menos firme entre as regras usadas no ano. */
export function statusDoAno(p: ParametrosAno): Status {
  let pior = 0;
  for (const r of p.regras) pior = Math.max(pior, ORDEM_STATUS.indexOf(r.status));
  return ORDEM_STATUS[pior] as Status;
}

const pct = (x: Dec) => x.toDecimalPlaces(4, D.ROUND_HALF_UP).toFixed(4);

/**
 * Preço que mantém a margem pedida, num ano, com a memória de cálculo completa.
 * CBS e IBS (regime regular) são por fora: o cliente paga, a empresa repassa líquido do crédito.
 */
export function precificarAno(e: EntradaPrecificacao, p: ParametrosAno): ResultadoAno {
  const memoria: PassoMemoria[] = [];
  const status = statusDoAno(p);
  const regras = p.regras.map((r) => `${r.id}@${r.versao}`);
  const perfil = e.perfil;

  const simples = perfil.regime === 'SIMPLES_DAS' || perfil.regime === 'SIMPLES_REGULAR';
  if (simples && perfil.aliquotaDas === null) {
    throw new RangeError('Simples Nacional exige a alíquota efetiva do DAS.');
  }
  // Antes de 2027 não há CBS/IBS com efeito: o Simples regular funciona como o DAS.
  const regularNoSimples = perfil.regime === 'SIMPLES_REGULAR' && p.cbsIbsComEfeito;
  if (regularNoSimples && perfil.parcelaCbsIbsNoDas === null) {
    return {
      ano: p.ano,
      situacao: 'DADO_PENDENTE',
      status: 'PENDENTE',
      motivo:
        'Simples com IBS/CBS no regime regular exige a parcela de CBS/IBS do DAS por anexo, que ainda não foi confirmada nas Resoluções CGSN.',
      memoria,
    };
  }

  const compra = reconstruirCompra(e.fornecimento, p, memoria);
  const creditos = apurarCreditos(compra, perfil, p, memoria);
  const custo = compra.totalNota.minus(creditos.total);

  const fator = dec(p.fatorIcms);
  const das = simples ? dec(perfil.aliquotaDas as string) : ZERO;
  const parcela = perfil.parcelaCbsIbsNoDas === null ? null : dec(perfil.parcelaCbsIbsNoDas);
  if (parcela !== null && (parcela.isNegative() || parcela.gt(UM))) {
    throw new RangeError('A parcela de CBS/IBS no DAS é uma fração entre 0 e 1.');
  }
  const aIcms = simples ? ZERO : dec(perfil.aliquotaIcmsSaida).times(fator);
  const aPc = !simples && p.pisCofinsVigente ? dec(perfil.aliquotaPisCofinsSaida) : ZERO;
  const aDas = regularNoSimples ? das.times(UM.minus(parcela as Dec)) : das;
  const porFora =
    p.cbsIbsComEfeito && perfil.regime !== 'SIMPLES_DAS' ? dec(p.cbs).plus(dec(p.ibs)) : ZERO;
  const dentro = aIcms.plus(aPc).plus(aDas);
  const desp = dec(perfil.despesasVariaveis);
  const m = dec(perfil.margem);
  // Preço com tributo = P × k, porque CBS/IBS incidem sobre P sem ICMS e PIS/Cofins.
  const k = UM.plus(porFora.times(UM.minus(aIcms).minus(aPc)));

  const divisor =
    perfil.baseMargem === 'RECEITA_LIQUIDA'
      ? UM.minus(dentro).times(UM.minus(m)).minus(desp)
      : UM.minus(dentro).minus(desp).minus(m.times(k));
  if (divisor.lte(0)) {
    throw new RangeError('Tributos, despesas e margem tornam o preço impossível (divisor ≤ 0).');
  }
  const preco = arredondarMoeda(custo.div(divisor));

  const icms = arredondarMoeda(preco.times(aIcms));
  const pisCofins = arredondarMoeda(preco.times(aPc));
  const valorDas = arredondarMoeda(preco.times(aDas));
  const base = preco.minus(icms).minus(pisCofins);
  const cbs = porFora.isZero() ? ZERO : arredondarMoeda(base.times(dec(p.cbs)));
  const ibs = porFora.isZero() ? ZERO : arredondarMoeda(base.times(dec(p.ibs)));
  const despesas = arredondarMoeda(preco.times(desp));
  const tributosDentro = icms.plus(pisCofins).plus(valorDas);
  const receitaLiquida = preco.minus(tributosDentro);
  // Preço com tributo ≥ preço > receita líquida: basta checar a menor das bases das margens.
  if (receitaLiquida.lte(0)) {
    throw new RangeError('Custo e preço zerados: não há margem a calcular.');
  }
  const lucro = receitaLiquida.minus(despesas).minus(custo);
  const precoComTributo = preco.plus(cbs).plus(ibs);

  let creditoTransferido: string | null;
  if (perfil.regime === 'SIMPLES_DAS') {
    creditoTransferido = !p.cbsIbsComEfeito
      ? '0.00'
      : parcela === null
        ? null
        : arredondarMoeda(preco.times(das).times(parcela)).toFixed(2);
  } else {
    creditoTransferido = cbs.plus(ibs).toFixed(2);
  }

  memoria.push(
    {
      id: 'venda.custo-liquido',
      descricao: 'Custo líquido de aquisição',
      formula: 'total da nota − créditos',
      entradas: { totalNota: compra.totalNota.toFixed(2), creditos: creditos.total.toFixed(2) },
      resultado: custo.toFixed(2),
      regras,
    },
    {
      id: 'venda.preco',
      descricao:
        perfil.baseMargem === 'RECEITA_LIQUIDA'
          ? 'Preço que mantém a margem sobre a receita líquida'
          : 'Preço que mantém a margem sobre o preço com tributo',
      formula:
        perfil.baseMargem === 'RECEITA_LIQUIDA'
          ? 'custo ÷ ((1 − tributos por dentro) × (1 − margem) − despesas)'
          : 'custo ÷ (1 − tributos por dentro − despesas − margem × k), k = 1 + CBS/IBS × (1 − ICMS − PIS/Cofins)',
      entradas: {
        custo: custo.toFixed(2),
        tributosPorDentro: pct(dentro),
        cbsIbsPorFora: pct(porFora),
        despesas: perfil.despesasVariaveis,
        margem: perfil.margem,
      },
      resultado: preco.toFixed(2),
      regras,
    },
    {
      id: 'venda.tributos',
      descricao: 'Tributos da venda',
      formula:
        'ICMS e PIS/Cofins (ou DAS) por dentro; CBS e IBS por fora sobre preço − ICMS − PIS/Cofins',
      entradas: {
        icms: icms.toFixed(2),
        pisCofins: pisCofins.toFixed(2),
        das: valorDas.toFixed(2),
        cbs: cbs.toFixed(2),
        ibs: ibs.toFixed(2),
      },
      resultado: tributosDentro.plus(cbs).plus(ibs).toFixed(2),
      regras,
    },
    {
      id: 'venda.lucro',
      descricao: 'Lucro por unidade',
      formula: 'preço − tributos por dentro − despesas − custo líquido',
      entradas: {
        preco: preco.toFixed(2),
        tributosPorDentro: tributosDentro.toFixed(2),
        despesas: despesas.toFixed(2),
        custo: custo.toFixed(2),
      },
      resultado: lucro.toFixed(2),
      regras,
    },
  );

  return {
    ano: p.ano,
    situacao: 'CALCULADO',
    status,
    valores: {
      preco: preco.toFixed(2),
      precoComTributo: precoComTributo.toFixed(2),
      custoLiquido: custo.toFixed(2),
      totalNotaCompra: compra.totalNota.toFixed(2),
      icms: icms.toFixed(2),
      pisCofins: pisCofins.toFixed(2),
      das: valorDas.toFixed(2),
      cbs: cbs.toFixed(2),
      ibs: ibs.toFixed(2),
      creditoTransferido,
      despesas: despesas.toFixed(2),
      lucro: lucro.toFixed(2),
      margemSobrePrecoComTributo: pct(lucro.div(precoComTributo)),
      margemSobreReceitaLiquida: pct(lucro.div(receitaLiquida)),
    },
    memoria,
  };
}

/** Linha do tempo de 2026 a 2033 (ou outro intervalo) com os parâmetros de cada ano. */
export function linhaDoTempo(
  e: EntradaPrecificacao,
  parametros: readonly ParametrosAno[],
): ResultadoAno[] {
  return parametros.map((p) => precificarAno(e, p));
}
