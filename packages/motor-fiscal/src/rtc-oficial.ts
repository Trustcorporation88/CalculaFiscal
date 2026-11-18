import { arredondarInternoRtc, arredondarMoedaRtc, D, dec, type Dec } from './decimal.js';

/**
 * Espelho puro das fórmulas oficiais da Receita Federal publicadas em:
 * - github.com/ReceitaFederal/calculadora-rtc-regime-regular (BaseCalculoUnificadaService,
 *   CalculoCbsIbsService, CalculoImpostoSeletivoService, ArredondamentoUtils)
 * - github.com/ReceitaFederal/calculadora-rtc-simples-nacional (SimplesNacionalCalculoService,
 *   NT 2026.005 v1.00)
 *
 * Serve como oráculo de referência determinístico (critério 12.1) e utilitário para bases e
 * eventos fiscais da Reforma Tributária do Consumo.
 */

const ZERO = new D(0);
const UM = new D(1);
const CEM = new D(100);

const multRtc = (a: Dec, b: Dec) => arredondarInternoRtc(a.times(b));
const subRtc = (a: Dec, b: Dec) => arredondarInternoRtc(a.minus(b));
const divPorCemRtc = (a: Dec) => arredondarInternoRtc(a.div(CEM));

/** Formata alíquota/percentual como no BigDecimalTDec0302_04Serializer da RFB (2 a 4 casas, HALF_EVEN). */
export function formatarAliquotaRtc(valor: Dec): string {
  const arredondado = valor.toDecimalPlaces(4, D.ROUND_HALF_EVEN);
  const semZeros = arredondado.toFixed(4).replace(/0+$/, '');
  const casas = semZeros.slice(semZeros.indexOf('.') + 1).length;
  return casas < 2 ? arredondado.toFixed(2) : semZeros;
}

// ---------------------------------------------------------------- Base de cálculo unificada NF-e/NFC-e

export type NaturezaOperacaoRtc = 'bem' | 'servico';
export type ModeloDfeUnificado = 55 | 65;

export interface EntradaBaseUnificadaNfe {
  readonly anoFatoGerador: number;
  readonly tipoDocumento: ModeloDfeUnificado;
  readonly natureza?: NaturezaOperacaoRtc | null;
  readonly vProd?: string;
  readonly vFrete?: string;
  readonly vSeg?: string;
  readonly vOutro?: string;
  readonly vII?: string;
  readonly vIS?: string;
  readonly vDesc?: string;
  readonly vPIS?: string;
  readonly vCOFINS?: string;
  readonly vICMS?: string;
  readonly vICMSUFDest?: string;
  readonly vFCP?: string;
  readonly vFCPUFDest?: string;
  readonly vICMSMono?: string;
  readonly vISSQN?: string;
}

export interface ResultadoBaseUnificadaNfe {
  /** Base de CBS e IBS no regime geral (8 casas internas e 2 casas monetárias). */
  readonly baseRG: string;
  readonly baseRGMoeda: string;
  /** Base do Imposto Seletivo (sem o próprio vIS). */
  readonly baseIS: string;
  readonly baseISMoeda: string;
  /** Base da receita bruta no Simples Nacional (sem deduzir ICMS, PIS/Cofins ou ISS). */
  readonly baseSN: string;
  readonly baseSNMoeda: string;
  readonly avisos: readonly string[];
}

type AlvoBase = 'RG' | 'IS' | 'SN';

interface RegraElementoBase {
  readonly campo: keyof Omit<
    EntradaBaseUnificadaNfe,
    'anoFatoGerador' | 'tipoDocumento' | 'natureza'
  >;
  readonly operacao: 'SOMA' | 'SUBTRAI';
  readonly bases: readonly AlvoBase[];
  readonly natureza: NaturezaOperacaoRtc | null;
  readonly inicio: number;
  readonly fim: number;
  readonly modelos: readonly number[];
}

const ELEMENTOS_BASE_NFE: readonly RegraElementoBase[] = [
  {
    campo: 'vProd',
    operacao: 'SOMA',
    bases: ['RG', 'IS', 'SN'],
    natureza: null,
    inicio: 2026,
    fim: 2033,
    modelos: [55, 65],
  },
  {
    campo: 'vFrete',
    operacao: 'SOMA',
    bases: ['RG', 'IS', 'SN'],
    natureza: null,
    inicio: 2026,
    fim: 2033,
    modelos: [55, 65],
  },
  {
    campo: 'vSeg',
    operacao: 'SOMA',
    bases: ['RG', 'IS', 'SN'],
    natureza: null,
    inicio: 2026,
    fim: 2033,
    modelos: [55, 65],
  },
  {
    campo: 'vOutro',
    operacao: 'SOMA',
    bases: ['RG', 'IS', 'SN'],
    natureza: null,
    inicio: 2026,
    fim: 2033,
    modelos: [55, 65],
  },
  {
    campo: 'vII',
    operacao: 'SOMA',
    bases: ['RG', 'IS'],
    natureza: 'bem',
    inicio: 2026,
    fim: 2033,
    modelos: [55],
  },
  {
    campo: 'vIS',
    operacao: 'SOMA',
    bases: ['RG', 'SN'],
    natureza: null,
    inicio: 2027,
    fim: 2033,
    modelos: [55, 65],
  },
  {
    campo: 'vDesc',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS', 'SN'],
    natureza: null,
    inicio: 2026,
    fim: 2033,
    modelos: [55, 65],
  },
  {
    campo: 'vPIS',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS'],
    natureza: null,
    inicio: 2026,
    fim: 2026,
    modelos: [55, 65],
  },
  {
    campo: 'vCOFINS',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS'],
    natureza: null,
    inicio: 2026,
    fim: 2026,
    modelos: [55, 65],
  },
  {
    campo: 'vICMS',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS'],
    natureza: 'bem',
    inicio: 2026,
    fim: 2032,
    modelos: [55, 65],
  },
  {
    campo: 'vICMSUFDest',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS'],
    natureza: 'bem',
    inicio: 2026,
    fim: 2032,
    modelos: [55],
  },
  {
    campo: 'vFCP',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS'],
    natureza: 'bem',
    inicio: 2026,
    fim: 2032,
    modelos: [55, 65],
  },
  {
    campo: 'vFCPUFDest',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS'],
    natureza: 'bem',
    inicio: 2026,
    fim: 2032,
    modelos: [55],
  },
  {
    campo: 'vICMSMono',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS'],
    natureza: 'bem',
    inicio: 2026,
    fim: 2032,
    modelos: [55, 65],
  },
  {
    campo: 'vISSQN',
    operacao: 'SUBTRAI',
    bases: ['RG', 'IS'],
    natureza: 'servico',
    inicio: 2026,
    fim: 2032,
    modelos: [55, 65],
  },
];

/**
 * Cálculo unificado das bases RG (CBS/IBS), IS e Simples Nacional da NF-e/NFC-e, idêntico ao
 * BaseCalculoUnificadaService da Receita Federal.
 */
export function calcularBaseUnificadaNfe(e: EntradaBaseUnificadaNfe): ResultadoBaseUnificadaNfe {
  if (e.tipoDocumento !== 55 && e.tipoDocumento !== 65) {
    throw new RangeError('Tipo de documento deve ser 55 (NF-e) ou 65 (NFC-e).');
  }
  const ano = e.anoFatoGerador;
  const natureza = e.natureza ?? null;
  let rgSoma = ZERO;
  let rgSub = ZERO;
  let isSoma = ZERO;
  let isSub = ZERO;
  let snSoma = ZERO;
  let snSub = ZERO;
  const avisos: string[] = [];

  for (const el of ELEMENTOS_BASE_NFE) {
    const bruto = e[el.campo];
    const valor = bruto === undefined ? ZERO : dec(bruto);
    if (valor.isZero()) continue;

    const anoOk = ano >= el.inicio && ano <= el.fim;
    const natOk = el.natureza === null || (natureza !== null && el.natureza === natureza);
    const modOk = el.modelos.includes(e.tipoDocumento);

    if (!anoOk) {
      avisos.push(
        `Campo ${el.campo} não compõe as bases para o ano ${ano} (vigência ${el.inicio}-${el.fim}) e foi ignorado no cálculo`,
      );
      continue;
    }
    if (!natOk) {
      avisos.push(
        `Campo ${el.campo} não compõe as bases para a natureza ${String(natureza).toUpperCase()} (aplicável apenas a ${el.natureza!.toUpperCase()}) e foi ignorado no cálculo`,
      );
      continue;
    }
    if (!modOk) {
      avisos.push(
        `Campo ${el.campo} não compõe as bases para o documento modelo ${e.tipoDocumento} e foi ignorado no cálculo`,
      );
      continue;
    }

    if (el.operacao === 'SOMA') {
      if (el.bases.includes('RG')) rgSoma = rgSoma.plus(valor);
      if (el.bases.includes('IS')) isSoma = isSoma.plus(valor);
      if (el.bases.includes('SN')) snSoma = snSoma.plus(valor);
    } else {
      if (el.bases.includes('RG')) rgSub = rgSub.plus(valor);
      if (el.bases.includes('IS')) isSub = isSub.plus(valor);
      if (el.bases.includes('SN')) snSub = snSub.plus(valor);
    }
  }

  const baseRG = subRtc(rgSoma, rgSub);
  const baseIS = subRtc(isSoma, isSub);
  const baseSN = subRtc(snSoma, snSub);

  return {
    baseRG: baseRG.toFixed(8),
    baseRGMoeda: arredondarMoedaRtc(baseRG).toFixed(2),
    baseIS: baseIS.toFixed(8),
    baseISMoeda: arredondarMoedaRtc(baseIS).toFixed(2),
    baseSN: baseSN.toFixed(8),
    baseSNMoeda: arredondarMoedaRtc(baseSN).toFixed(2),
    avisos,
  };
}

// ---------------------------------------------------------------- Regime Geral (CBS, IBS e IS por item)

export interface EntradaItemRegimeGeralRtc {
  /** Base de CBS/IBS sem o IS calculado (ou base do IS quando incide IS). */
  readonly baseSemIs: string;
  /** Alíquota nominal da CBS em fração ("0.088" ou "0.112"). */
  readonly aliquotaCbs: string;
  /** Alíquota nominal do IBS estadual em fração ("0.0005"). */
  readonly aliquotaIbsUf: string;
  /** Alíquota nominal do IBS municipal em fração ("0.0005"). */
  readonly aliquotaIbsMun: string;
  /** Fração de redução do cClassTrib ("0", "0.6", "1"). Padrão: "0". */
  readonly reducao?: string;
  /** Alíquota ad valorem do Imposto Seletivo em fração ("0.026"). Padrão: "0". */
  readonly aliquotaIs?: string;
  /** Parcela específica (ad rem) do IS por unidade, em reais ("3.50"). Padrão: "0". */
  readonly adRemIs?: string;
  readonly quantidade?: string;
}

export interface ResultadoItemRegimeGeralRtc {
  readonly vBCIS: string;
  readonly vIS: string;
  readonly vBCIBSCBS: string;
  readonly pAliqEfetCBS: string;
  readonly vCBS: string;
  readonly pAliqEfetIBSUF: string;
  readonly vIBSUF: string;
  readonly pAliqEfetIBSMun: string;
  readonly vIBSMun: string;
  readonly vIBS: string;
}

/**
 * Calcula IS, CBS, IBS estadual e IBS municipal de um item seguindo a precisão interna de 8 casas
 * e formatação HALF_EVEN da calculadora oficial do regime regular.
 */
export function calcularTributosRtcItem(e: EntradaItemRegimeGeralRtc): ResultadoItemRegimeGeralRtc {
  const baseSemIs = arredondarInternoRtc(dec(e.baseSemIs));
  const aliqIs = arredondarInternoRtc(dec(e.aliquotaIs ?? '0'));
  const adRemIs = arredondarInternoRtc(dec(e.adRemIs ?? '0'));
  const qtd = arredondarInternoRtc(dec(e.quantidade ?? '1'));
  const reducao = arredondarInternoRtc(dec(e.reducao ?? '0'));
  if (reducao.isNegative() || reducao.gt(UM)) {
    throw new RangeError('A redução precisa estar entre 0 e 1.');
  }

  const isAdValorem = multRtc(baseSemIs, aliqIs);
  const isEspecifico = multRtc(qtd, adRemIs);
  const isInterno = arredondarInternoRtc(isAdValorem.plus(isEspecifico));

  // Expressão oficial do tratamento padrão: baseCalculoInformada - isInformado + isCalculado
  const baseCbsIbs = arredondarInternoRtc(D.max(ZERO, baseSemIs.plus(isInterno)));
  const fatorRedutor = subRtc(UM, reducao);

  const efetCbs = multRtc(arredondarInternoRtc(dec(e.aliquotaCbs)), fatorRedutor);
  const efetUf = multRtc(arredondarInternoRtc(dec(e.aliquotaIbsUf)), fatorRedutor);
  const efetMun = multRtc(arredondarInternoRtc(dec(e.aliquotaIbsMun)), fatorRedutor);

  const cbsInterno = multRtc(baseCbsIbs, efetCbs);
  const ibsUfInterno = multRtc(baseCbsIbs, efetUf);
  const ibsMunInterno = multRtc(baseCbsIbs, efetMun);
  // Totalizar soma sem arredondamento intermediário; arredonda na apresentação (ArredondamentoUtils.totalizar).
  const ibsSoma = ibsUfInterno.plus(ibsMunInterno);

  return {
    vBCIS: arredondarMoedaRtc(baseSemIs).toFixed(2),
    vIS: arredondarMoedaRtc(isInterno).toFixed(2),
    vBCIBSCBS: arredondarMoedaRtc(baseCbsIbs).toFixed(2),
    pAliqEfetCBS: formatarAliquotaRtc(efetCbs.times(CEM)),
    vCBS: arredondarMoedaRtc(cbsInterno).toFixed(2),
    pAliqEfetIBSUF: formatarAliquotaRtc(efetUf.times(CEM)),
    vIBSUF: arredondarMoedaRtc(ibsUfInterno).toFixed(2),
    pAliqEfetIBSMun: formatarAliquotaRtc(efetMun.times(CEM)),
    vIBSMun: arredondarMoedaRtc(ibsMunInterno).toFixed(2),
    vIBS: arredondarMoedaRtc(ibsSoma).toFixed(2),
  };
}

// ---------------------------------------------------------------- Simples Nacional (NT 2026.005 v1.00)

export type RegimeSimplesNt = 'CRT_1' | 'CRT_2' | 'CRT_3_TPREGIME_2';
export type CodigoTpRbsn = 0 | 1 | 2 | 3 | 4 | 5 | 9;
export type TipoEnteGovRtc = 1 | 2 | 3 | 4;

export interface EntradaSimplesNt2026005 {
  readonly regime: RegimeSimplesNt;
  readonly tpRBSN: CodigoTpRbsn;
  /** Verdadeiro quando o código de atividade (cAtivSN) é válido e admissível no documento. */
  readonly cAtivSNValido?: boolean;
  /** Base de cálculo sem o Imposto Seletivo ("950.00"). */
  readonly baseCalculo: string;
  /** Valor do Imposto Seletivo já calculado ("0.00" quando não há). */
  readonly valorImpostoSeletivo?: string;
  /** Alíquota efetiva do Simples para o IBS, em pontos percentuais ("1.25" = 1,25%). */
  readonly pIBSSN?: string | null;
  /** Alíquota efetiva do Simples para a CBS, em pontos percentuais ("2.75" = 2,75%). */
  readonly pCBSSN?: string | null;
  readonly tpEnteGov?: TipoEnteGovRtc | null;
  /** Fator de transição (fração, ex.: "0.10" em 2029) quando tpEnteGov é 2, 3 ou 4. */
  readonly fatorTransicaoCompraGov?: string | null;
  /** Parametrização futura prevista na tabela da RFB (hoje desligada em todas as vigências). */
  readonly impostoSeletivoCompoeReceita?: boolean;
}

export type ResultadoSimplesNt2026005 =
  | {
      readonly estadoItem: 'NAO_CALCULADO';
      readonly vRBSNitem: string;
      readonly tpRBSN: CodigoTpRbsn;
      readonly tpRBSNDescricao: string;
    }
  | {
      readonly estadoItem: 'CALCULADO';
      readonly vRBSNitem: string;
      readonly tpRBSN: CodigoTpRbsn;
      readonly tpRBSNDescricao: string;
      readonly vBC: string;
      readonly pIBSSN: string | null;
      readonly vIBSSN: string | null;
      readonly vIBSPendSusp: string | null;
      readonly pCBSSN: string | null;
      readonly vCBSSN: string;
      readonly vCBSPendSusp: string;
      readonly vIS: string;
      readonly totalItem: string;
    };

interface ParametroTpRbsn {
  readonly descricao: string;
  readonly compoeReceita: boolean;
  readonly fatorReceita: Dec;
  readonly pendenteSuspenso: boolean;
}

const TABELA_TPRBSN: Readonly<Record<CodigoTpRbsn, ParametroTpRbsn>> = {
  0: {
    descricao: 'Não é receita bruta',
    compoeReceita: false,
    fatorReceita: ZERO,
    pendenteSuspenso: false,
  },
  1: {
    descricao: 'Receita bruta - interna',
    compoeReceita: true,
    fatorReceita: UM,
    pendenteSuspenso: false,
  },
  2: {
    descricao: 'Receita bruta - interna sem cálculo de IBS e CBS',
    compoeReceita: true,
    fatorReceita: ZERO,
    pendenteSuspenso: false,
  },
  3: {
    descricao: 'Receita bruta - exportação direta',
    compoeReceita: true,
    fatorReceita: ZERO,
    pendenteSuspenso: false,
  },
  4: {
    descricao: 'Receita bruta - exportação indireta',
    compoeReceita: true,
    fatorReceita: UM,
    pendenteSuspenso: true,
  },
  5: {
    descricao: 'Receita bruta - mercado interno e exportação',
    compoeReceita: true,
    fatorReceita: new D('0.5'),
    pendenteSuspenso: false,
  },
  9: {
    descricao: 'Fornecimento incompatível com SN',
    compoeReceita: true,
    fatorReceita: ZERO,
    pendenteSuspenso: false,
  },
};

type DestinoValor = 'DEVIDO' | 'PENDENTE_SUSPENSO' | 'ZERO';

const MATRIZ_REGIME_SN: Readonly<
  Record<
    RegimeSimplesNt,
    {
      readonly geraIbs: boolean;
      readonly devido: DestinoValor;
      readonly pendenteSuspenso: DestinoValor;
    }
  >
> = {
  CRT_1: { geraIbs: true, devido: 'DEVIDO', pendenteSuspenso: 'PENDENTE_SUSPENSO' },
  CRT_2: { geraIbs: false, devido: 'DEVIDO', pendenteSuspenso: 'PENDENTE_SUSPENSO' },
  CRT_3_TPREGIME_2: { geraIbs: true, devido: 'PENDENTE_SUSPENSO', pendenteSuspenso: 'ZERO' },
};

function repartir(destino: DestinoValor, valor: Dec): { devido: Dec; pendenteSuspenso: Dec } {
  if (destino === 'DEVIDO') return { devido: valor, pendenteSuspenso: ZERO };
  if (destino === 'PENDENTE_SUSPENSO') return { devido: ZERO, pendenteSuspenso: valor };
  return { devido: ZERO, pendenteSuspenso: ZERO };
}

/**
 * Reproduz fielmente SimplesNacionalCalculoService (NT 2026.005 v1.00, seções 5.3.2 a 5.3.4),
 * incluindo a matriz de regime (CRT 1, CRT 2 e CRT 3 + tpRegimeIBSCBS=2), os efeitos de tpRBSN
 * e o deslocamento CBS <-> IBS nas compras governamentais (arts. 372 e 473 da LC 214/2025).
 */
export function calcularItemSimplesNt2026005(
  e: EntradaSimplesNt2026005,
): ResultadoSimplesNt2026005 {
  const tipo = TABELA_TPRBSN[e.tpRBSN];
  const matriz = MATRIZ_REGIME_SN[e.regime];
  const base = dec(e.baseCalculo);
  const vIs = dec(e.valorImpostoSeletivo ?? '0');

  const vRBSNitem = tipo.compoeReceita
    ? e.impostoSeletivoCompoeReceita
      ? base.plus(vIs)
      : base
    : ZERO;

  if (e.cAtivSNValido === false) {
    return {
      estadoItem: 'NAO_CALCULADO',
      vRBSNitem: arredondarMoedaRtc(vRBSNitem).toFixed(2),
      tpRBSN: e.tpRBSN,
      tpRBSNDescricao: tipo.descricao,
    };
  }

  let pIbs = e.pIBSSN !== undefined && e.pIBSSN !== null ? dec(e.pIBSSN) : null;
  let pCbs = e.pCBSSN !== undefined && e.pCBSSN !== null ? dec(e.pCBSSN) : null;

  if (e.tpEnteGov !== undefined && e.tpEnteGov !== null && (pIbs !== null || pCbs !== null)) {
    const ibsAtual = pIbs ?? ZERO;
    const cbsAtual = pCbs ?? ZERO;
    if (e.tpEnteGov === 1) {
      pIbs = ZERO;
      pCbs = ibsAtual.plus(cbsAtual);
    } else {
      if (e.fatorTransicaoCompraGov === undefined || e.fatorTransicaoCompraGov === null) {
        throw new RangeError(
          `Fator de transição de compra governamental obrigatório para tpEnteGov ${e.tpEnteGov}.`,
        );
      }
      const f = dec(e.fatorTransicaoCompraGov);
      pIbs = ibsAtual.plus(multRtc(f, cbsAtual));
      pCbs = multRtc(subRtc(UM, f), cbsAtual);
    }
  }

  const vBC = multRtc(vRBSNitem, tipo.fatorReceita);
  const valorBruto = (aliquota: Dec | null) =>
    aliquota === null || tipo.fatorReceita.isZero()
      ? ZERO
      : multRtc(multRtc(vRBSNitem, tipo.fatorReceita), divPorCemRtc(aliquota));

  const destino = tipo.pendenteSuspenso ? matriz.pendenteSuspenso : matriz.devido;
  const ibs = matriz.geraIbs ? repartir(destino, valorBruto(pIbs)) : null;
  const cbs = repartir(destino, valorBruto(pCbs));
  const totalItem = (ibs ? ibs.devido : ZERO).plus(cbs.devido).plus(vIs);

  return {
    estadoItem: 'CALCULADO',
    vRBSNitem: arredondarMoedaRtc(vRBSNitem).toFixed(2),
    tpRBSN: e.tpRBSN,
    tpRBSNDescricao: tipo.descricao,
    vBC: arredondarMoedaRtc(vBC).toFixed(2),
    pIBSSN: matriz.geraIbs && pIbs !== null ? formatarAliquotaRtc(pIbs) : null,
    vIBSSN: ibs ? arredondarMoedaRtc(ibs.devido).toFixed(2) : null,
    vIBSPendSusp: ibs ? arredondarMoedaRtc(ibs.pendenteSuspenso).toFixed(2) : null,
    pCBSSN: pCbs !== null ? formatarAliquotaRtc(pCbs) : null,
    vCBSSN: arredondarMoedaRtc(cbs.devido).toFixed(2),
    vCBSPendSusp: arredondarMoedaRtc(cbs.pendenteSuspenso).toFixed(2),
    vIS: arredondarMoedaRtc(vIs).toFixed(2),
    totalItem: arredondarMoedaRtc(totalItem).toFixed(2),
  };
}
