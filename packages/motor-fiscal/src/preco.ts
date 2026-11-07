import { apurarCreditos, reconstruirCompra, type Compra, type Creditos } from './compra.js';
import { arredondarMoeda, D, dec, type Dec } from './decimal.js';
import { aliquotasCbsIbs } from './efetivas.js';
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
  /** Imposto Seletivo embutido no preço do fornecedor: entra no custo e nunca vira crédito. */
  readonly isCompra: string;
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

type Contexto = {
  readonly p: ParametrosAno;
  readonly perfil: PerfilVenda;
  readonly memoria: PassoMemoria[];
  readonly status: Status;
  readonly regras: string[];
  readonly compra: Compra;
  readonly creditos: Creditos;
  readonly custo: Dec;
  readonly das: Dec;
  readonly parcela: Dec | null;
  readonly aIcms: Dec;
  readonly aPc: Dec;
  readonly aDas: Dec;
  readonly porFora: Dec;
  /** CBS e IBS do ano já reduzidos pelo tratamento do produto. */
  readonly cbs: Dec;
  readonly ibs: Dec;
  readonly dentro: Dec;
  readonly desp: Dec;
  /** Preço com tributo = preço × k, porque CBS/IBS incidem sobre o preço sem ICMS e PIS/Cofins. */
  readonly k: Dec;
};

const MOTIVO_PARTILHA_DAS =
  'Simples com IBS/CBS no regime regular exige a parcela de CBS/IBS do DAS por anexo, que ainda não foi confirmada nas Resoluções CGSN.';

/** Compra, créditos e alíquotas efetivas da venda no ano; ou dado pendente. */
function prepararAno(e: EntradaPrecificacao, p: ParametrosAno): Contexto | ResultadoAno {
  const memoria: PassoMemoria[] = [];
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
      motivo: MOTIVO_PARTILHA_DAS,
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
  const ef = aliquotasCbsIbs(p);
  const porFora = p.cbsIbsComEfeito && perfil.regime !== 'SIMPLES_DAS' ? ef.cbs.plus(ef.ibs) : ZERO;
  return {
    p,
    perfil,
    memoria,
    status: statusDoAno(p),
    regras: p.regras.map((r) => `${r.id}@${r.versao}`),
    compra,
    creditos,
    custo,
    das,
    parcela,
    aIcms,
    aPc,
    aDas,
    porFora,
    cbs: ef.cbs,
    ibs: ef.ibs,
    dentro: aIcms.plus(aPc).plus(aDas),
    desp: dec(perfil.despesasVariaveis),
    k: UM.plus(porFora.times(UM.minus(aIcms).minus(aPc))),
  };
}

const ehResultado = (x: Contexto | ResultadoAno): x is ResultadoAno => 'situacao' in x;

/** Tributos, lucro e margens de um preço de venda (sem CBS/IBS por fora). */
function montarResultado(c: Contexto, preco: Dec, passoPreco: PassoMemoria): ResultadoAno {
  const { p, perfil, memoria, regras, custo } = c;
  const icms = arredondarMoeda(preco.times(c.aIcms));
  const pisCofins = arredondarMoeda(preco.times(c.aPc));
  const valorDas = arredondarMoeda(preco.times(c.aDas));
  const base = preco.minus(icms).minus(pisCofins);
  const cbs = c.porFora.isZero() ? ZERO : arredondarMoeda(base.times(c.cbs));
  const ibs = c.porFora.isZero() ? ZERO : arredondarMoeda(base.times(c.ibs));
  const despesas = arredondarMoeda(preco.times(c.desp));
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
      : c.parcela === null
        ? null
        : arredondarMoeda(preco.times(c.das).times(c.parcela)).toFixed(2);
  } else {
    creditoTransferido = cbs.plus(ibs).toFixed(2);
  }

  memoria.push(
    {
      id: 'venda.custo-liquido',
      descricao: 'Custo líquido de aquisição',
      formula: 'total da nota − créditos',
      entradas: {
        totalNota: c.compra.totalNota.toFixed(2),
        creditos: c.creditos.total.toFixed(2),
      },
      resultado: custo.toFixed(2),
      regras,
    },
    passoPreco,
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
    status: c.status,
    valores: {
      preco: preco.toFixed(2),
      precoComTributo: precoComTributo.toFixed(2),
      custoLiquido: custo.toFixed(2),
      totalNotaCompra: c.compra.totalNota.toFixed(2),
      isCompra: c.compra.is.toFixed(2),
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

/**
 * Preço que mantém a margem pedida, num ano, com a memória de cálculo completa.
 * CBS e IBS (regime regular) são por fora: o cliente paga, a empresa repassa líquido do crédito.
 */
export function precificarAno(e: EntradaPrecificacao, p: ParametrosAno): ResultadoAno {
  const c = prepararAno(e, p);
  if (ehResultado(c)) return c;
  const { perfil } = c;
  const m = dec(perfil.margem);
  const divisor =
    perfil.baseMargem === 'RECEITA_LIQUIDA'
      ? UM.minus(c.dentro).times(UM.minus(m)).minus(c.desp)
      : UM.minus(c.dentro).minus(c.desp).minus(m.times(c.k));
  if (divisor.lte(0)) {
    throw new RangeError('Tributos, despesas e margem tornam o preço impossível (divisor ≤ 0).');
  }
  const preco = arredondarMoeda(c.custo.div(divisor));
  return montarResultado(c, preco, {
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
      custo: c.custo.toFixed(2),
      tributosPorDentro: pct(c.dentro),
      cbsIbsPorFora: pct(c.porFora),
      despesas: perfil.despesasVariaveis,
      margem: perfil.margem,
    },
    resultado: preco.toFixed(2),
    regras: c.regras,
  });
}

const CENTAVO = new D('0.01');

/**
 * Resultado de um preço escolhido (o que o cliente paga, com CBS e IBS por fora), por exemplo
 * o preço psicológico: tributos, lucro e as margens efetivas nesse preço. Como a CBS e o IBS
 * são arredondados à parte, usa o maior preço sem tributo cujo total não passa do informado.
 */
export function avaliarPreco(
  e: EntradaPrecificacao,
  p: ParametrosAno,
  precoComTributo: string,
): ResultadoAno {
  const alvo = dec(precoComTributo);
  if (alvo.lte(0)) throw new RangeError('O preço informado precisa ser maior que zero.');
  const c = prepararAno(e, p);
  if (ehResultado(c)) return c;

  const cbsIbs = (preco: Dec) => {
    const base = preco
      .minus(arredondarMoeda(preco.times(c.aIcms)))
      .minus(arredondarMoeda(preco.times(c.aPc)));
    return c.porFora.isZero()
      ? ZERO
      : arredondarMoeda(base.times(c.cbs)).plus(arredondarMoeda(base.times(c.ibs)));
  };
  // O total cresce com o preço: parte de 2 centavos abaixo da divisão e sobe enquanto couber.
  const inicio = D.max(ZERO, arredondarMoeda(alvo.div(c.k)).minus(CENTAVO.times(2)));
  let preco = inicio;
  for (let passo = 1; passo <= 6; passo++) {
    const candidato = inicio.plus(CENTAVO.times(passo));
    if (candidato.plus(cbsIbs(candidato)).lte(alvo)) preco = candidato;
  }

  return montarResultado(c, preco, {
    id: 'venda.preco-informado',
    descricao: 'Preço escolhido (o cliente paga)',
    formula: 'maior preço sem CBS/IBS cujo total com CBS e IBS não passa do informado',
    entradas: { clientePaga: alvo.toFixed(2), k: c.k.toString() },
    resultado: preco.toFixed(2),
    regras: c.regras,
  });
}

/** Linha do tempo de 2026 a 2033 (ou outro intervalo) com os parâmetros de cada ano. */
export function linhaDoTempo(
  e: EntradaPrecificacao,
  parametros: readonly ParametrosAno[],
): ResultadoAno[] {
  return parametros.map((p) => precificarAno(e, p));
}
