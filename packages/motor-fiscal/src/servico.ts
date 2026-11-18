import { arredondarMoeda, D, dec, type Dec } from './decimal.js';
import { aliquotasCbsIbs } from './efetivas.js';
import type { PassoMemoria } from './memoria.js';
import { statusDoAno, type ResultadoAno } from './preco.js';
import type { BaseMargem, ModoFornecedor, ParametrosAno, Regime, Status } from './tipos.js';

/**
 * Precificação de serviços na transição do ISS e do PIS/Cofins para a CBS e o IBS (2026 a 2033).
 *
 * Regras fiscais aplicadas:
 * - O ISS municipal (2% a 5%, LC 116/2003) incide por dentro, não gera crédito na entrada e cai
 *   pelo mesmo fator constitucional do ICMS (ADCT art. 128 e art. 129: integral até 2028, 90% a
 *   60% de 2029 a 2032, extinto em 2033).
 * - Na saída do regime regular, a base de CBS e IBS deduz o ISS e o PIS/Cofins vigentes no ano
 *   (BaseCalculoUnificadaNfseService da Receita Federal; LC 214/2025, art. 12, § 2º, V).
 * - Nos custos diretos do prestador, apenas a fração vinda de insumos tributados por fornecedores
 *   do regime regular destaca CBS e IBS (folha de pagamento própria não gera crédito de CBS/IBS).
 *   Os insumos usam a alíquota geral de CBS/IBS do ano, enquanto o serviço vendido aplica a
 *   redução do seu cClassTrib (ex.: 30% nas profissões intelectuais regulamentadas, art. 127, ou
 *   60% em educação e saúde, arts. 129 e 130).
 */

export interface CustosServico {
  /** Custo direto total por serviço hoje (2026), em reais (mão de obra + insumos). */
  readonly custoDireto: string;
  /** Fração do custo direto correspondente a insumos adquiridos de fornecedores no regime regular ("0" a "1"). */
  readonly parcelaInsumosTributados: string;
  /** PIS/Cofins embutido nos insumos tributados em 2026 ("0.0925", "0.0365" ou "0"). */
  readonly aliquotaPisCofinsInsumos: string;
  /** Se os fornecedores de insumos repassam a extinção do PIS/Cofins em 2027 ou mantêm o preço bruto. */
  readonly modoFornecedor?: ModoFornecedor;
}

export interface PerfilVendaServico {
  readonly regime: Regime;
  /** Alíquota nominal do ISS municipal na saída ("0.02" a "0.05"; zero quando não incide ou no Simples). */
  readonly aliquotaIssSaida: string;
  /** Alíquota de PIS e Cofins na saída em 2026 ("0.0365" no Presumido, "0.0925" no Real). */
  readonly aliquotaPisCofinsSaida: string;
  /** Alíquota de crédito de PIS e Cofins em 2026 sobre a parcela de insumos tributados. */
  readonly creditoPisCofinsEntrada: string;
  /** Simples Nacional: alíquota efetiva do DAS. */
  readonly aliquotaDas: string | null;
  /** Simples Nacional: fração do DAS correspondente a CBS/IBS. */
  readonly parcelaCbsIbsNoDas: string | null;
  readonly despesasVariaveis: string;
  readonly margem: string;
  readonly baseMargem: BaseMargem;
}

export interface EntradaServico {
  readonly custos: CustosServico;
  readonly perfil: PerfilVendaServico;
}

const ZERO = new D(0);
const UM = new D(1);
const CENTAVO = new D('0.01');
const MOTIVO_PARTILHA_DAS =
  'Simples com IBS/CBS no regime regular exige a parcela de CBS/IBS do DAS por anexo, que ainda não foi confirmada nas Resoluções CGSN.';

const pct = (x: Dec) => x.toDecimalPlaces(4, D.ROUND_HALF_UP).toFixed(4);

interface ContextoServico {
  readonly p: ParametrosAno;
  readonly perfil: PerfilVendaServico;
  readonly memoria: PassoMemoria[];
  readonly status: Status;
  readonly regras: string[];
  readonly custoBrutoAno: Dec;
  readonly custoLiquido: Dec;
  readonly das: Dec;
  readonly parcela: Dec | null;
  readonly aIss: Dec;
  readonly aPc: Dec;
  readonly aDas: Dec;
  readonly cbsSaida: Dec;
  readonly ibsSaida: Dec;
  readonly porFora: Dec;
  readonly dentro: Dec;
  readonly desp: Dec;
  readonly k: Dec;
}

function prepararServicoAno(e: EntradaServico, p: ParametrosAno): ContextoServico | ResultadoAno {
  const memoria: PassoMemoria[] = [];
  const { custos, perfil } = e;
  const regras = p.regras.map((r) => `${r.id}@${r.versao}`);

  const custoBase = dec(custos.custoDireto);
  if (custoBase.lte(0)) {
    throw new RangeError('O custo direto do serviço precisa ser maior que zero.');
  }
  const fracaoInsumos = dec(custos.parcelaInsumosTributados);
  if (fracaoInsumos.isNegative() || fracaoInsumos.gt(UM)) {
    throw new RangeError('A parcela de insumos tributados precisa estar entre 0 e 1.');
  }
  const aPcInsumos = dec(custos.aliquotaPisCofinsInsumos);
  if (aPcInsumos.isNegative() || aPcInsumos.gte(UM)) {
    throw new RangeError('A alíquota de PIS/Cofins dos insumos precisa estar entre 0 e 1.');
  }

  const simples = perfil.regime === 'SIMPLES_DAS' || perfil.regime === 'SIMPLES_REGULAR';
  if (simples && perfil.aliquotaDas === null) {
    throw new RangeError('Simples Nacional exige a alíquota efetiva do DAS.');
  }
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

  const parcela = perfil.parcelaCbsIbsNoDas === null ? null : dec(perfil.parcelaCbsIbsNoDas);
  if (parcela !== null && (parcela.isNegative() || parcela.gt(UM))) {
    throw new RangeError('A parcela de CBS/IBS no DAS é uma fração entre 0 e 1.');
  }

  const maoDeObraEDemais = arredondarMoeda(custoBase.times(UM.minus(fracaoInsumos)));
  const insumos2026 = custoBase.minus(maoDeObraEDemais);
  const modo = custos.modoFornecedor ?? 'PRECO_LIQUIDO';
  const baseInsumosAno =
    !p.pisCofinsVigente && modo === 'PRECO_LIQUIDO'
      ? arredondarMoeda(insumos2026.times(UM.minus(aPcInsumos)))
      : arredondarMoeda(insumos2026);

  // Insumos gerais (energia, sistemas, aluguel) sofrem a alíquota padrão do ano, não a redução do serviço vendido.
  const cbsInsumos = p.cbsIbsComEfeito ? arredondarMoeda(baseInsumosAno.times(dec(p.cbs))) : ZERO;
  const ibsInsumos = p.cbsIbsComEfeito ? arredondarMoeda(baseInsumosAno.times(dec(p.ibs))) : ZERO;
  const custoBrutoAno = maoDeObraEDemais.plus(baseInsumosAno).plus(cbsInsumos).plus(ibsInsumos);

  const creditoPc =
    !simples && p.pisCofinsVigente
      ? arredondarMoeda(baseInsumosAno.times(dec(perfil.creditoPisCofinsEntrada)))
      : ZERO;
  const creditaCbsIbs = perfil.regime !== 'SIMPLES_DAS';
  const creditoCbs = creditaCbsIbs ? cbsInsumos : ZERO;
  const creditoIbs = creditaCbsIbs ? ibsInsumos : ZERO;
  const creditosTotais = creditoPc.plus(creditoCbs).plus(creditoIbs);
  const custoLiquido = custoBrutoAno.minus(creditosTotais);

  memoria.push(
    {
      id: 'servico.insumos',
      descricao: 'Custos diretos e insumos no ano',
      formula:
        'parcela sem crédito (folha e demais) + insumos reconstruídos + CBS e IBS destacados nos insumos',
      entradas: {
        parcelaSemCredito: maoDeObraEDemais.toFixed(2),
        insumosBase: baseInsumosAno.toFixed(2),
        modoFornecedor: modo,
        cbsInsumos: cbsInsumos.toFixed(2),
        ibsInsumos: ibsInsumos.toFixed(2),
      },
      resultado: custoBrutoAno.toFixed(2),
      regras,
    },
    {
      id: 'servico.creditos',
      descricao: creditaCbsIbs
        ? 'Créditos apropriados sobre os insumos tributados (ISS nunca gera crédito)'
        : 'Créditos nos insumos (Simples no DAS não credita CBS/IBS: viram custo)',
      formula: 'PIS/Cofins sobre insumos + CBS + IBS dos insumos',
      entradas: {
        pisCofins: creditoPc.toFixed(2),
        cbs: creditoCbs.toFixed(2),
        ibs: creditoIbs.toFixed(2),
      },
      resultado: creditosTotais.toFixed(2),
      regras,
    },
  );

  const fatorIss = dec(p.fatorIcms);
  const das = simples ? dec(perfil.aliquotaDas as string) : ZERO;
  const aIss = simples ? ZERO : dec(perfil.aliquotaIssSaida).times(fatorIss);
  const aPc = !simples && p.pisCofinsVigente ? dec(perfil.aliquotaPisCofinsSaida) : ZERO;
  const aDas = regularNoSimples ? das.times(UM.minus(parcela as Dec)) : das;
  const ef = aliquotasCbsIbs(p);
  const porFora = p.cbsIbsComEfeito && perfil.regime !== 'SIMPLES_DAS' ? ef.cbs.plus(ef.ibs) : ZERO;

  return {
    p,
    perfil,
    memoria,
    status: statusDoAno(p),
    regras,
    custoBrutoAno,
    custoLiquido,
    das,
    parcela,
    aIss,
    aPc,
    aDas,
    cbsSaida: ef.cbs,
    ibsSaida: ef.ibs,
    porFora,
    dentro: aIss.plus(aPc).plus(aDas),
    desp: dec(perfil.despesasVariaveis),
    k: UM.plus(porFora.times(UM.minus(aIss).minus(aPc))),
  };
}

const ehResultado = (x: ContextoServico | ResultadoAno): x is ResultadoAno => 'situacao' in x;

function montarResultadoServico(
  c: ContextoServico,
  preco: Dec,
  passoPreco: PassoMemoria,
): ResultadoAno {
  const { p, perfil, memoria, regras, custoLiquido } = c;
  const iss = arredondarMoeda(preco.times(c.aIss));
  const pisCofins = arredondarMoeda(preco.times(c.aPc));
  const valorDas = arredondarMoeda(preco.times(c.aDas));
  const baseCbsIbs = preco.minus(iss).minus(pisCofins);
  const cbs = c.porFora.isZero() ? ZERO : arredondarMoeda(baseCbsIbs.times(c.cbsSaida));
  const ibs = c.porFora.isZero() ? ZERO : arredondarMoeda(baseCbsIbs.times(c.ibsSaida));
  const despesas = arredondarMoeda(preco.times(c.desp));
  const tributosDentro = iss.plus(pisCofins).plus(valorDas);
  const receitaLiquida = preco.minus(tributosDentro);
  const lucro = receitaLiquida.minus(despesas).minus(custoLiquido);
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
    passoPreco,
    {
      id: 'venda.tributos-servico',
      descricao: 'Tributos da prestação do serviço',
      formula:
        'ISS e PIS/Cofins (ou DAS) por dentro; CBS e IBS por fora sobre preço − ISS − PIS/Cofins',
      entradas: {
        iss: iss.toFixed(2),
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
      descricao: 'Lucro por serviço',
      formula: 'preço − tributos por dentro − despesas − custo líquido',
      entradas: {
        preco: preco.toFixed(2),
        tributosPorDentro: tributosDentro.toFixed(2),
        despesas: despesas.toFixed(2),
        custo: custoLiquido.toFixed(2),
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
      custoLiquido: custoLiquido.toFixed(2),
      totalNotaCompra: c.custoBrutoAno.toFixed(2),
      isCompra: '0.00',
      icms: '0.00',
      iss: iss.toFixed(2),
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

/** Preço do serviço que mantém a margem pedida num ano da transição (2026 a 2033). */
export function precificarServicoAno(e: EntradaServico, p: ParametrosAno): ResultadoAno {
  const c = prepararServicoAno(e, p);
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
  const preco = arredondarMoeda(c.custoLiquido.div(divisor));
  return montarResultadoServico(c, preco, {
    id: 'venda.preco',
    descricao:
      perfil.baseMargem === 'RECEITA_LIQUIDA'
        ? 'Preço do serviço que mantém a margem sobre a receita líquida'
        : 'Preço do serviço que mantém a margem sobre o preço com tributo',
    formula:
      perfil.baseMargem === 'RECEITA_LIQUIDA'
        ? 'custo líquido ÷ ((1 − ISS − PIS/Cofins − DAS) × (1 − margem) − despesas)'
        : 'custo líquido ÷ (1 − tributos por dentro − despesas − margem × k), k = 1 + CBS/IBS × (1 − ISS − PIS/Cofins)',
    entradas: {
      custoLiquido: c.custoLiquido.toFixed(2),
      tributosPorDentro: pct(c.dentro),
      cbsIbsPorFora: pct(c.porFora),
      despesas: perfil.despesasVariaveis,
      margem: perfil.margem,
    },
    resultado: preco.toFixed(2),
    regras: c.regras,
  });
}

/** Resultado de um preço escolhido para o serviço (ex.: preço psicológico). */
export function avaliarPrecoServico(
  e: EntradaServico,
  p: ParametrosAno,
  precoComTributo: string,
): ResultadoAno {
  const alvo = dec(precoComTributo);
  if (alvo.lte(0)) throw new RangeError('O preço informado precisa ser maior que zero.');
  const c = prepararServicoAno(e, p);
  if (ehResultado(c)) return c;

  const cbsIbs = (preco: Dec) => {
    const base = preco
      .minus(arredondarMoeda(preco.times(c.aIss)))
      .minus(arredondarMoeda(preco.times(c.aPc)));
    return c.porFora.isZero()
      ? ZERO
      : arredondarMoeda(base.times(c.cbsSaida)).plus(arredondarMoeda(base.times(c.ibsSaida)));
  };
  const inicio = D.max(CENTAVO, arredondarMoeda(alvo.div(c.k)).minus(CENTAVO.times(2)));
  let preco = inicio;
  for (let passo = 1; passo <= 6; passo++) {
    const candidato = inicio.plus(CENTAVO.times(passo));
    if (candidato.plus(cbsIbs(candidato)).lte(alvo)) preco = candidato;
  }

  return montarResultadoServico(c, preco, {
    id: 'venda.preco-informado',
    descricao: 'Preço escolhido para o serviço (o cliente paga)',
    formula: 'maior preço sem CBS/IBS cujo total com CBS e IBS não passa do informado',
    entradas: { clientePaga: alvo.toFixed(2), k: c.k.toString() },
    resultado: preco.toFixed(2),
    regras: c.regras,
  });
}

/** Linha do tempo de 2026 a 2033 para um serviço. */
export function linhaDoTempoServico(
  e: EntradaServico,
  parametros: readonly ParametrosAno[],
): ResultadoAno[] {
  return parametros.map((p) => precificarServicoAno(e, p));
}
