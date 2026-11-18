import { D, type BaseMargem, type ModoFornecedor, type Regime } from '@calculafiscal/motor-fiscal';
import { CENARIOS, type Cenario } from '@calculafiscal/regras/cenarios';
import type { NaturezaCalculo } from '@calculafiscal/regras/resolver';

/** Valores do formulário como o usuário digitou (formato brasileiro). */
export type ValoresFormulario = Readonly<Record<string, string>>;

/** Entrada da calculadora já validada; percentuais em fração ("0.18") e valores com ponto. */
export interface EntradaCalculadora {
  readonly natureza: NaturezaCalculo;
  readonly modoFornecedor: ModoFornecedor;
  readonly descricao: string;
  readonly ncm: string | null;
  readonly nbs: string | null;
  /** Tratamento de CBS/IBS (cClassTrib); 000001 = tributação integral. */
  readonly cClassTrib: string;
  readonly cenario: Cenario;
  /** Mercadoria: total da nota por unidade. Serviço: custo direto por serviço. */
  readonly notaCompra: string;
  readonly aliquotaIcms: string;
  readonly aliquotaIpi: string;
  readonly aliquotaPisCofins: string;
  readonly substituicaoTributaria: {
    readonly mva: string;
    readonly aliquotaInterna: string;
  } | null;
  readonly freteEDespesas: string;
  /** Serviço: fração do custo direto correspondente a insumos tributados ("0" a "1"). */
  readonly parcelaInsumosTributados: string;
  /** Serviço: alíquota de PIS/Cofins embutida nos insumos tributados em 2026. */
  readonly aliquotaPisCofinsInsumos: string;
  readonly regime: Regime;
  readonly aliquotaDas: string | null;
  readonly parcelaCbsIbsNoDas: string | null;
  readonly aliquotaIcmsSaida: string;
  readonly aliquotaIssSaida: string;
  readonly creditaIcmsEntrada: boolean;
  readonly aliquotaPisCofinsSaida: string;
  readonly creditoPisCofinsEntrada: string;
  readonly despesasVariaveis: string;
  readonly margem: string;
  readonly baseMargem: BaseMargem;
  readonly impostoSimplificado: string;
}

export type LeituraEntrada =
  | { readonly ok: true; readonly entrada: EntradaCalculadora }
  | { readonly ok: false; readonly erros: Readonly<Record<string, string>> };

export const REGIMES: readonly Regime[] = ['SIMPLES_DAS', 'SIMPLES_REGULAR', 'PRESUMIDO', 'REAL'];
export const NATUREZAS: readonly NaturezaCalculo[] = ['MERCADORIA', 'SERVICO'];
export const MODOS_FORNECEDOR: readonly ModoFornecedor[] = ['PRECO_LIQUIDO', 'PRECO_BRUTO'];
const BASES: readonly BaseMargem[] = ['PRECO_COM_TRIBUTO', 'RECEITA_LIQUIDA'];

/** "1.234,56", "1234,56" ou "1234.56" para "1234.56". Devolve null se não for número. */
export function numeroBrasileiro(texto: string): string | null {
  let t = texto.trim().replace(/\s/g, '').replace(/^R\$/, '').replace(/%$/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? t : null;
}

/** Teto de qualquer valor digitado (R$ 1 bilhão por unidade ou 1 bilhão %). */
const LIMITE_VALOR = 1_000_000_000;

const NCM = /^\d{4}\.?\d{2}\.?\d{2}$/;
const NBS = /^\d\.?\d{4}\.?\d{2}\.?\d{2}$/;

/**
 * Lê e valida o formulário. Nunca completa um campo obrigatório que o usuário deixou em branco com
 * um valor "razoável": campo obrigatório vazio é erro, para não gerar número com aparência de certo.
 */
export function lerEntrada(v: ValoresFormulario): LeituraEntrada {
  const erros: Record<string, string> = {};
  const texto = (campo: string) => (v[campo] ?? '').trim();

  const valor = (campo: string, opcoes: { obrigatorio?: boolean; positivo?: boolean } = {}) => {
    const bruto = texto(campo);
    if (bruto === '') {
      if (opcoes.obrigatorio ?? true) erros[campo] = 'Informe este valor.';
      return '0';
    }
    const n = numeroBrasileiro(bruto);
    if (n === null) {
      erros[campo] = 'Use só números, com vírgula para os centavos.';
      return '0';
    }
    if (opcoes.positivo && new D(n).lte(0)) erros[campo] = 'Precisa ser maior que zero.';
    if (new D(n).gt(LIMITE_VALOR)) erros[campo] = 'Valor grande demais.';
    return new D(n).toFixed();
  };

  const percentual = (
    campo: string,
    opcoes: { obrigatorio?: boolean; menorQue100?: boolean; ate100?: boolean } = {},
  ) => {
    const obrigatorio = opcoes.obrigatorio ?? true;
    const menorQue100 = opcoes.menorQue100 ?? true;
    const ate100 = opcoes.ate100 ?? false;
    const bruto = texto(campo);
    if (bruto === '' && !obrigatorio) return null;
    const n = valor(campo);
    if (erros[campo]) return '0';
    const fracao = new D(n).div(100);
    if (ate100) {
      if (fracao.gt(1)) erros[campo] = 'Precisa ser de até 100%.';
    } else if (menorQue100 && fracao.gte(1)) {
      erros[campo] = 'Precisa ser menor que 100%.';
    }
    return fracao.toFixed();
  };

  const natureza = (texto('natureza') || 'MERCADORIA') as NaturezaCalculo;
  if (!NATUREZAS.includes(natureza)) erros['natureza'] = 'Escolha mercadoria ou serviço.';
  const ehServico = natureza === 'SERVICO';

  const modoFornecedor = (texto('modoFornecedor') || 'PRECO_LIQUIDO') as ModoFornecedor;
  if (!MODOS_FORNECEDOR.includes(modoFornecedor)) {
    erros['modoFornecedor'] = 'Escolha a premissa do fornecedor.';
  }

  const regime = texto('regime') as Regime;
  if (!REGIMES.includes(regime)) erros['regime'] = 'Escolha o regime.';
  const simples = regime === 'SIMPLES_DAS' || regime === 'SIMPLES_REGULAR';

  const baseMargem = texto('baseMargem') as BaseMargem;
  if (!BASES.includes(baseMargem)) erros['baseMargem'] = 'Escolha a base da margem.';

  const cenario = (texto('cenario') || 'base') as Cenario;
  if (!CENARIOS.includes(cenario)) erros['cenario'] = 'Cenário desconhecido.';

  const cClassTrib = texto('cClassTrib') || '000001';
  if (!/^\d{6}$/.test(cClassTrib)) erros['cClassTrib'] = 'cClassTrib com 6 dígitos, ex.: 200034.';

  const ncmBruto = ehServico ? '' : texto('ncm');
  if (ncmBruto !== '' && !NCM.test(ncmBruto)) erros['ncm'] = 'NCM com 8 dígitos, ex.: 2202.10.00.';

  const nbsBruto = ehServico ? texto('nbs') : '';
  if (nbsBruto !== '' && !NBS.test(nbsBruto)) {
    erros['nbs'] = 'NBS com 9 dígitos, ex.: 1.1302.21.00.';
  }

  const temSt = !ehServico && texto('temSt') === 'on';
  const mva = temSt ? percentual('mva', { obrigatorio: true, menorQue100: false }) : null;
  const aliquotaInterna = temSt ? percentual('aliquotaInterna') : null;

  const notaCompra = ehServico
    ? texto('custoDireto') !== ''
      ? valor('custoDireto', { positivo: true })
      : valor('custoDireto', { positivo: true })
    : valor('notaCompra', { positivo: true });

  const parcelaInsumos = ehServico
    ? (percentual('parcelaInsumosTributados', {
        obrigatorio: false,
        menorQue100: false,
        ate100: true,
      }) ?? '0')
    : '0';
  const pcInsumos = ehServico
    ? (percentual('aliquotaPisCofinsInsumos', { obrigatorio: false }) ?? '0')
    : '0';

  const entrada: EntradaCalculadora = {
    natureza,
    modoFornecedor,
    descricao: texto('descricao').slice(0, 120),
    ncm: ncmBruto === '' ? null : ncmBruto,
    nbs: nbsBruto === '' ? null : nbsBruto,
    cClassTrib,
    cenario,
    notaCompra,
    aliquotaIcms: ehServico ? '0' : (percentual('aliquotaIcms') as string),
    aliquotaIpi: ehServico ? '0' : (percentual('aliquotaIpi') as string),
    aliquotaPisCofins: ehServico ? '0' : (percentual('aliquotaPisCofins') as string),
    substituicaoTributaria:
      mva !== null && aliquotaInterna !== null ? { mva, aliquotaInterna } : null,
    freteEDespesas: ehServico ? '0' : valor('freteEDespesas', { obrigatorio: false }),
    parcelaInsumosTributados: parcelaInsumos,
    aliquotaPisCofinsInsumos: pcInsumos,
    regime,
    aliquotaDas: simples ? percentual('aliquotaDas') : null,
    parcelaCbsIbsNoDas: simples ? percentual('parcelaCbsIbsNoDas', { obrigatorio: false }) : null,
    aliquotaIcmsSaida: simples || ehServico ? '0' : (percentual('aliquotaIcmsSaida') as string),
    aliquotaIssSaida: simples || !ehServico ? '0' : (percentual('aliquotaIssSaida') as string),
    creditaIcmsEntrada: !simples && !ehServico && texto('creditaIcmsEntrada') === 'on',
    aliquotaPisCofinsSaida: simples ? '0' : (percentual('aliquotaPisCofinsSaida') as string),
    creditoPisCofinsEntrada: simples ? '0' : (percentual('creditoPisCofinsEntrada') as string),
    despesasVariaveis: percentual('despesasVariaveis') as string,
    margem: percentual('margem') as string,
    baseMargem,
    impostoSimplificado: percentual('impostoSimplificado') as string,
  };

  return Object.keys(erros).length > 0 ? { ok: false, erros } : { ok: true, entrada };
}
